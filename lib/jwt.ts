import { SignJWT, jwtVerify } from 'jose';

// Sin fallback: si JWT_SECRET no esta seteado, mejor que la app truene de
// inmediato a que emita/valide tokens con un secreto publico conocido.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET no esta configurado. La app no puede arrancar sin el.');
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function signToken(
  payload:   { userId: string; role: string },
  expiresIn: string = '15m',
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as { userId: string; role: string; iat: number; exp: number };
}
