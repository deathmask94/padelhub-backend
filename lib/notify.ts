import { prisma } from '@/lib/prisma';
import { sendPush } from '@/lib/push';

export async function notify(userId: string, title: string, body?: string): Promise<void> {
  await Promise.allSettled([
    prisma.notifications.create({ data: { user_id: userId, title, body } }),
    sendPush(userId, title, body),
  ]);
}
