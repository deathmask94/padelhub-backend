import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import { Resend } from 'resend';
import { notify } from '@/lib/notify';

type Params = { params: Promise<{ id: string }> };

const resend = new Resend(process.env.RESEND_API_KEY);

const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function formatDate(d: Date) {
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}
function formatTime(d: Date) {
  return d.toISOString().substring(11, 16);
}

export async function POST(request: Request, context: Params) {
  try {
    const { id: matchId } = await context.params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        users: { select: { name: true } },
        match_players: {
          where:   { status: { in: ['confirmed', 'pending'] } },
          include: { users: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!match)                        return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
    if (match.organizer_id !== userId) return NextResponse.json({ error: 'Solo el organizador puede cancelar' }, { status: 403 });
    if (['finished', 'cancelled'].includes(match.status)) {
      return NextResponse.json({ error: 'No se puede cancelar un partido ya finalizado o cancelado' }, { status: 400 });
    }

    await prisma.matches.update({
      where: { id: matchId },
      data:  { status: 'cancelled', updated_at: new Date() },
    });

    // Notify players with email (best-effort, no throw on failure)
    const playersWithEmail = match.match_players
      .map((p) => p.users)
      .filter((u) => u.email);

    if (playersWithEmail.length > 0) {
      const dateStr = formatDate(new Date(match.match_date));
      const timeStr = formatTime(new Date(match.match_time));

      await Promise.allSettled(
        playersWithEmail.map((p) =>
          resend.emails.send({
            from:    'onboarding@resend.dev',
            to:      p.email!,
            subject: `Partido cancelado — ${match.club}`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
                <div style="background:#84cc16;width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px">
                  <span style="font-size:24px;font-weight:800;color:#fff">H</span>
                </div>
                <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">Partido cancelado</h2>
                <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
                  Hola <strong>${p.name}</strong>, el partido al que estabas inscrito ha sido cancelado.
                </p>
                <div style="background:#f4f4f4;border-radius:12px;padding:16px 20px;margin-bottom:24px">
                  <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#111827">${match.club}</p>
                  <p style="margin:0;font-size:13px;color:#6b7280">
                    📅 ${dateStr} · ⏰ ${timeStr} · ${match.format === 'doubles' ? 'Dobles' : 'Individual'}
                  </p>
                  <p style="margin:6px 0 0;font-size:13px;color:#6b7280">
                    Cancelado por: ${match.users.name}
                  </p>
                </div>
                <p style="font-size:13px;color:#6b7280">Tu MMR no se ha visto afectado.</p>
              </div>
            `,
          })
        )
      );
    }

    await Promise.all(
      match.match_players.map((p) =>
        notify(p.users.id, `Partido cancelado — ${match.club}`, `El partido fue cancelado por el organizador`)
      )
    );

    return NextResponse.json({ message: 'Partido cancelado correctamente' });
  } catch (error) {
    console.error('[MATCH CANCEL ERROR]', error);
    return NextResponse.json({ error: 'Error al cancelar el partido' }, { status: 500 });
  }
}
