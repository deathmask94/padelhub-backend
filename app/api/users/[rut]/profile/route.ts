import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ rut: string }> };

export async function GET(_request: Request, context: Params) {
  try {
    const { rut } = await context.params;

    const player = await prisma.users.findFirst({
      where: { rut: parseInt(rut) },
    });

    if (!player) {
      return NextResponse.json(
        { error: `No se encontró ningún jugador con el RUT ${rut}` },
        { status: 404 }
      );
    }

    const totalMatches = await prisma.match_players.count({
      where: { user_id: player.id },
    });

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
        created_at: userResponse.created_at,
      },
      stats: { matches_played: totalMatches },
    });
  } catch (error: unknown) {
    console.error("[PROFILE GET]", error);
    return NextResponse.json({ error: "Error al cargar el perfil" }, { status: 500 });
  }
}

const VALID_LEVELS = ["primera","segunda","tercera","cuarta","quinta","sexta","septima_mas"];

export async function PUT(request: Request, context: Params) {
  try {
    const { rut } = await context.params;
    const body = await request.json();
    const { name, zone, level } = body;

    if (!name && !zone && !level) {
      return NextResponse.json(
        { error: "Debes enviar al menos un campo para actualizar" },
        { status: 400 }
      );
    }

    if (level && !VALID_LEVELS.includes(level)) {
      return NextResponse.json(
        { error: `Nivel inválido. Valores permitidos: ${VALID_LEVELS.join(", ")}` },
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
        ...(name  ? { name }  : {}),
        ...(zone  ? { zone }  : {}),
        ...(level ? { level } : {}),
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
