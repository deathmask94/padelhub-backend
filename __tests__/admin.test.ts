import { POST as adminLoginHandler } from "@/app/api/admin/login/route";
import { PATCH as patchMmrHandler  } from "@/app/api/admin/users/[id]/mmr/route";
import { GET   as metricsHandler   } from "@/app/api/admin/metrics/route";
import { GET   as auditLogsHandler } from "@/app/api/admin/audit-logs/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// ── Mocks globales ───────────────────────────────────────────────────────────
jest.mock("@/lib/prisma", () => ({
  prisma: {
    users: {
      findFirst:  jest.fn(),
      findUnique: jest.fn(),
      update:     jest.fn(),
      count:      jest.fn(),
      aggregate:  jest.fn(),
      groupBy:    jest.fn(),
    },
    matches: {
      count: jest.fn(),
    },
    admin_audit_logs: {
      create:   jest.fn(),
      count:    jest.fn(),
      findMany: jest.fn(),
    },
    mmr_history: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash:    jest.fn(),
  genSalt: jest.fn().mockResolvedValue("salt"),
}));

jest.mock("@/lib/jwt", () => ({
  signToken: jest.fn().mockResolvedValue("mock-admin-jwt"),
  verifyToken: jest.fn().mockResolvedValue({ userId: "admin-uuid", role: "admin" }),
}));

jest.mock("@/lib/adminGuard", () => ({
  getAdminPayload: jest.fn().mockResolvedValue({ userId: "admin-uuid", role: "admin" }),
  unauthorizedResponse: jest.fn(() =>
    new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 })
  ),
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({}) },
  })),
}));

