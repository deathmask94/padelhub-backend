import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import { Resend } from 'resend';
import { notify } from '@/lib/notify';
import { pickAutoTeam } from '@/lib/teamAssignment';

type Params = { params: Promise<{ id: string }> };

const resend = new Resend(process.env.RESEND_API_KEY);
const MAX_PLAYERS: Record<string, number> = { doubles: 4, singles: 2 };

const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function formatDate(d: Date) { return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`; }
function formatTime(d: Date) { return d.toISOString().substring(11, 16); }

export async function POST(request: Request, context: Params) {
  try {
    const { id: matchId } = await context.params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const body = await request.json();
    const invitedUserId: string = body.userId;
    const team: 'team_a' | 'team_b' | undefined = body.team;
    if (!invitedUserId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    if (team && team !== 'team_a' && team !== 'team_b') {
      return NextResponse.json({ error: "team debe ser 'team_a' o 'team_b'" }, { status: 400 });
    }

    const match = await prisma.matches.findUnique({
      where:   { id: matchId },
      include: {
        match_players: {
          where:   { status: { not: 'removed' } },
          include: { users: { select: { gender: true } } },
        },
        users: { select: { name: true } },
      },
    });

    if (!match)                        return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
    if (match.organizer_id !== userId) return NextResponse.json({ error: 'Solo el organizador puede invitar' }, { status: 403 });
    if (match.status !== 'open')       return NextResponse.json({ error: 'El partido no está abierto' }, { status: 400 });
    if (invitedUserId === userId)      return NextResponse.json({ error: 'No puedes invitarte a ti mismo' }, { status: 400 });

    const alreadyIn = match.match_players.some((p) => p.user_id === invitedUserId);
    if (alreadyIn) return NextResponse.json({ error: 'Este jugador ya está en el partido' }, { status: 400 });

    // Se busca aca (no mas abajo, solo para el email) para poder validar el
    // genero antes de invitar: la restriccion de "quien puede unirse" debe
    // aplicar igual si entran solos o si el organizador los invita a mano,
    // si no el filtro de genero de los cupos abiertos queda sin sentido.
    const invited = await prisma.users.findUnique({
      where:  { id: invitedUserId },
      select: { name: true, email: true, gender: true },
    });

    if (match.gender_preference && invited?.gender !== match.gender_preference) {
      const label = match.gender_preference === 'Masculino' ? 'hombres' : 'mujeres';
      return NextResponse.json({ error: `Este partido es solo para ${label}` }, { status: 403 });
    }

    const maxPlayers = MAX_PLAYERS[match.format] ?? 4;
    if (match.match_players.length >= maxPlayers - 1) {
      return NextResponse.json({ error: 'El partido ya está completo' }, { status: 400 });
    }

    if (team) {
      const maxPerTeam = Math.floor(maxPlayers / 2);
      const teamCount  = match.match_players.filter((p) => p.team === team).length;
      if (teamCount >= maxPerTeam) {
        return NextResponse.json({ error: 'Ese equipo ya está completo' }, { status: 400 });
      }
    }

    // upsert (no create): si esta persona ya estuvo en el partido y lo
    // abandono (status 'removed'), la fila (match_id, user_id) sigue
    // existiendo por la restriccion unica -- create() chocaria con ella.
    // Sin equipo explicito ("Automatico"), se arma balanceado: por cupo si
    // todos son del mismo sexo, o emparejando 1 hombre + 1 mujer por
    // equipo si el partido termina siendo mixto.
    const assignedTeam = team ?? pickAutoTeam(
      match.match_players.map((p) => ({ team: p.team, gender: p.users.gender })),
      invited?.gender,
    );
    const player = await prisma.match_players.upsert({
      where:  { match_id_user_id: { match_id: matchId, user_id: invitedUserId } },
      update: { status: 'pending', team: assignedTeam, joined_at: new Date() },
      create: {
        match_id: matchId,
        user_id:  invitedUserId,
        team:     assignedTeam,
        status:   'pending',
      },
    });

    // Notificación por email (best-effort)
    if (invited?.email) {
      const dateStr   = formatDate(new Date(match.match_date));
      const timeStr   = formatTime(new Date(match.match_time));
      const formatStr = match.format === 'doubles' ? 'Dobles (2v2)' : 'Individual (1v1)';
      const appUrl    = process.env.FRONTEND_URL ?? 'http://localhost:5173';

      resend.emails.send({
        from:    'onboarding@resend.dev',
        to:      invited.email,
        subject: `${match.users.name} te invitó a un partido — ${match.club}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <div style="background:#84cc16;width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px">
              <span style="font-size:24px;font-weight:800;color:#fff">H</span>
            </div>
            <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
              ¡Tienes una invitación!
            </h2>
            <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
              Hola <strong>${invited.name}</strong>,
              <strong>${match.users.name}</strong> te invitó a jugar un partido.
            </p>
            <div style="background:#f4f4f4;border-radius:12px;padding:16px 20px;margin-bottom:24px">
              <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#111827">${match.club}</p>
              <p style="margin:0;font-size:13px;color:#6b7280">
                📅 ${dateStr} &nbsp;·&nbsp; ⏰ ${timeStr} &nbsp;·&nbsp; 🎾 ${formatStr}
              </p>
            </div>
            <a href="${appUrl}/matches/${matchId}"
               style="display:block;text-align:center;background:#84cc16;color:#fff;font-weight:700;font-size:15px;padding:13px 0;border-radius:10px;text-decoration:none">
              Ver invitación →
            </a>
            <p style="font-size:12px;color:#9ca3af;margin-top:20px;text-align:center">
              Puedes aceptar o rechazar desde la app PadelHub.
            </p>
          </div>
        `,
      }).catch(() => {}); // best-effort, nunca bloquea la respuesta
    }

    await notify(invitedUserId, `Te invitaron a un partido`, `${match.users.name} te invitó a jugar en ${match.club}`);

    return NextResponse.json({ message: 'Invitación enviada', player }, { status: 201 });
  } catch (error) {
    console.error('[MATCH INVITE ERROR]', error);
    return NextResponse.json({ error: 'Error al invitar jugador' }, { status: 500 });
  }
}
