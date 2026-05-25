import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_SMS_FROM!; // ej: "+15005550006"

const client = twilio(accountSid, authToken);

export async function sendSMSOTP(toPhone: string, code: string): Promise<void> {
  await client.messages.create({
    from: fromNumber,
    to: toPhone,
    body: `PadelHub: Tu código de recuperación es ${code}. Expira en 10 minutos.`,
  });
}
