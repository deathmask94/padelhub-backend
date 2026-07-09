export function normalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Acepta el numero con o sin +56/569 y siempre lo guarda como +56 + 9 digitos.
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const nineDigits = digits.startsWith('56') ? digits.slice(2) : digits;
  if (!/^9\d{8}$/.test(nineDigits)) return null;
  return `+56${nineDigits}`;
}

// Unicidad insensible a mayusculas: se guarda siempre en minuscula con "@" al inicio.
export function normalizeUsername(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/^@+/, '');
  if (!/^[a-z0-9._]{3,24}$/.test(cleaned)) return null;
  return `@${cleaned}`;
}
