import { prisma } from '@/lib/prisma';

export function notify(userId: string, title: string, body?: string) {
  prisma.notifications.create({
    data: { user_id: userId, title, body },
  }).catch(() => {});
}
