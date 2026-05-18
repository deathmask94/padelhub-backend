import { POST as loginHandler } from "@/app/api/auth/login/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    users: {
      findFirst: jest.fn(),
    },
  },
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