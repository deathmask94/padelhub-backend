import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token y contraseña son obligatorios' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }

    const resetToken = await prisma.password_reset_tokens.findFirst({
      where: { token, used: false },
      include: { users: true },
    });

    if (!resetToken) {
      return NextResponse.json({ error: 'Token inválido o ya utilizado' }, { status: 400 });
    }

    if (resetToken.expires_at < new Date()) {
      return NextResponse.json({ error: 'El enlace ha expirado. Solicita uno nuevo.' }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    await prisma.$transaction([
      prisma.users.update({
        where: { id: resetToken.user_id },
        data:  { password_hash, updated_at: new Date() },
      }),
      prisma.password_reset_tokens.update({
        where: { id: resetToken.id },
        data:  { used: true },
      }),
      // Invalidar todos los refresh tokens — forzar re-login
      prisma.refresh_tokens.deleteMany({
        where: { user_id: resetToken.user_id },
      }),
    ]);

    return NextResponse.json({ message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
  } catch (error: unknown) {
    console.error('[RESET PASSWORD ERROR]', error);
    return NextResponse.json({ error: 'Error al restablecer la contraseña' }, { status: 500 });
  }
}
