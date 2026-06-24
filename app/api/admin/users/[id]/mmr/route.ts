import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayload, unauthorizedResponse } from '@/lib/adminGuard';
import { mmrToLevel } from '@/lib/mmrToLevel';
import { Resend } from 'resend';

type Params = { params: Promise<{ id: string }> };

const resend = new Resend(process.env.RESEND_API_KEY);

export async function PATCH(request: Request, { params }: Params) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json() as { new_mmr?: unknown; reason?: unknown };

  const newMmr = Number(body.new_mmr);
  if (!Number.isInteger(newMmr) || newMmr < 0 || newMmr > 9999) {
    return NextResponse.json({ error: 'new_mmr debe ser un entero entre 0 y 9999' }, { status: 400 });
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    return NextResponse.json({ error: 'El motivo del ajuste es requerido' }, { status: 400 });
  }

  const user = await prisma.users.findUnique({
    where:  { id },
    select: { id: true, name: true, email: true, mmr: true },
  });
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const oldMmr = user.mmr;

  await prisma.$transaction([
    prisma.users.update({
      where: { id },
      data:  { mmr: newMmr, level: mmrToLevel(newMmr), updated_at: new Date() },
    }),
    prisma.mmr_history.create({
      data: {
        user_id:    id,
        match_id:   null,
        mmr_before: oldMmr,
        mmr_after:  newMmr,
      },
    }),
    prisma.admin_audit_logs.create({
      data: {
        admin_id: admin.userId,
        action:   'MMR_ADJUST',
        details:  `user=${id} mmr: ${oldMmr}→${newMmr} motivo: ${reason}`,
        ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown',
      },
    }),
  ]);

  // Email al jugador (best-effort)
  if (user.email) {
    const delta  = newMmr - oldMmr;
    const sign   = delta >= 0 ? '+' : '';
    resend.emails.send({
      from:    'onboarding@resend.dev',
      to:      user.email,
      subject: `Tu MMR ha sido ajustado — PadelHub`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <div style="background:#84cc16;width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px">
            <span style="font-size:24px;font-weight:800;color:#fff">H</span>
          </div>
          <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">Ajuste de MMR</h2>
          <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
            Hola <strong>${user.name}</strong>, un administrador realizó un ajuste manual a tu puntuación MMR.
          </p>
          <div style="background:#f4f4f4;border-radius:12px;padding:16px 20px;margin-bottom:24px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="font-size:13px;color:#6b7280">MMR anterior</span>
              <span style="font-size:16px;font-weight:700;color:#111827">${oldMmr}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="font-size:13px;color:#6b7280">MMR nuevo</span>
              <span style="font-size:16px;font-weight:700;color:#111827">${newMmr}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="font-size:13px;color:#6b7280">Variación</span>
              <span style="font-size:16px;font-weight:700;color:${delta >= 0 ? '#16a34a' : '#dc2626'}">${sign}${delta}</span>
            </div>
            <div style="border-top:1px solid #e5e7eb;padding-top:12px">
              <span style="font-size:13px;color:#6b7280">Motivo: </span>
              <span style="font-size:13px;color:#111827">${reason}</span>
            </div>
          </div>
          <p style="font-size:12px;color:#9ca3af;text-align:center">
            Si tienes dudas, puedes contactar al equipo de PadelHub.
          </p>
        </div>
      `,
    }).catch(() => {});
  }

  return NextResponse.json({ message: 'MMR ajustado correctamente', old_mmr: oldMmr, new_mmr: newMmr });
}
