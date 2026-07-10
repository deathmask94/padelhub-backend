import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from '@/lib/prisma';

let app: App | null | undefined; // undefined = aun no se intento inicializar

// Se inicializa perezosamente (no al importar el modulo) para que, mientras
// FIREBASE_SERVICE_ACCOUNT no este configurado, el resto de la app funcione
// exactamente igual y solo el envio de push quede en no-op silencioso.
function getFirebaseApp(): App | null {
  if (app !== undefined) return app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    app = null;
    return app;
  }

  try {
    const credentials = JSON.parse(raw);
    app = initializeApp({ credential: cert(credentials) });
  } catch (e) {
    console.error('[PUSH] FIREBASE_SERVICE_ACCOUNT invalido:', e);
    app = null;
  }
  return app;
}

export async function sendPush(userId: string, title: string, body?: string): Promise<void> {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return; // Firebase no configurado todavia

  const tokens = await prisma.push_tokens.findMany({
    where:  { user_id: userId },
    select: { id: true, token: true },
  });
  if (tokens.length === 0) return;

  const response = await getMessaging(firebaseApp).sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title, body },
  });

  // Los tokens que Firebase marca como no-registrados ya no sirven (app
  // desinstalada, token rotado, etc.): se borran para no seguir intentando.
  const deadTokenIds = response.responses
    .map((r, i) => (!r.success && r.error?.code === 'messaging/registration-token-not-registered' ? tokens[i].id : null))
    .filter((id): id is string => id !== null);

  if (deadTokenIds.length > 0) {
    await prisma.push_tokens.deleteMany({ where: { id: { in: deadTokenIds } } }).catch(() => {});
  }
}
