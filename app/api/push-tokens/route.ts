import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

export async function POST(request: Request) {
  try {
    const auth  = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const body: { token?: string; platform?: string } = await request.json();
    const pushToken = body.token?.trim();
    const platform  = body.platform === 'ios' ? 'ios' : 'android';
    if (!pushToken) return NextResponse.json({ error: 'token requerido' }, { status: 400 });

    // Upsert por token (no por usuario): el mismo dispositivo puede haber
    // quedado registrado a otra cuenta si alguien mas inicio sesion ahi antes.
    await prisma.push_tokens.upsert({
      where:  { token: pushToken },
      update: { user_id: userId, platform },
      create: { user_id: userId, token: pushToken, platform },
    });

    return NextResponse.json({ message: 'Token registrado' }, { status: 201 });
  } catch (error) {
    console.error('[PUSH TOKENS POST]', error);
    return NextResponse.json({ error: 'Error al registrar el token' }, { status: 500 });
  }
}
