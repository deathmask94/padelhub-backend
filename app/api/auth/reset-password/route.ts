import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rut, code, new_password } = body;

    if (!rut || !code || !new_password) {
      return NextResponse.json(
        { error: "RUT, código y nueva contraseña son obligatorios" },
        { status: 400 }
      );
    }

    if (new_password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const user = await prisma.users.findFirst({
      where: { rut: parseInt(rut) },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Código inválido o expirado" },
        { status: 400 }
      );
    }

    const resetToken = await prisma.password_reset_tokens.findFirst({
      where: {
        user_id: user.id,
        code,
        used: false,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Código inválido o expirado" },
        { status: 400 }
      );
    }

    const password_hash = await bcrypt.hash(new_password, 10);

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user.id },
        data: { password_hash, updated_at: new Date() },
      }),
      prisma.password_reset_tokens.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);

    return NextResponse.json(
      { message: "Contraseña actualizada correctamente" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al restablecer la contraseña", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}
