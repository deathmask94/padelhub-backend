import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName, normalizeUsername } from "@/lib/normalize";

const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

type Params = { params: Promise<{ rut: string }> };

export async function GET(_request: Request, context: Params) {
  try {
    const { rut } = await context.params;

    const player = await prisma.users.findFirst({ where: { rut: parseInt(rut) } });
    if (!player) {
      return NextResponse.json(
        { error: `No se encontró ningún jugador con el RUT ${rut}` },
        { status: 404 }
      );
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      rankingPosition,
      totalInZone,
      recentSum,
      chartRaw,
      lastMatchRaw,
      finishedMatches,
    ] = await Promise.all([
      prisma.users.count({ where: { zone: player.zone, mmr: { gt: player.mmr } } }),
      prisma.users.count({ where: { zone: player.zone } }),
      prisma.mmr_history.aggregate({
        where: { user_id: player.id, calculated_at: { gte: thirtyDaysAgo } },
        _sum: { delta: true },
      }),
      prisma.mmr_history.findMany({
        where:   { user_id: player.id },
        orderBy: { calculated_at: 'desc' },
        take:    7,
        select:  { mmr_after: true },
      }),
      prisma.mmr_history.findMany({
        where:   { user_id: player.id },
        orderBy: { calculated_at: 'desc' },
        take:    5,
        include: { matches: { select: { club: true, match_date: true } } },
      }),
      // Partidos/victorias/derrotas se calculan directo desde matches +
      // match_results (no desde mmr_history, que tambien registra ajustes
      // manuales de admin y no representa 1:1 partidos jugados). Se separan
      // por is_ranked: "competitivo" vs "casual" (dobles siempre cae aca).
      prisma.matches.findMany({
        where: {
          status: 'finished',
          OR: [
            { organizer_id: player.id },
            { match_players: { some: { user_id: player.id, status: 'confirmed' } } },
          ],
        },
        select: {
          is_ranked:      true,
          organizer_id:   true,
          organizer_team: true,
          match_results:  { select: { winner: true } },
          match_players:  { where: { user_id: player.id }, select: { team: true } },
        },
      }),
    ]);

    const competitive = { played: 0, wins: 0, losses: 0 };
    const casual      = { played: 0, wins: 0, losses: 0 };
    for (const m of finishedMatches) {
      if (!m.match_results) continue;
      const myTeam = m.organizer_id === player.id ? m.organizer_team : m.match_players[0]?.team;
      const won    = !!myTeam && myTeam === m.match_results.winner;
      const bucket = m.is_ranked ? competitive : casual;
      bucket.played += 1;
      if (won) bucket.wins += 1; else bucket.losses += 1;
    }

    const { password_hash, ...userResponse } = player;

    return NextResponse.json({
      profile: {
        id:         userResponse.id,
        name:       userResponse.name,
        rut:        `${userResponse.rut}-${userResponse.dv_rut}`,
        phone:      userResponse.phone,
        photo_url:  userResponse.photo_url,
        zone:       userResponse.zone,
        level:      userResponse.level,
        mmr:        userResponse.mmr,
        birth_date: userResponse.birth_date ?? null,
        created_at: userResponse.created_at,
      },
      stats: {
        competitive,
        casual,
        ranking_position:  rankingPosition + 1,
        total_in_zone:     totalInZone,
        mmr_variation_30d: recentSum._sum.delta ?? 0,
        mmr_chart:         chartRaw.reverse().map((h) => h.mmr_after),
        last_matches:      lastMatchRaw.map((h) => ({
          club:  h.matches?.club ?? null,
          date:  h.matches?.match_date ?? null,
          delta: h.delta,
          win:   h.delta > 0,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("[PROFILE GET]", error);
    return NextResponse.json({ error: "Error al cargar el perfil" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: Params) {
  try {
    const { rut } = await context.params;
    const body = await request.json();
    const { name, zone, reminder_enabled, username } = body;

    const VALID_ZONES = ["Viña del Mar", "Valparaíso", "Quilpué", "Villa Alemana", "Concón"];
    if (zone && !VALID_ZONES.includes(zone)) {
      return NextResponse.json({ error: "Zona no válida" }, { status: 400 });
    }

    if (name) {
      const nameLength = normalizeName(name).length;
      if (nameLength < 7) {
        return NextResponse.json({ error: "Nombre y apellido demasiado corto" }, { status: 400 });
      }
      if (nameLength > 25) {
        return NextResponse.json({ error: "Nombre y apellido demasiado largo" }, { status: 400 });
      }
    }

    let normalizedUsername: string | null = null;
    if (username) {
      normalizedUsername = normalizeUsername(username);
      if (!normalizedUsername) {
        return NextResponse.json(
          { error: "El usuario debe tener 3-24 caracteres: letras, números, puntos o guión bajo" },
          { status: 400 }
        );
      }
    }

    if (!name && !zone && reminder_enabled === undefined && !normalizedUsername) {
      return NextResponse.json(
        { error: "Debes enviar al menos un campo para actualizar" },
        { status: 400 }
      );
    }

    const player = await prisma.users.findFirst({
      where: { rut: parseInt(rut) },
    });

    if (!player) {
      return NextResponse.json(
        { error: `No se encontró ningún jugador con el RUT ${rut}` },
        { status: 404 }
      );
    }

    if (normalizedUsername && normalizedUsername !== player.username) {
      if (player.username_changed_at) {
        const nextAllowed = new Date(player.username_changed_at.getTime() + USERNAME_COOLDOWN_MS);
        if (nextAllowed > new Date()) {
          return NextResponse.json(
            { error: `Solo puedes cambiar tu usuario una vez al mes. Podrás cambiarlo de nuevo el ${nextAllowed.toLocaleDateString("es-CL")}.` },
            { status: 400 }
          );
        }
      }
      const taken = await prisma.users.findUnique({ where: { username: normalizedUsername } });
      if (taken && taken.id !== player.id) {
        return NextResponse.json({ error: "Ese nombre de usuario ya está en uso" }, { status: 400 });
      }
    }

    const updated = await prisma.users.update({
      where: { id: player.id },
      data: {
        ...(name ? { name: normalizeName(name) } : {}),
        ...(zone ? { zone } : {}),
        ...(reminder_enabled !== undefined ? { reminder_enabled: Boolean(reminder_enabled) } : {}),
        ...(normalizedUsername && normalizedUsername !== player.username
          ? { username: normalizedUsername, username_changed_at: new Date() }
          : {}),
        updated_at: new Date(),
      },
    });

    const { password_hash, ...userResponse } = updated;
    return NextResponse.json({ user: userResponse });
  } catch (error: unknown) {
    console.error("[PROFILE PUT]", error);
    return NextResponse.json({ error: "Error al actualizar el perfil" }, { status: 500 });
  }
}
