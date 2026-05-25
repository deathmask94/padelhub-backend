import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ rut: string }> }
) {
  try {
    const { rut } = await context.params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    const where = UUID_REGEX.test(rut) ? { id: rut } : { rut: parseInt(rut) };
    const user = await prisma.users.findFirst({ where });

    if (!user) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
    }

    const invitations = await prisma.match_invitations.findMany({
      where: {
        user_id: user.id,
        ...(status !== "all" && { status: status as any }),
      },
      include: {
        matches: {
          select: {
            id:         true,
            club:       true,
            format:     true,
            status:     true,
            match_date: true,
            match_time: true,
            users:      { select: { id: true, name: true, zone: true } },
          },
        },
        inviter: { select: { id: true, name: true, photo_url: true } },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(invitations);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al obtener las invitaciones", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}
