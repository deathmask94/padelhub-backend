import { POST as loginHandler   } from "@/app/api/auth/login/route";
import { POST as refreshHandler } from "@/app/api/auth/refresh/route";
import { POST as forgotHandler  } from "@/app/api/auth/forgot-password/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    users: {
      findFirst:  jest.fn(),
      findUnique: jest.fn(),
      update:     jest.fn(),
    },
    refresh_tokens: {
      findFirst:  jest.fn(),
      delete:     jest.fn(),
      create:     jest.fn(),
      deleteMany: jest.fn(),
    },
    password_reset_tokens: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      create:     jest.fn(),
    },
  },
}));

jest.mock("@/lib/jwt", () => ({
  signToken:    jest.fn().mockResolvedValue("mock-access-token"),
  verifyToken:  jest.fn().mockResolvedValue({ userId: "mock-uuid", role: "player" }),
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({}) },
  })),
}));

describe("🔐 PRUEBAS UNITARIAS - AUTH (LOGIN)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Debería retornar status 200 si el RUT existe y la contraseña es correcta", async () => {
    const hashCorrecto = await bcrypt.hash("padel123", 10);

    (prisma.users.findFirst as jest.Mock).mockResolvedValue({
      id: "mock-uuid-user",
      rut: 11111111,
      password_hash: hashCorrecto,
      name: "Diego Alejandro",
    });

    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ rut: 11111111, password: "padel123" }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.message).toBe("¡Inicio de sesión exitoso!");
  });

  it("Debería retornar 404 si el RUT no existe", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      body:   JSON.stringify({ rut: 99999999, password: "cualquier" }),
    });
    const res = await loginHandler(req);
    expect(res.status).toBe(401);
  });

  it("Debería retornar status 401 si la contraseña es inválida", async () => {
    const hashCorrecto = await bcrypt.hash("padel123", 10);

    (prisma.users.findFirst as jest.Mock).mockResolvedValue({
      id: "mock-uuid-user",
      rut: 11111111,
      password_hash: hashCorrecto,
    });

    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ rut: 11111111, password: "clave_erronea" }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(401);
  });
});

describe("🔄 PRUEBAS UNITARIAS - AUTH (REFRESH TOKEN)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Debería retornar 401 si el refresh token no existe en BD", async () => {
    (prisma.refresh_tokens.findFirst as jest.Mock).mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      body:   JSON.stringify({ refreshToken: "token-inexistente" }),
    });
    const res = await refreshHandler(req);
    expect(res.status).toBe(401);
  });

  it("Debería retornar 401 si el refresh token está expirado", async () => {
    (prisma.refresh_tokens.findFirst as jest.Mock).mockResolvedValue({
      id:         "rt-id",
      user_id:    "user-uuid",
      token:      "token-expirado",
      expires_at: new Date(Date.now() - 1000), // ya expiró
      users:      { id: "user-uuid", role: "player" },
    });

    const req = new Request("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      body:   JSON.stringify({ refreshToken: "token-expirado" }),
    });
    const res = await refreshHandler(req);
    expect(res.status).toBe(401);
  });

  it("Debería retornar 200 con nuevo token y refresh token rotado", async () => {
    (prisma.refresh_tokens.findFirst as jest.Mock).mockResolvedValue({
      id:         "rt-id",
      user_id:    "user-uuid",
      token:      "token-valido",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      users:      { id: "user-uuid", role: "player" },
    });
    (prisma.refresh_tokens.delete as jest.Mock).mockResolvedValue({});
    (prisma.refresh_tokens.create as jest.Mock).mockResolvedValue({
      token: "nuevo-refresh-token",
    });

    const req  = new Request("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      body:   JSON.stringify({ refreshToken: "token-valido" }),
    });
    const res  = await refreshHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("token");
    expect(data).toHaveProperty("refreshToken");
  });
});

describe("📧 PRUEBAS UNITARIAS - AUTH (FORGOT PASSWORD)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Resetear findFirst para evitar leak de implementaciones de tests anteriores
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(null);
  });

  it("Debería retornar 200 aunque el email no exista (seguridad: no revela existencia)", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(null);

    const req  = new Request("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      body:   JSON.stringify({ email: "inexistente@test.cl" }),
    });
    const res  = await forgotHandler(req);
    expect(res.status).toBe(200);
  });

  it("Debería retornar 200 y generar token cuando el email existe", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue({
      id: "user-uuid", email: "test@test.cl", name: "Test User",
    });
    (prisma.password_reset_tokens.updateMany as jest.Mock).mockResolvedValue({});
    (prisma.password_reset_tokens.create    as jest.Mock).mockResolvedValue({});

    const req  = new Request("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      body:   JSON.stringify({ email: "test@test.cl" }),
    });
    const res  = await forgotHandler(req);
    expect(res.status).toBe(200);
  });
});