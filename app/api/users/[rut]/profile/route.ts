import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      matchesPlayed,
      wins,
      rankingPosition,
      totalInZone,
      recentSum,
      chartRaw,
      lastMatchRaw,
    ] = await Promise.all([
      prisma.mmr_history.count({ where: { user_id: player.id } }),
      prisma.mmr_history.count({ where: { user_id: player.id, delta: { gt: 0 } } }),
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
    ]);

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
        matches_played:    matchesPlayed,
        wins,
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
    const { name, zone, reminder_enabled } = body;

    if (!name && !zone && reminder_enabled === undefined) {
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

    const updated = await prisma.users.update({
      where: { id: player.id },
      data: {
        ...(name ? { name } : {}),
        ...(zone ? { zone } : {}),
        ...(reminder_enabled !== undefined ? { reminder_enabled: Boolean(reminder_enabled) } : {}),
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
