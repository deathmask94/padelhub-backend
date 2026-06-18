import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/jwt";

export async function GET() {
  try {
    const players = await prisma.users.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        rut: true,
        dv_rut: true,
        phone: true,
        name: true,
        photo_url: true,
        level: true,
        zone: true,
        mmr: true,
        role: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });
    return NextResponse.json(players);
  } catch (error: unknown) {
    console.error("[USERS GET ERROR]", error);
    return NextResponse.json(
      { error: "Error al obtener usuarios" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rut, dv_rut, phone, name, password, zone } = body;

    if (!rut || !dv_rut || !phone || !name || !password || !zone) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios en el formulario" },
        { status: 400 }
      );
    }

    const existingPhone = await prisma.users.findUnique({ where: { phone } });
    if (existingPhone) {
      return NextResponse.json(
        { error: "El número de teléfono ya se encuentra registrado" },
        { status: 400 }
      );
    }

    const existingRut = await prisma.users.findFirst({
      where: {
        rut: parseInt(rut),
        dv_rut: dv_rut.toString().toUpperCase(),
      },
    });
    if (existingRut) {
      return NextResponse.json(
        { error: "El RUT ingresado ya se encuentra registrado" },
        { status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.users.create({
      data: {
        rut: parseInt(rut),
        dv_rut: dv_rut.toString().toUpperCase(),
        phone,
        name,
        password_hash: hashedPassword,
        zone,
      },
    });

    const token = await signToken({ userId: newUser.id, role: newUser.role });

    const refreshToken = crypto.randomUUID();
    await prisma.refresh_tokens.create({
      data: {
        user_id:    newUser.id,
        token:      refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { password_hash, ...userResponse } = newUser;

    return NextResponse.json(
      { message: "¡Jugador registrado con éxito!", user: userResponse, token, refreshToken },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("[USERS POST ERROR]", error);
    return NextResponse.json(
      { error: "Hubo un fallo en el servidor al registrar" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { rut } = body;

    if (!rut) {
      return NextResponse.json(
        { error: "Falta el campo 'rut' en el cuerpo de la petición" },
        { status: 400 }
      );
    }

    const userExists = await prisma.users.findFirst({
      where: { rut: parseInt(rut) },
    });

    if (!userExists) {
      return NextResponse.json(
        { error: `No se encontró ningún jugador con el RUT ${rut}` },
        { status: 404 }
      );
    }

    await prisma.users.delete({ where: { id: userExists.id } });

    return NextResponse.json(
      { message: `Jugador '${userExists.name}' eliminado con éxito` },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[USERS DELETE ERROR]", error);
    return NextResponse.json(
      { error: "No se pudo eliminar al jugador" },
      { status: 500 }
    );
  }
}
