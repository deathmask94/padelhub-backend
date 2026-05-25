import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendSMSOTP } from "../../../../lib/twilio";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rut } = body;

    if (!rut) {
      return NextResponse.json(
        { error: "El RUT es obligatorio" },
        { status: 400 }
      );
    }

    const user = await prisma.users.findFirst({
      where: { rut: parseInt(rut) },
      select: { id: true, phone: true, name: true },
    });

    // Respuesta genérica para no revelar si el RUT existe o no
    const genericResponse = NextResponse.json(
      { message: "Si el RUT está registrado, recibirás un código por WhatsApp." },
      { status: 200 }
    );

    if (!user) return genericResponse;

    // Invalidar tokens anteriores no usados del mismo usuario
    await prisma.password_reset_tokens.updateMany({
      where: { user_id: user.id, used: false },
      data: { used: true },
    });

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await prisma.password_reset_tokens.create({
      data: {
        user_id: user.id,
        code,
        expires_at: expiresAt,
      },
    });

    await sendSMSOTP(user.phone, code);

    return genericResponse;
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al procesar la solicitud", details: error.message },
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
