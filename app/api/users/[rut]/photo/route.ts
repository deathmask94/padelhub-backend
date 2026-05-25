import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findUser(rut: string) {
  const where = UUID_REGEX.test(rut) ? { id: rut } : { rut: parseInt(rut) };
  return prisma.users.findFirst({ where });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ rut: string }> }
) {
  try {
    const { rut } = await context.params;
    const player = await findUser(rut);

    if (!player) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo de imagen" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (player.photo_url) {
      try {
        const urlParts = player.photo_url.split("/");
        const fileNameWithExtension = urlParts[urlParts.length - 1];
        const publicId = `padelhub_avatars/${fileNameWithExtension.split(".")[0]}`;
        await cloudinary.uploader.destroy(publicId);
      } catch {
        // old photo deletion is best-effort
      }
    }

    const uploadResponse: any = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "padelhub_avatars",
            transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(buffer);
    });

    const secureUrl = uploadResponse.secure_url;

    await prisma.users.update({
      where: { id: player.id },
      data: { photo_url: secureUrl },
    });

    return NextResponse.json(
      { message: "Foto de perfil actualizada con éxito", photo_url: secureUrl },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al subir la imagen", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ rut: string }> }
) {
  try {
    const { rut } = await context.params;
    const player = await findUser(rut);

    if (!player || !player.photo_url) {
      return NextResponse.json(
        { error: "El jugador no existe o no tiene foto de perfil" },
        { status: 404 }
      );
    }

    const urlParts = player.photo_url.split("/");
    const fileNameWithExtension = urlParts[urlParts.length - 1];
    const publicId = `padelhub_avatars/${fileNameWithExtension.split(".")[0]}`;
    await cloudinary.uploader.destroy(publicId);

    await prisma.users.update({
      where: { id: player.id },
      data: { photo_url: null },
    });

    return NextResponse.json(
      { message: "Foto de perfil eliminada correctamente" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al eliminar la imagen", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}
