import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "../../../../lib/jwt";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rut, password } = body;

    if (!rut || !password) {
      return NextResponse.json(
        { error: "El RUT y la contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const player = await prisma.users.findFirst({
      where: { rut: parseInt(rut), is_active: true },
    });

    if (!player) {
      return NextResponse.json(
        { error: "RUT o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, player.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "RUT o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const token = await signToken({ userId: player.id, role: player.role });

    const refreshToken = crypto.randomUUID();
    await prisma.refresh_tokens.create({
      data: {
        user_id: player.id,
        token: refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { password_hash, ...userResponse } = player;

    return NextResponse.json(
      { message: "¡Inicio de sesión exitoso!", user: userResponse, token, refreshToken },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[LOGIN ERROR]", error);
    return NextResponse.json(
      { error: "Error en el servidor al intentar iniciar sesión" },
      { status: 500 }
    );
  }
}
