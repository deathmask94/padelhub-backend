import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { sendPush } from '@/lib/push';
import { matchDateTimeAsUTCms } from '@/lib/matchTime';

const resend  = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function formatDate(d: Date) { return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`; }
function formatTime(d: Date) { return d.toISOString().substring(11, 16); }

// Ventana ±15 min alrededor del momento objetivo para tolerar variaciones del cron
const WINDOW = 15 * 60 * 1000;

export async function GET(request: Request) {
  // Proteccion por secret para que solo el cron de Vercel pueda llamarlo.
  // Vercel Cron Jobs manda automaticamente 'Authorization: Bearer <CRON_SECRET>'
  // cuando esa env var existe en el proyecto; se mantienen los otros dos
  // formatos por compatibilidad con llamadas manuales/de prueba.
  const authHeader   = request.headers.get('authorization');
  const bearerSecret = authHeader?.replace('Bearer ', '');
  const secret = bearerSecret
    ?? request.headers.get('x-cron-secret')
    ?? new URL(request.url).searchParams.get('secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const now = Date.now();

  // Ventanas: 24 h y 1 h antes del partido
  const targets = [
    { type: '24h', ms: 24 * 60 * 60 * 1000 },
    { type: '1h',  ms:      60 * 60 * 1000  },
  ] as const;

  let sent = 0;

  // match_time es columna TIME (sin fecha): no se puede filtrar "24h/1h
  // desde ahora" a nivel de BD comparandola sola, porque Prisma/Postgres
  // solo compara la hora-del-dia e ignora la fecha por completo (un
  // partido en 3 semanas cuya hora coincidiera con la ventana de hoy
  // matchearia igual). Se trae un rango amplio por match_date (cubre
  // sobra para las ventanas de 24h y 1h) y se filtra la hora exacta en
  // JS con matchDateTimeAsUTCms, que si combina fecha + hora reales.
  const today       = new Date(); today.setUTCHours(0, 0, 0, 0);
  const dateRangeTo = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

  const candidateMatches = await prisma.matches.findMany({
    where: {
      status:     { in: ['open', 'confirmed'] },
      match_date: { gte: today, lte: dateRangeTo },
    },
    include: {
      users:         { select: { id: true, name: true, email: true, reminder_enabled: true } },
      match_players: {
        where:   { status: 'confirmed' },
        include: { users: { select: { id: true, name: true, email: true, reminder_enabled: true } } },
      },
    },
  });

  for (const { type, ms } of targets) {
    const from = now + ms - WINDOW;
    const to   = now + ms + WINDOW;

    const matches = candidateMatches.filter((m) => {
      const startsAt = matchDateTimeAsUTCms(m.match_date, m.match_time);
      return startsAt >= from && startsAt <= to;
    });

    for (const match of matches) {
      // Todos los participantes: organizador + jugadores confirmados.
      // El email de recordatorio siempre se manda; el toggle "Recordatorios
      // de partido" del perfil solo controla si ademas llega como push.
      const participants = [
        match.users,
        ...match.match_players.map((p) => p.users),
      ].filter((u) => u.email);

      for (const participant of participants) {
        // Verificar que no se haya enviado ya este recordatorio
        const alreadySent = await prisma.match_reminders.findUnique({
          where: { match_id_user_id_type: { match_id: match.id, user_id: participant.id, type } },
        });
        if (alreadySent) continue;

        const dateStr   = formatDate(new Date(match.match_date));
        const timeStr   = formatTime(new Date(match.match_time));
        const formatStr = match.format === 'doubles' ? 'Dobles (2v2)' : 'Individual (1v1)';
        const label     = type === '24h' ? 'mañana' : 'en 1 hora';

        await resend.emails.send({
          from:    'onboarding@resend.dev',
          to:      participant.email!,
          subject: `Recordatorio: tienes un partido ${label} — ${match.club}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <div style="background:#84cc16;width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px">
                <span style="font-size:24px;font-weight:800;color:#fff">H</span>
              </div>
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
                ¡Tienes un partido ${label}!
              </h2>
              <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
                Hola <strong>${participant.name}</strong>, te recordamos que tienes un partido programado.
              </p>
              <div style="background:#f4f4f4;border-radius:12px;padding:16px 20px;margin-bottom:24px">
                <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#111827">${match.club}</p>
                <p style="margin:0;font-size:13px;color:#6b7280">
                  📅 ${dateStr} &nbsp;·&nbsp; ⏰ ${timeStr} &nbsp;·&nbsp; 🎾 ${formatStr}
                </p>
              </div>
              <a href="${APP_URL}/matches/${match.id}"
                 style="display:block;text-align:center;background:#84cc16;color:#fff;font-weight:700;font-size:15px;padding:13px 0;border-radius:10px;text-decoration:none">
                Ver partido →
              </a>
              <p style="font-size:12px;color:#9ca3af;margin-top:20px;text-align:center">
                Puedes desactivar estos recordatorios desde tu perfil en PadelHub.
              </p>
            </div>
          `,
        });

        if (participant.reminder_enabled) {
          await sendPush(
            participant.id,
            `Partido ${label}`,
            `${match.club} — ${dateStr} · ${timeStr}`,
          ).catch(() => {});
        }

        await prisma.match_reminders.create({
          data: { match_id: match.id, user_id: participant.id, type },
        });

        sent++;
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
