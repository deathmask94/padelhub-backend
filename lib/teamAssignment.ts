type Team = 'team_a' | 'team_b';

interface ActivePlayer {
  team: string;
  gender: string | null;
}

// Asignacion automatica de equipo en dobles ("Automatico"): si todos los
// jugadores hasta ahora son del mismo sexo, solo importa balancear el
// cupo. Pero si el partido termina siendo mixto (hombres y mujeres),
// cada equipo debe quedar con un hombre y una mujer -- nunca dos del
// mismo sexo juntos -- por equidad/nivelacion.
export function pickAutoTeam(existing: ActivePlayer[], newGender: string | null | undefined): Team {
  const teamACount = existing.filter((p) => p.team === 'team_a').length;
  const teamBCount = existing.filter((p) => p.team === 'team_b').length;
  const byCount = (): Team => (teamACount <= teamBCount ? 'team_a' : 'team_b');

  const knownGenders = existing.map((p) => p.gender).filter((g): g is string => !!g);
  const allSameSexSoFar = knownGenders.length > 0 && knownGenders.every((g) => g === knownGenders[0]);

  // Sin genero del nuevo jugador, o todavia no hay mezcla de sexos: no hay
  // nada que equilibrar por genero, solo por cupo.
  if (!newGender || knownGenders.length === 0 || (allSameSexSoFar && knownGenders[0] === newGender)) {
    return byCount();
  }

  // Partido mixto: buscar un equipo con un jugador de sexo opuesto y cupo
  // libre (max 2 por equipo) para completar la pareja.
  const teams: Team[] = ['team_a', 'team_b'];
  const opposite = teams.find((t) => {
    const teamPlayers = existing.filter((p) => p.team === t);
    return teamPlayers.length === 1 && teamPlayers[0].gender && teamPlayers[0].gender !== newGender;
  });
  if (opposite) return opposite;

  // Si no hay equipo esperando con sexo opuesto, usar un equipo vacio.
  const empty = teams.find((t) => existing.filter((p) => p.team === t).length === 0);
  if (empty) return empty;

  return byCount();
}
