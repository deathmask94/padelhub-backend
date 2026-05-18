import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================================
// 📥 POST: AÑADIR O CAMBIAR FOTO DE PERFIL
// ==========================================
export async function POST(
  request: Request,
  context: { params: Promise<{ rut: string }> }
) {
  try {
    const { rut } = await context.params;

    // 1. Verificar que el usuario exista
    const player = await prisma.users.findFirst({
      where: { rut: parseInt(rut) },
    });

    if (!player) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
    }

    // 2. Extraer el archivo enviado por el Frontend (FormData)
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo de imagen" }, { status: 400 });
    }

    // 3. Convertir el archivo a un Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 4. SI EL USUARIO YA TENÍA FOTO, BORRAR LA ANTERIOR DE CLOUDINARY
    // 💡 Modificado: Ahora lee correctamente 'photo_url'
    if (player.photo_url) {
      try {
        const urlParts = player.photo_url.split("/");
        const fileNameWithExtension = urlParts[urlParts.length - 1];
        const publicId = `padelhub_avatars/${fileNameWithExtension.split(".")[0]}`;
        
        await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        console.log("No se pudo borrar la foto anterior en Cloudinary");
      }
    }

    // 5. Subir la nueva imagen a Cloudinary
    const uploadResponse: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          folder: "padelhub_avatars",
          transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    const secureUrl = uploadResponse.secure_url;

    // 6. Guardar la URL en la base de datos de Supabase usando Prisma
    // 💡 Modificado: Ahora actualiza el campo exacto 'photo_url'
    await prisma.users.update({
      where: { id: player.id },
      data: {
        photo_url: secureUrl, 
      },
    });

    return NextResponse.json({
      message: "Foto de perfil actualizada con éxito",
      photo_url: secureUrl
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: "Error al subir la imagen", details: error.message }, { status: 500 });
  }
}

// ==========================================
// 🗑️ DELETE: ELIMINAR FOTO DE PERFIL
// ==========================================
export async function DELETE(
  request: Request,
  context: { params: Promise<{ rut: string }> }
) {
  try {
    const { rut } = await context.params;

    const player = await prisma.users.findFirst({
      where: { rut: parseInt(rut) },
    });

    // 💡 Modificado: Valida usando 'photo_url'
    if (!player || !player.photo_url) {
      return NextResponse.json({ error: "El jugador no existe o no tiene foto de perfil" }, { status: 404 });
    }

    // 1. Remover de Cloudinary
    const urlParts = player.photo_url.split("/");
    const fileNameWithExtension = urlParts[urlParts.length - 1];
    const publicId = `padelhub_avatars/${fileNameWithExtension.split(".")[0]}`;
    await cloudinary.uploader.destroy(publicId);

    // 2. Dejar el campo nulo en la Base de Datos
    // 💡 Modificado: Setea 'photo_url' en null
    await prisma.users.update({
      where: { id: player.id },
      data: {
        photo_url: null,
      },
    });

    return NextResponse.json({ message: "Foto de perfil eliminada correctamente" }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: "Error al eliminar la imagen", details: error.message }, { status: 500 });
  }
}