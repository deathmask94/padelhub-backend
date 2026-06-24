type UserLevel = 'primera' | 'segunda' | 'tercera' | 'cuarta' | 'quinta' | 'sexta' | 'septima_mas';

export function mmrToLevel(mmr: number): UserLevel {
  if (mmr >= 2000) return 'primera';
  if (mmr >= 1600) return 'segunda';
  if (mmr >= 1000) return 'tercera';
  if (mmr >= 800)  return 'cuarta';
  if (mmr >= 600)  return 'quinta';
  if (mmr >= 400)  return 'sexta';
  return 'septima_mas';
}
