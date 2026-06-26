import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const club = searchParams.get("club");
  const date = searchParams.get("date"); // YYYY-MM-DD

  if (!club || !date) {
    return NextResponse.json({ error: "club y date son requeridos" }, { status: 400 });
  }

  const dateFrom = new Date(`${date}T00:00:00Z`);
  const dateTo   = new Date(`${date}T23:59:59Z`);

  const taken = await prisma.matches.findMany({
    where: {
      club,
      match_date: { gte: dateFrom, lte: dateTo },
      status:     { not: "cancelled" },
    },
    select: { match_time: true },
  });

  // Extract HH:MM from match_time (stored as Time, returned as Date-like)
  const takenSlots = taken.map((m) => {
    const t = m.match_time;
    const h = String(t.getUTCHours()).padStart(2, "0");
    const min = String(t.getUTCMinutes()).padStart(2, "0");
    return `${h}:${min}`;
  });

  return NextResponse.json({ takenSlots });
}
