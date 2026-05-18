import { POST as uploadPhotoHandler, DELETE as deletePhotoHandler } from "../app/api/users/[rut]/profile/photo/route";
import { prisma } from "../lib/prisma";

jest.mock("../lib/prisma", () => ({
  prisma: {
    users: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      destroy: jest.fn().mockResolvedValue({ result: "ok" }),
      upload_stream: jest.fn().mockImplementation((options, callback) => {
        if (callback) {
          callback(null, { secure_url: "https://res.cloudinary.com/mock-image.jpg" });
        }
        return { end: jest.fn() };
      }),
    },
  },
}));

describe("📸 PRUEBAS UNITARIAS - MULTIMEDIA (CLOUDINARY)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Debería retornar status 400 en POST si no se envía ningún archivo", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue({ id: "user-id", rut: 12345678 });

    const formData = new FormData();
    const req = new Request("http://localhost:3000/api/users/12345678/profile/photo", {
      method: "POST",
      body: formData,
    });
    
    // 🌟 MOCK DE PARAMS SEGURO PARA JEST
    const context = { params: Promise.resolve({ rut: "12345678" }) };

    const res = await uploadPhotoHandler(req, context as any);
    expect(res.status).toBe(400);
  });

  it("Debería retornar 200 al eliminar exitosamente la foto de perfil", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue({ 
      id: "user-id", 
      rut: 12345678, 
      photo_url: "https://res.cloudinary.com/folder/sample.jpg" 
    });
    (prisma.users.update as jest.Mock).mockResolvedValue({});

    const req = new Request("http://localhost:3000/api/users/12345678/profile/photo", { method: "DELETE" });
    
    // 🌟 MOCK DE PARAMS SEGURO PARA JEST
    const context = { params: Promise.resolve({ rut: "12345678" }) };

    const res = await deletePhotoHandler(req, context as any);
    expect(res.status).toBe(200);
  });
});
