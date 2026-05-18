import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// ==========================================
// 1. GET: Obtener todos los usuarios 
// ==========================================
export async function GET() {
  try {
    const players = await prisma.users.findMany({
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json(players);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al obtener usuarios", details: error.message },
      { status: 500 }
    );
  }
}

// ==========================================
// 2. POST: Registro Usuario
// ==========================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rut, dv_rut, phone, name, password, zone } = body;

    // Validación básica de campos requeridos
    if (!rut || !dv_rut || !phone || !name || !password || !zone) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios en el formulario" },
        { status: 400 }
      );
    }

    // Validación 1: Verificar si el teléfono ya existe 
    const existingPhone = await prisma.users.findUnique({
      where: { phone },
    });

    if (existingPhone) {
      return NextResponse.json(
        { error: "El número de teléfono ya se encuentra registrado" },
        { status: 400 }
      );
    }

    // Validación 2: Verificar si el RUT ya existe (Evitar duplicados)
    const existingRut = await prisma.users.findFirst({
      where: {
        rut: parseInt(rut),
        dv_rut: dv_rut.toString().toUpperCase(),
      },
    });

    if (existingRut) {
      return NextResponse.json(
        { error: "El RUT ingresado ya se encuentra registrado" },
        { status: 400 }
      );
    }

    // Encriptar la contraseña antes de guardarla
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insertar el nuevo jugador en Supabase
    const newUser = await prisma.users.create({
      data: {
        rut: parseInt(rut),
        dv_rut: dv_rut.toString().toUpperCase(),
        phone,
        name,
        password_hash: hashedPassword,
        zone,
        // Los enums y defaults (level, role, mmr) se asignan solos gracias a schema.prisma
      },
    });

    // Seguridad básica: No devolver el hash de la contraseña en la respuesta de la API
    const { password_hash, ...userResponse } = newUser;

    return NextResponse.json(
      { message: "¡Jugador registrado con éxito!", user: userResponse },
      { status: 201 }
    );

  } catch (error: any) {
    return NextResponse.json(
      { error: "Hubo un fallo en el servidor al registrar", details: error.message },
      { status: 500 }
    );
  }
}

// ==========================================
// 3. DELETE: Eliminar un jugador por su RUT
// ==========================================
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { rut } = body;

    if (!rut) {
      return NextResponse.json(
        { error: "Falta el campo 'rut' en el cuerpo de la petición" },
        { status: 400 }
      );
    }

    // 1. Verificar si el usuario existe por su RUT
    const userExists = await prisma.users.findFirst({
      where: { rut: parseInt(rut) },
    });

    if (!userExists) {
      return NextResponse.json(
        { error: `No se encontró ningún jugador con el RUT ${rut}` },
        { status: 404 }
      );
    }

    // 2. Eliminar al jugador
    await prisma.users.delete({
      where: { id: userExists.id }, // Prisma necesita el ID (PK) para borrar de forma segura
    });

    return NextResponse.json(
      { message: `Jugador '${userExists.name}' con RUT ${rut}-${userExists.dv_rut} eliminado con éxito` },
      { status: 200 }
    );

  } catch (error: any) {
    return NextResponse.json(
      { 
        error: "No se pudo eliminar al jugador", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
