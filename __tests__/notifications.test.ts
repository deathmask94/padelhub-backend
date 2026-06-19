import { GET as getNotificationsHandler, PATCH as patchNotificationsHandler } from "@/app/api/notifications/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/jwt", () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: "mock-user-uuid", role: "player" }),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    notifications: {
      findMany:    jest.fn(),
      updateMany:  jest.fn(),
    },
  },
}));

const mockNotifications = [
  { id: "n1", title: "Te invitaron a un partido", body: "Juan te invitó", read: false, created_at: new Date().toISOString() },
  { id: "n2", title: "Partido cancelado",          body: "El partido fue cancelado", read: true,  created_at: new Date().toISOString() },
  { id: "n3", title: "Resultado registrado",       body: "6-3 vs 3-6",               read: false, created_at: new Date().toISOString() },
];

describe("🔔 PRUEBAS UNITARIAS - NOTIFICACIONES (GET /notifications)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Debería retornar 401 si no se envía token", async () => {
    const req = new Request("http://localhost:3000/api/notifications");
    const res = await getNotificationsHandler(req);
    expect(res.status).toBe(401);
  });

  it("Debería retornar 200 con lista de notificaciones y unread_count correcto", async () => {
    (prisma.notifications.findMany as jest.Mock).mockResolvedValue(mockNotifications);

    const req  = new Request("http://localhost:3000/api/notifications", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res  = await getNotificationsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("notifications");
    expect(data).toHaveProperty("unread_count", 2); // n1 y n3 están sin leer
    expect(data.notifications).toHaveLength(3);
  });

  it("Debería retornar unread_count 0 cuando todas están leídas", async () => {
    (prisma.notifications.findMany as jest.Mock).mockResolvedValue(
      mockNotifications.map((n) => ({ ...n, read: true }))
    );

    const req  = new Request("http://localhost:3000/api/notifications", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res  = await getNotificationsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.unread_count).toBe(0);
  });

  it("Debería retornar lista vacía si no hay notificaciones", async () => {
    (prisma.notifications.findMany as jest.Mock).mockResolvedValue([]);

    const req  = new Request("http://localhost:3000/api/notifications", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res  = await getNotificationsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notifications).toHaveLength(0);
    expect(data.unread_count).toBe(0);
  });
});

describe("✅ PRUEBAS UNITARIAS - NOTIFICACIONES (PATCH /notifications)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Debería retornar 401 si no se envía token", async () => {
    const req = new Request("http://localhost:3000/api/notifications", { method: "PATCH" });
    const res = await patchNotificationsHandler(req);
    expect(res.status).toBe(401);
  });

  it("Debería retornar 200 al marcar todas las notificaciones como leídas", async () => {
    (prisma.notifications.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

    const req  = new Request("http://localhost:3000/api/notifications", {
      method:  "PATCH",
      headers: { Authorization: "Bearer valid-token" },
    });
    const res  = await patchNotificationsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toMatch(/leídas/i);
    expect(prisma.notifications.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: "mock-user-uuid", read: false }, data: { read: true } })
    );
  });
});
