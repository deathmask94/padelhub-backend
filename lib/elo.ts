const K = 32;

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export interface PlayerMMR { id: string; mmr: number; }

export interface MMRChange {
  id:     string;
  before: number;
  after:  number;
  delta:  number;
}

export function calculateELO(
  teamA:  PlayerMMR[],
  teamB:  PlayerMMR[],
  winner: 'team_a' | 'team_b',
): MMRChange[] {
  const avgA = teamA.reduce((s, p) => s + p.mmr, 0) / teamA.length;
  const avgB = teamB.reduce((s, p) => s + p.mmr, 0) / teamB.length;

  const expA   = expectedScore(avgA, avgB);
  const expB   = 1 - expA;
  const actA   = winner === 'team_a' ? 1 : 0;
  const actB   = 1 - actA;

  const changes: MMRChange[] = [];

  for (const p of teamA) {
    const delta = Math.round(K * (actA - expA));
    changes.push({ id: p.id, before: p.mmr, after: Math.max(0, p.mmr + delta), delta });
  }
  for (const p of teamB) {
    const delta = Math.round(K * (actB - expB));
    changes.push({ id: p.id, before: p.mmr, after: Math.max(0, p.mmr + delta), delta });
  }

  return changes;
}
