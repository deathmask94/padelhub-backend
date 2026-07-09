import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/jwt';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { rut, password } = await request.json();
    if (!rut || !password) {
      return NextResponse.json({ error: 'RUT y contraseña requeridos' }, { status: 400 });
    }

    const user = await prisma.users.findFirst({
      where: { rut: parseInt(rut), is_active: true, role: 'admin' },
    });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: 'Credenciales inválidas o sin permisos de administrador' }, { status: 401 });
    }

    // JWT de 4 horas — sin refresh token para admin
    const token = await signToken({ userId: user.id, role: user.role }, '4h');

    const ip = request.headers.get('x-forwarded-for')
      ?? request.headers.get('x-real-ip')
      ?? 'unknown';

    await prisma.admin_audit_logs.create({
      data: {
        admin_id: user.id,
        action:   'ADMIN_LOGIN',
        details:  `Acceso desde ${ip}`,
        ip,
      },
    });

    const { password_hash, ...safe } = user;
    return NextResponse.json({ token, user: safe });
  } catch (error) {
    console.error('[ADMIN LOGIN ERROR]', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}
