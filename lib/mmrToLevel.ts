type UserLevel = 'primera' | 'segunda' | 'tercera' | 'cuarta' | 'quinta' | 'sexta' | 'septima_mas';

export function mmrToLevel(mmr: number): UserLevel {
  if (mmr >= 3000) return 'primera';
  if (mmr >= 2500) return 'segunda';
  if (mmr >= 2000) return 'tercera';
  if (mmr >= 1500) return 'cuarta';
  if (mmr >= 1000) return 'quinta';
  if (mmr >= 500)  return 'sexta';
  return 'septima_mas';
}
