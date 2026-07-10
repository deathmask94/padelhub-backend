import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/jwt";
import { normalizeName, normalizePhone, normalizeUsername } from "@/lib/normalize";
import { mmrToLevel } from "@/lib/mmrToLevel";

// Nivel de habilidad autoevaluado al registrarse (distinto de la categoria
// 1ra-7ma+, que se deriva del MMR real jugando partidos): solo se usa para
// elegir con que MMR inicial arranca el usuario.
const DEFAULT_STARTING_MMR = 1000;
const STARTING_MMR: Record<string, number> = {
  Avanzado:     2500, // arranca en 2da categoria
  Intermedio:   1500, // arranca en 4ta categoria
  Principiante:  500, // arranca en 6ta categoria
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET() {
  try {
    const players = await prisma.users.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        rut: true,
        dv_rut: true,
        phone: true,
        name: true,
        last_name: true,
        username: true,
        photo_url: true,
        level: true,
        gender: true,
        zone: true,
        mmr: true,
        role: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });
    return NextResponse.json(players);
  } catch (error: unknown) {
    console.error("[USERS GET ERROR]", error);
    return NextResponse.json(
      { error: "Error al obtener usuarios" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rut, dv_rut, phone, nombre, apellido, username, password, zone, email, birth_date, gender, nivel_estimado } = body;
    const startingMmr = STARTING_MMR[nivel_estimado] ?? DEFAULT_STARTING_MMR;

    if (!rut || !dv_rut || !phone || !nombre || !apellido || !username || !password || !zone || !gender) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios en el formulario" },
        { status: 400 }
      );
    }

    if (gender !== "Masculino" && gender !== "Femenino") {
      return NextResponse.json(
        { error: "El género debe ser 'Masculino' o 'Femenino'" },
        { status: 400 }
      );
    }

    const normalizedNombre = normalizeName(nombre);
    if (normalizedNombre.length < 2 || normalizedNombre.length > 25) {
      return NextResponse.json({ error: "El nombre debe tener entre 2 y 25 caracteres" }, { status: 400 });
    }

    const normalizedApellido = normalizeName(apellido);
    if (normalizedApellido.length < 2 || normalizedApellido.length > 25) {
      return NextResponse.json({ error: "El apellido debe tener entre 2 y 25 caracteres" }, { status: 400 });
    }

    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      return NextResponse.json(
        { error: "El nombre de usuario debe tener entre 3 y 24 caracteres (letras, números, '.' o '_')" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "El teléfono debe ser un número móvil chileno válido: 9 seguido de 8 dígitos" },
        { status: 400 }
      );
    }

    if (email) {
      const existingEmail = await prisma.users.findFirst({
        where: { email: email.toLowerCase().trim() },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: "El email ya se encuentra registrado" },
          { status: 400 }
        );
      }
    }

    const existingPhone = await prisma.users.findUnique({ where: { phone: normalizedPhone } });
    if (existingPhone) {
      return NextResponse.json(
        { error: "El número de teléfono ya se encuentra registrado" },
        { status: 400 }
      );
    }

    const existingUsername = await prisma.users.findUnique({ where: { username: normalizedUsername } });
    if (existingUsername) {
      return NextResponse.json(
        { error: "Ese nombre de usuario ya está en uso" },
        { status: 400 }
      );
    }

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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.users.create({
      data: {
        rut:           parseInt(rut),
        dv_rut:        dv_rut.toString().toUpperCase(),
        email:         email ? email.toLowerCase().trim() : null,
        phone:         normalizedPhone,
        name:          `${normalizedNombre} ${normalizedApellido}`,
        last_name:     normalizedApellido,
        username:      normalizedUsername,
        password_hash: hashedPassword,
        zone,
        gender,
        mmr:           startingMmr,
        level:         mmrToLevel(startingMmr),
        ...(birth_date ? { birth_date: new Date(birth_date) } : {}),
      },
    });

    const token = await signToken({ userId: newUser.id, role: newUser.role });

    const refreshToken = crypto.randomUUID();
    await prisma.refresh_tokens.create({
      data: {
        user_id:    newUser.id,
        token:      refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { password_hash, ...userResponse } = newUser;

    return NextResponse.json(
      { message: "¡Jugador registrado con éxito!", user: userResponse, token, refreshToken },
      { status: 201, headers: CORS }
    );
  } catch (error: unknown) {
    console.error("[USERS POST ERROR]", error);
    return NextResponse.json(
      { error: "Hubo un fallo en el servidor al registrar" },
      { status: 500, headers: CORS }
    );
  }
}

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

    const userExists = await prisma.users.findFirst({
      where: { rut: parseInt(rut) },
    });

    if (!userExists) {
      return NextResponse.json(
        { error: `No se encontró ningún jugador con el RUT ${rut}` },
        { status: 404 }
      );
    }

    await prisma.users.delete({ where: { id: userExists.id } });

    return NextResponse.json(
      { message: `Jugador '${userExists.name}' eliminado con éxito` },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[USERS DELETE ERROR]", error);
    return NextResponse.json(
      { error: "No se pudo eliminar al jugador" },
      { status: 500 }
    );
  }
}
