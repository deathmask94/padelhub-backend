import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  context: { params: Promise<{ rut: string }> } //  Forzamos a Next.js a tratar params de forma segura
) {
  try {
    // 1. Esperamos a que los parámetros de la URL se resuelvan por completo
    const { rut } = await context.params;

    if (!rut) {
      return NextResponse.json(
        { error: "El RUT es requerido en la URL" },
        { status: 400 }
      );
    }

    // 2. Buscar al usuario por su RUT
    const player = await prisma.users.findFirst({
      where: {
        rut: parseInt(rut),
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: `No se encontró ningún jugador con el RUT ${rut}` },
        { status: 404 }
      );
    }

    // 3. Contar cuántos partidos ha jugado
    const totalMatches = await prisma.match_players.count({
      where: {
        user_id: player.id,
      },
    });

    // 4. Limpiar datos sensibles
    const { password_hash, ...userResponse } = player;

    // 5. Enviar la respuesta estructurada para el front
    return NextResponse.json(
      {
        profile: {
          id: userResponse.id,
          name: userResponse.name,
          rut: `${userResponse.rut}-${userResponse.dv_rut}`,
          phone: userResponse.phone,
          zone: userResponse.zone,
          level: userResponse.level,
          mmr: userResponse.mmr,
          created_at: userResponse.created_at,
        },
        stats: {
          matches_played: totalMatches,
        }
      },
      { status: 200 }
    );

  } catch (error: any) {
    return NextResponse.json(
      { error: "Error en el servidor al cargar el perfil", details: error.message },
      { status: 500 }
    );
  }
}
