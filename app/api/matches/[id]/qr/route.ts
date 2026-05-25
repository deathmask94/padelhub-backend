import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

const SECRET = process.env.MATCH_QR_SECRET ?? "dev-secret-change-in-prod";
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos

export function buildToken(matchId: string, expiresAt: number): string {
  const payload = `${matchId}.${expiresAt}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: match_id } = await context.params;
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get("user_id");

    if (!user_id) {
      return NextResponse.json({ error: "El campo user_id es obligatorio" }, { status: 400 });
    }

    const match = await prisma.matches.findUnique({
      where: { id: match_id },
      select: { id: true, organizer_id: true, status: true },
    });

    if (!match) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    if (match.organizer_id !== user_id) {
      return NextResponse.json(
        { error: "Solo el organizador puede generar el QR" },
        { status: 403 }
      );
    }

    if (!["confirmed", "open"].includes(match.status)) {
      return NextResponse.json(
        { error: "El partido debe estar confirmado para generar el QR" },
        { status: 400 }
      );
    }

    const expiresAt = Date.now() + TOKEN_TTL_MS;
    const token = buildToken(match_id, expiresAt);

    return NextResponse.json({
      token,
      expires_at: new Date(expiresAt).toISOString(),
      // El front renderiza este valor como QR con cualquier librería de QR
      qr_payload: `padelhub://confirm-presence?match_id=${match_id}&token=${token}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al generar el QR", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}
