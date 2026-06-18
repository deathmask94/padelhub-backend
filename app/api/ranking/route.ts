import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zone = searchParams.get("zone");

    const users = await prisma.users.findMany({
      where: {
        is_active: true,
        ...(zone ? { zone } : {}),
      },
      orderBy: { mmr: "desc" },
      select: {
        id:      true,
        rut:     true,
        dv_rut:  true,
        name:    true,
        zone:    true,
        level:   true,
        mmr:     true,
        role:    true,
      },
    });

    const ranking = users.map((u, index) => ({
      position: index + 1,
      id:       u.id,
      rut:      u.rut,
      dv_rut:   u.dv_rut,
      name:     u.name,
      zone:     u.zone,
      level:    u.level,
      mmr:      u.mmr,
    }));

    return NextResponse.json(ranking);
  } catch (error: unknown) {
    console.error("[RANKING GET]", error);
    return NextResponse.json({ error: "Error al obtener el ranking" }, { status: 500 });
  }
}