// ── Admin Login ──────────────────────────────────────────────────────────────
describe("🛡️ PRUEBAS UNITARIAS - ADMIN LOGIN (POST /admin/login)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Debería retornar 200 con token JWT al autenticar correctamente al administrador", async () => {
    const hash = await bcrypt.hash("admin123", 10);

    (prisma.users.findFirst as jest.Mock).mockResolvedValue({
      id: "admin-uuid", rut: 99999999, name: "Admin PadelHub",
      email: "admin@padelhub.cl", role: "admin", is_active: true, password_hash: hash,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (prisma.admin_audit_logs.create as jest.Mock).mockResolvedValue({});

    const req = new Request("http://localhost:3000/api/admin/login", {
      method: "POST",
      body:   JSON.stringify({ rut: 99999999, password: "admin123" }),
    });
    const res  = await adminLoginHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("token");
    expect(data).toHaveProperty("user");
  });

  it("Debería retornar 401 si la contraseña es incorrecta", async () => {
    const hash = await bcrypt.hash("admin123", 10);
    (prisma.users.findFirst as jest.Mock).mockResolvedValue({
      id: "admin-uuid", rut: 99999999, role: "admin", is_active: true, password_hash: hash,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const req = new Request("http://localhost:3000/api/admin/login", {
      method: "POST",
      body:   JSON.stringify({ rut: 99999999, password: "clave_erronea" }),
    });
    const res = await adminLoginHandler(req);
    expect(res.status).toBe(401);
  });

  it("Debería retornar 401 si el usuario existe pero no tiene rol admin", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(null); // no player buscado como admin
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const req = new Request("http://localhost:3000/api/admin/login", {
      method: "POST",
      body:   JSON.stringify({ rut: 12345678, password: "clave123" }),
    });
    const res = await adminLoginHandler(req);
    expect(res.status).toBe(401);
  });
});

// ── Ajuste Manual de MMR ─────────────────────────────────────────────────────
describe("⚙️ PRUEBAS UNITARIAS - AJUSTE MMR (PATCH /admin/users/[id]/mmr)", () => {
  beforeEach(() => jest.clearAllMocks());

  const ctx = { params: Promise.resolve({ id: "player-uuid" }) };

  it("Debería retornar 400 si no se envía motivo", async () => {
    const req = new Request("http://localhost:3000/api/admin/users/player-uuid/mmr", {
      method: "PATCH",
      headers: { Authorization: "Bearer admin-token" },
      body:   JSON.stringify({ new_mmr: 1100 }),
    });
    const res = await patchMmrHandler(req, ctx as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/motivo/i);
  });

  it("Debería retornar 400 si el MMR está fuera del rango 0-9999", async () => {
    const req = new Request("http://localhost:3000/api/admin/users/player-uuid/mmr", {
      method:  "PATCH",
      headers: { Authorization: "Bearer admin-token" },
      body:    JSON.stringify({ new_mmr: 99999, reason: "corrección" }),
    });
    const res = await patchMmrHandler(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it("Debería retornar 404 si el usuario no existe", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/admin/users/player-uuid/mmr", {
      method:  "PATCH",
      headers: { Authorization: "Bearer admin-token" },
      body:    JSON.stringify({ new_mmr: 1100, reason: "corrección por error de sistema" }),
    });
    const res = await patchMmrHandler(req, ctx as any);
    expect(res.status).toBe(404);
  });

  it("Debería retornar 200 y actualizar el MMR correctamente", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({
      id: "player-uuid", name: "Jugador Test", email: "test@test.cl", mmr: 1000,
    });
    (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, {}]);

    const req = new Request("http://localhost:3000/api/admin/users/player-uuid/mmr", {
      method:  "PATCH",
      headers: { Authorization: "Bearer admin-token" },
      body:    JSON.stringify({ new_mmr: 1150, reason: "corrección por error de cálculo en partido #xyz" }),
    });
    const res  = await patchMmrHandler(req, ctx as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.old_mmr).toBe(1000);
    expect(data.new_mmr).toBe(1150);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

// ── Métricas de Plataforma ───────────────────────────────────────────────────
describe("📊 PRUEBAS UNITARIAS - MÉTRICAS (GET /admin/metrics)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Debería retornar 200 con todas las métricas correctamente", async () => {
    (prisma.users.count     as jest.Mock).mockResolvedValue(50);
    (prisma.matches.count   as jest.Mock).mockResolvedValue(12);
    (prisma.users.aggregate as jest.Mock).mockResolvedValue({ _avg: { mmr: 1050.5 } });
    (prisma.users.groupBy   as jest.Mock).mockResolvedValue([
      { zone: "Viña del Mar", _count: { id: 20 } },
      { zone: "Valparaíso",   _count: { id: 15 } },
    ]);

    const req  = new Request("http://localhost:3000/api/admin/metrics", {
      headers: { Authorization: "Bearer admin-token" },
    });
    const res  = await metricsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("users");
    expect(data).toHaveProperty("matches");
    expect(data).toHaveProperty("avg_mmr");
    expect(data).toHaveProperty("zones");
    expect(data).toHaveProperty("levels");
    expect(data.avg_mmr).toBe(1051);
  });
});

// ── Log de Auditoría ─────────────────────────────────────────────────────────
describe("📋 PRUEBAS UNITARIAS - AUDITORÍA (GET /admin/audit-logs)", () => {
  beforeEach(() => jest.clearAllMocks());

  const mockLogs = [
    {
      id: "log-1", action: "ADMIN_LOGIN", details: null, ip: "127.0.0.1",
      created_at: new Date(), admin_id: "admin-uuid",
      users: { id: "admin-uuid", name: "Admin PadelHub" },
    },
    {
      id: "log-2", action: "MMR_ADJUST",
      details: "user=player-uuid mmr: 1000→1150 motivo: corrección", ip: "127.0.0.1",
      created_at: new Date(), admin_id: "admin-uuid",
      users: { id: "admin-uuid", name: "Admin PadelHub" },
    },
  ];

  it("Debería retornar 200 con logs paginados y metadatos correctos", async () => {
    (prisma.$transaction   as jest.Mock).mockResolvedValue([2, mockLogs]);
    (prisma.admin_audit_logs.findMany as jest.Mock).mockResolvedValue([
      { admin_id: "admin-uuid", users: { id: "admin-uuid", name: "Admin PadelHub" } },
    ]);

    const req  = new Request("http://localhost:3000/api/admin/audit-logs", {
      headers: { Authorization: "Bearer admin-token" },
    });
    const res  = await auditLogsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("logs");
    expect(data).toHaveProperty("total", 2);
    expect(data).toHaveProperty("page",  1);
    expect(data).toHaveProperty("pages", 1);
    expect(data).toHaveProperty("admins");
    expect(data).toHaveProperty("actions");
    expect(data.logs[0]).toHaveProperty("action_label");
  });

  it("Debería retornar lista vacía si no hay registros de auditoría", async () => {
    (prisma.$transaction   as jest.Mock).mockResolvedValue([0, []]);
    (prisma.admin_audit_logs.findMany as jest.Mock).mockResolvedValue([]);

    const req  = new Request("http://localhost:3000/api/admin/audit-logs", {
      headers: { Authorization: "Bearer admin-token" },
    });
    const res  = await auditLogsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total).toBe(0);
    expect(data.logs).toHaveLength(0);
  });
});
