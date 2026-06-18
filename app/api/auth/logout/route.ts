import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { verifyToken } from '../../../../lib/jwt';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token) {
      try {
        const payload = await verifyToken(token);
        await prisma.refresh_tokens.deleteMany({
          where: { user_id: payload.userId },
        });
      } catch {
        // Token inválido — igual limpiamos por userId si viene en body
      }
    }

    return NextResponse.json(
      { success: true, message: 'Sesión cerrada correctamente.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[LOGOUT ERROR]', error);
    return NextResponse.json(
      { message: 'Error interno al intentar cerrar la sesión' },
      { status: 500 }
    );
  }
}
