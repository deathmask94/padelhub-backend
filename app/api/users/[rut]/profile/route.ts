import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_LEVELS = ["primera", "segunda", "tercera", "cuarta", "quinta", "sexta", "septima_mas"];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildWhere(param: string) {
  return UUID_REGEX.test(param)
    ? { id: param }
    : { rut: parseInt(param) };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ rut: string }> }
) {
  try {
    const { rut } = await context.params;

    const player = await prisma.users.findFirst({ where: buildWhere(rut) });

    if (!player) {
      return NextResponse.json(
        { error: `No se encontró ningún jugador con el identificador ${rut}` },
        { status: 404 }
      );
    }

    const totalMatches = await prisma.match_players.count({
      where: { user_id: player.id },
    });

    const { password_hash, ...userResponse } = player;

    return NextResponse.json(
      {
        profile: {
          id:         userResponse.id,
          name:       userResponse.name,
          rut:        `${userResponse.rut}-${userResponse.dv_rut}`,
          phone:      userResponse.phone,
          zone:       userResponse.zone,
          level:      userResponse.level,
          mmr:        userResponse.mmr,
          photo_url:  userResponse.photo_url,
          created_at: userResponse.created_at,
        },
        stats: { matches_played: totalMatches },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al cargar el perfil", details: error.message },
      { status: 500 }
    );
  }
}

async function handleUpdate(param: string, request: Request) {
  const body = await request.json();
  const { name, phone, zone, level } = body;

  if (!name && !phone && !zone && !level) {
    return NextResponse.json(
      { error: "Debes enviar al menos un campo para actualizar (name, phone, zone, level)" },
      { status: 400 }
    );
  }

  if (level && !VALID_LEVELS.includes(level)) {
    return NextResponse.json(
      { error: `Nivel inválido. Valores permitidos: ${VALID_LEVELS.join(", ")}` },
      { status: 400 }
    );
  }

  const user = await prisma.users.findFirst({ where: buildWhere(param) });

  if (!user) {
    return NextResponse.json(
      { error: `No se encontró ningún jugador con el identificador ${param}` },
      { status: 404 }
    );
  }

  if (phone && phone !== user.phone) {
    const phoneInUse = await prisma.users.findUnique({ where: { phone } });
    if (phoneInUse) {
      return NextResponse.json(
        { error: "El número de teléfono ya está en uso" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.users.update({
    where: { id: user.id },
    data: {
      ...(name  && { name }),
      ...(phone && { phone }),
      ...(zone  && { zone }),
      ...(level && { level }),
      updated_at: new Date(),
    },
  });

  const { password_hash, ...userResponse } = updated;

  return NextResponse.json(
    { message: "Perfil actualizado correctamente", user: userResponse },
    { status: 200 }
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ rut: string }> }
) {
  try {
    const { rut } = await context.params;
    return await handleUpdate(rut, request);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al actualizar el perfil", details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ rut: string }> }
) {
  try {
    const { rut } = await context.params;
    return await handleUpdate(rut, request);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al actualizar el perfil", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET,PATCH,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}
