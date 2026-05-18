import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; 

// ==========================================
// 1. POST: Crear un nuevo partido
// ==========================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizer_id, club, format, match_date, match_time } = body;

    // Validación básica de campos obligatorios
    if (!organizer_id || !club || !match_date || !match_time) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (organizer_id, club, match_date, match_time)" },
        { status: 400 }
      );
    }

    // Convertir los strings de fecha y hora a formatos aceptados por Prisma/PostgreSQL
    const formattedDate = new Date(match_date);
    const formattedTime = new Date(`${match_date}T${match_time}`);

    // Crear el partido en la base de datos
    const newMatch = await prisma.matches.create({
      data: {
        organizer_id,
        club,
        format: format || "doubles", // Si no viene, por defecto es doubles
        status: "open",             // Estado inicial siempre abierto
        match_date: formattedDate,
        match_time: formattedTime,
      },
    });

    return NextResponse.json(
      { message: "¡Partido creado con éxito!", match: newMatch },
      { status: 201 }
    );

  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al crear el partido en el servidor", details: error.message },
      { status: 500 }
    );
  }
}

// ==========================================
// 2. GET: Obtener todos los partidos disponibles
// ==========================================
export async function GET() {
  try {
    const allMatches = await prisma.matches.findMany({
      include: {
        users: { // Trae los datos básicos del organizador
          select: { name: true, phone: true }
        }
      },
      orderBy: { match_date: "asc" },
    });
    return NextResponse.json(allMatches);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al obtener los partidos", details: error.message },
      { status: 500 }
    );
  }
}