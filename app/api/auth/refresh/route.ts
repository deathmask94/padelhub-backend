import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/jwt';

export async function POST(request: Request) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token requerido' }, { status: 400 });
    }

    const stored = await prisma.refresh_tokens.findFirst({
      where: { token: refreshToken },
      include: { users: { select: { id: true, role: true, is_active: true } } },
    });

    if (!stored || stored.expires_at < new Date()) {
      if (stored) {
        await prisma.refresh_tokens.delete({ where: { id: stored.id } });
      }
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }

    if (!stored.users.is_active) {
      await prisma.refresh_tokens.delete({ where: { id: stored.id } });
      return NextResponse.json({ error: 'Cuenta suspendida' }, { status: 403 });
    }

    // Rotar: eliminar el viejo y crear uno nuevo
    await prisma.refresh_tokens.delete({ where: { id: stored.id } });
    const newRefreshToken = crypto.randomUUID();
    await prisma.refresh_tokens.create({
      data: {
        user_id:    stored.user_id,
        token:      newRefreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const token = await signToken({ userId: stored.user_id, role: stored.users.role });

    return NextResponse.json({ token, refreshToken: newRefreshToken });
  } catch (error: unknown) {
    console.error('[REFRESH ERROR]', error);
    return NextResponse.json({ error: 'Error al renovar el token' }, { status: 500 });
  }
}
