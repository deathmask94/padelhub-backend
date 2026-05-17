import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma"; // Cuatro niveles arriba para llegar a lib
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    // 1. Leer los datos enviados por el frontend desde el Body
    const body = await request.json();
    const { rut, password } = body;

    // Validación básica de campos vacíos
    if (!rut || !password) {
      return NextResponse.json(
        { error: "El RUT y la contraseña son obligatorios" },
        { status: 400 }
      );
    }

    // 2. Buscar si el usuario existe en la base de datos usando el RUT
    const player = await prisma.users.findFirst({
      where: {
        rut: parseInt(rut),
      },
    });

    // Si no existe, mandamos un error genérico (por seguridad, no es bueno decir exactamente qué falló)
    if (!player) {
      return NextResponse.json(
        { error: "RUT o contraseña incorrectos" },
        { status: 401 } // 401 significa No Autorizado
      );
    }

    // 3. Comparar la contraseña que metió el usuario con el hash guardado en la base de datos
    const isPasswordValid = await bcrypt.compare(password, player.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "RUT o contraseña incorrectos" },
        { status: 401 }
      );
    }

    // 4. Si todo está perfecto, limpiamos el hash de la contraseña por seguridad
    const { password_hash, ...userResponse } = player;

    // 5. Devolver la respuesta de éxito junto con los datos del usuario logueado
    return NextResponse.json(
      {
        message: "¡Inicio de sesión exitoso!",
        user: userResponse,
      },
      { status: 200 }
    );

  } catch (error: any) {
    return NextResponse.json(
      { error: "Error en el servidor al intentar iniciar sesión", details: error.message },
      { status: 500 }
    );
  }
}