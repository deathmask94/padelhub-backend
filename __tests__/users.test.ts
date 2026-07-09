import { POST as createUserHandler, GET as getUsersHandler, DELETE as deleteUserHandler } from "../app/api/users/route";
import { GET as getUserInfoHandler } from "../app/api/users/[rut]/route";
import { prisma } from "../lib/prisma";

jest.mock("@/lib/jwt", () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: "mock-uuid", role: "player" }),
  signToken:   jest.fn().mockResolvedValue("mock-token"),
}));

// 🌟 1. Mock de Prisma completo incluyendo findUnique para el teléfono
jest.mock("../lib/prisma", () => ({
  prisma: {
    users: {
      findFirst: jest.fn(),
      findUnique: jest.fn(), // <- Clave para la validación de teléfono
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    refresh_tokens: {
      create: jest.fn(),
    },
    match_players: {
      count: jest.fn(),
    },
  },
}));

// 🌟 2. Mock de bcryptjs (la librería que usas realmente)
jest.mock("bcryptjs", () => ({
  genSalt: jest.fn().mockResolvedValue("salt_simulado"),
  hash: jest.fn().mockResolvedValue("password_hash_simulado"),
}));

describe("👥 PRUEBAS UNITARIAS - GESTIÓN DE USUARIOS Y PERFILES", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Crear Usuario (El que daba 500)
  it("Debería retornar 201 al crear un usuario exitosamente", async () => {
    // Simulamos que el teléfono NO existe
    (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);
    // Simulamos que el RUT NO existe
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(null);
    // Simulamos la creación exitosa
    (prisma.users.create as jest.Mock).mockResolvedValue({ 
      id: "new-uuid", 
      rut: 12345678,
      dv_rut: "5",
      phone: "+56912345678",
      name: "Felipe Martínez",
      zone: "Concepción"
    });

    const req = new Request("http://localhost:3000/api/users", {
      method: "POST",
      body: JSON.stringify({
        rut: 12345678,
        dv_rut: "5",
        phone: "+56912345678",
        nombre: "Felipe",
        apellido: "Martínez",
        username: "felipe.martinez",
        password: "claveSegura123",
        zone: "Concepción",
        gender: "Masculino"
      }),
    });

    const res = await createUserHandler(req);
    
    // Si sigue dando error, te va a imprimir exactamente el porqué en consola
    if (res.status === 500) {
      console.error("🚨 Detalle del 500:", await res.json());
    }

    expect(res.status).toBe(201);
  });

  // Test 2: Obtener todos los usuarios
  it("Debería retornar la lista completa de jugadores", async () => {
    (prisma.users.findMany as jest.Mock).mockResolvedValue([
      { id: "1", name: "Jugador A" },
      { id: "2", name: "Jugador B" }
    ]);

    const req = new Request("http://localhost:3000/api/users");
    const res = await getUsersHandler(req);
    expect(res.status).toBe(200);
  });

  // Test 3: Obtener perfil por RUT en su nueva ubicación
  it("Debería retornar el perfil y stats de un usuario existente por su RUT", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue({
      id: "user-id",
      name: "Felipe Martínez",
      rut: 12345678,
      dv_rut: "5",
      phone: "+56912345678",
      zone: "Concepción",
      level: "PRO",
      mmr: 1200
    });
    (prisma.match_players.count as jest.Mock).mockResolvedValue(5);

    const req = new Request("http://localhost:3000/api/users/12345678");
    const context = { params: Promise.resolve({ rut: "12345678" }) };

    const res = await getUserInfoHandler(req, context as any);
    expect(res.status).toBe(200);
  });

  // Test 4: Eliminar Usuario (Aprovechando que está en tu archivo real)
  it("Debería retornar 200 al eliminar un usuario por su RUT", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue({ id: "uuid-to-delete", name: "Felipe", rut: 12345678, dv_rut: "5" });
    (prisma.users.delete as jest.Mock).mockResolvedValue({});

    const req = new Request("http://localhost:3000/api/users", {
      method: "DELETE",
      body: JSON.stringify({ rut: 12345678 }),
    });

    const res = await deleteUserHandler(req);
    expect(res.status).toBe(200);
  });
});
