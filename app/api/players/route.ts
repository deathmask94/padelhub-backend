import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ver jugadores
export async function GET() {
  try {
    const players = await prisma.users.findMany();
    return NextResponse.json(players);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Crear un jugador de prueba
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newUser = await prisma.users.create({
      data: {
        rut: body.rut || 12345678,
        dv_rut: body.dv_rut || "9",
        name: body.name || "Jugador de Prueba",
        phone: body.phone || "+56912345678",
        password_hash: "secret",
        zone: "Santiago",
        level: "tercera"
      }
    });
    return NextResponse.json(newUser);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}