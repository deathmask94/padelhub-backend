import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 });
    }

    const user = await prisma.users.findFirst({
      where: { email: email.toLowerCase().trim() },
    });

    // Respuesta genérica siempre — no revelar si el email existe o no
    if (!user) {
      return NextResponse.json({
        message: 'Si el email está registrado, recibirás un correo con instrucciones.',
      });
    }

    // Invalidar tokens anteriores del usuario
    await prisma.password_reset_tokens.updateMany({
      where: { user_id: user.id, used: false },
      data:  { used: true },
    });

    const token = crypto.randomUUID();
    await prisma.password_reset_tokens.create({
      data: {
        user_id:    user.id,
        token,
        expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutos
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to:   user.email!,
      subject: 'Recupera tu contraseña — PadelHub',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f4f4f4;border-radius:16px;">
          <h2 style="font-size:22px;font-weight:800;color:#111827;margin-bottom:8px;">Recuperar contraseña</h2>
          <p style="font-size:14px;color:#6b7280;margin-bottom:24px;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta en PadelHub.
            El enlace expira en <strong>15 minutos</strong>.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#84cc16;color:#fff;font-weight:700;font-size:15px;
                    padding:14px 28px;border-radius:12px;text-decoration:none;">
            Restablecer contraseña
          </a>
          <p style="font-size:12px;color:#9ca3af;margin-top:24px;">
            Si no solicitaste esto, ignora este correo. Tu contraseña no cambiará.
          </p>
        </div>
      `,
    });

    return NextResponse.json({
      message: 'Si el email está registrado, recibirás un correo con instrucciones.',
    });
  } catch (error: unknown) {
    console.error('[FORGOT PASSWORD ERROR]', error);
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
  }
}
