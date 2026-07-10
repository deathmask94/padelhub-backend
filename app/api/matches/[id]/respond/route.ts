import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import { notify } from '@/lib/notify';
import { Resend } from 'resend';

type Params = { params: Promise<{ id: string }> };

const resend = new Resend(process.env.RESEND_API_KEY);
const MAX_PLAYERS: Record<string, number> = { doubles: 4, singles: 2 };

const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function formatDate(d: Date) { return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`; }
function formatTime(d: Date) { return d.toISOString().substring(11, 16); }

async function notifyMatchConfirmed(matchId: string) {
  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    include: {
      users:         { select: { id: true, name: true, email: true, reminder_enabled: true } },
      match_players: {
        where:   { status: 'confirmed' },
        include: { users: { select: { id: true, name: true, email: true, reminder_enabled: true } } },
      },
    },
  });
  if (!match) return;

  const appUrl    = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const dateStr   = formatDate(new Date(match.match_date));
  const timeStr   = formatTime(new Date(match.match_time));
  const formatStr = match.format === 'doubles' ? 'Dobles (2v2)' : 'Individual (1v1)';

  const participants = [match.users, ...match.match_players.map((p) => p.users)]
    .filter((u) => u.email && u.reminder_enabled);

  await Promise.allSettled(participants.map((p) => resend.emails.send({
    from:    'onboarding@resend.dev',
    to:      p.email!,
    subject: `¡Partido confirmado! — ${match.club}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="background:#84cc16;width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px">
          <span style="font-size:24px;font-weight:800;color:#fff">H</span>
        </div>
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
          ¡Tu partido quedó confirmado!
        </h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
          Hola <strong>${p.name}</strong>, ya se completaron los cupos de este partido.
        </p>
        <div style="background:#f4f4f4;border-radius:12px;padding:16px 20px;margin-bottom:24px">
          <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#111827">${match.club}</p>
          <p style="margin:0;font-size:13px;color:#6b7280">
            📅 ${dateStr} &nbsp;·&nbsp; ⏰ ${timeStr} &nbsp;·&nbsp; 🎾 ${formatStr}
          </p>
        </div>
        <a href="${appUrl}/matches/${matchId}"
           style="display:block;text-align:center;background:#84cc16;color:#fff;font-weight:700;font-size:15px;padding:13px 0;border-radius:10px;text-decoration:none">
          Ver partido →
        </a>
        <p style="font-size:12px;color:#9ca3af;margin-top:20px;text-align:center">
          Puedes desactivar estos avisos desde tu perfil en PadelHub.
        </p>
      </div>
    `,
  })));
}

export async function POST(request: Request, context: Params) {
  try {
    const { id: matchId } = await context.params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const { accept } = await request.json();

    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        match_players: {
          where:   { status: { not: 'removed' } },
          include: { users: { select: { name: true } } },
        },
      },
    });

    if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

    const myEntry = match.match_players.find((p) => p.user_id === userId);
    if (!myEntry)                    return NextResponse.json({ error: 'No tienes invitación para este partido' }, { status: 404 });
    if (myEntry.status !== 'pending') return NextResponse.json({ error: 'Ya respondiste esta invitación' }, { status: 400 });

    await prisma.match_players.update({
      where: { id: myEntry.id },
      data:  { status: accept ? 'confirmed' : 'rejected' },
    });

    if (accept) {
      const maxPlayers    = MAX_PLAYERS[match.format] ?? 4;
      // Solo cuenta jugadores que YA confirmaron (no los que siguen 'pending'):
      // el partido no esta completo mientras falten respuestas.
      const activeAfter   = match.match_players.filter(
        (p) => p.user_id !== userId && p.status === 'confirmed',
      ).length + 1;

      if (activeAfter >= maxPlayers - 1) {
        await prisma.matches.update({
          where: { id: matchId },
          data:  { status: 'confirmed', updated_at: new Date() },
        });
        await notifyMatchConfirmed(matchId);
      }

      await notify(
        match.organizer_id,
        'Invitación aceptada',
        `${myEntry.users.name} aceptó tu invitación en ${match.club}`
      );
    } else {
      await notify(
        match.organizer_id,
        'Desafío rechazado',
        `${myEntry.users.name} rechazó tu invitación en ${match.club}. Busca un nuevo rival en Matchmaking.`
      );
    }

    return NextResponse.json({
      message: accept ? '¡Te has unido al partido!' : 'Invitación rechazada',
    });
  } catch (error) {
    console.error('[MATCH RESPOND ERROR]', error);
    return NextResponse.json({ error: 'Error al responder invitación' }, { status: 500 });
  }
}
