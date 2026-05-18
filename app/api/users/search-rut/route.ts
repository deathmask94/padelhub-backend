import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; 

export async function GET(request: Request) {
  try {
    // Capturamos el parámetro ?rut=... de la URL
    const { searchParams } = new URL(request.url);
    const rutParam = searchParams.get("rut");

    if (!rutParam) {
      return NextResponse.json(
        { error: "Falta el parámetro 'rut'. Ejemplo: /api/users/by-rut?rut=12345678" },
        { status: 400 }
      );
    }

    // Buscamos al jugador por su RUT
    const player = await prisma.users.findFirst({
      where: {
        rut: parseInt(rutParam),
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: `No se encontró ningún jugador con el RUT ${rutParam}` },
        { status: 404 }
      );
    }

    // Ocultamos la contraseña por seguridad
    const { password_hash, ...userResponse } = player;
    return NextResponse.json(userResponse, { status: 200 });

  } catch (error: any) {
    return NextResponse.json(
      { error: "Error en el servidor al buscar el jugador", details: error.message },
      { status: 500 }
    );
  }
}