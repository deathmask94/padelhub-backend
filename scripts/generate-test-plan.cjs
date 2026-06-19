const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, HeadingLevel,
  BorderStyle, ShadingType, VerticalAlign,
} = require("docx");
const fs = require("fs");
const path = require("path");

// ─── Paleta de colores ────────────────────────────────────────────────────────
const AZUL_HEADER  = "1F4E79";
const AZUL_TITULO  = "2E75B6";
const VERDE_PASS   = "E2EFDA";
const VERDE_TEXTO  = "375623";
const GRIS_FILA    = "D6E4F0";
const BLANCO       = "FFFFFF";

// ─── Datos de los 54 casos de prueba ─────────────────────────────────────────
const casos = [
  // ── AUTH LOGIN ──────────────────────────────────────────────────────────────
  { id:"CP-001", modulo:"Autenticación", submodulo:"POST /api/auth/login",
    descripcion:"Login exitoso con credenciales válidas",
    entrada:"RUT: 11111111, password: 'padel123' (hash bcrypt válido en BD)",
    esperado:"HTTP 200, body contiene message: '¡Inicio de sesión exitoso!'",
    obtenido:"HTTP 200, message correcto", estado:"APROBADO" },
  { id:"CP-002", modulo:"Autenticación", submodulo:"POST /api/auth/login",
    descripcion:"Login con RUT inexistente",
    entrada:"RUT: 99999999 (no existe en BD)",
    esperado:"HTTP 401 — credenciales inválidas",
    obtenido:"HTTP 401", estado:"APROBADO" },
  { id:"CP-003", modulo:"Autenticación", submodulo:"POST /api/auth/login",
    descripcion:"Login con contraseña incorrecta",
    entrada:"RUT válido, password: 'clave_erronea'",
    esperado:"HTTP 401 — contraseña no coincide",
    obtenido:"HTTP 401", estado:"APROBADO" },

  // ── AUTH REFRESH ────────────────────────────────────────────────────────────
  { id:"CP-004", modulo:"Autenticación", submodulo:"POST /api/auth/refresh",
    descripcion:"Refresh token inexistente en BD",
    entrada:"refreshToken: 'token-inexistente'",
    esperado:"HTTP 401",
    obtenido:"HTTP 401", estado:"APROBADO" },
  { id:"CP-005", modulo:"Autenticación", submodulo:"POST /api/auth/refresh",
    descripcion:"Refresh token expirado",
    entrada:"refreshToken con expires_at en el pasado",
    esperado:"HTTP 401",
    obtenido:"HTTP 401", estado:"APROBADO" },
  { id:"CP-006", modulo:"Autenticación", submodulo:"POST /api/auth/refresh",
    descripcion:"Rotación exitosa de refresh token",
    entrada:"refreshToken válido y vigente",
    esperado:"HTTP 200, body contiene 'token' y 'refreshToken'",
    obtenido:"HTTP 200, ambos campos presentes", estado:"APROBADO" },

  // ── AUTH FORGOT PASSWORD ─────────────────────────────────────────────────
  { id:"CP-007", modulo:"Autenticación", submodulo:"POST /api/auth/forgot-password",
    descripcion:"Email no registrado — respuesta genérica por seguridad",
    entrada:"email: 'inexistente@test.cl' (no existe en BD)",
    esperado:"HTTP 200 — no revela si el email existe",
    obtenido:"HTTP 200", estado:"APROBADO" },
  { id:"CP-008", modulo:"Autenticación", submodulo:"POST /api/auth/forgot-password",
    descripcion:"Email registrado — genera token de reset",
    entrada:"email: 'test@test.cl' (existe en BD)",
    esperado:"HTTP 200, token creado en BD, email enviado vía Resend",
    obtenido:"HTTP 200, token y email procesados", estado:"APROBADO" },

  // ── USUARIOS ────────────────────────────────────────────────────────────────
  { id:"CP-009", modulo:"Usuarios", submodulo:"POST /api/users",
    descripcion:"Registro exitoso de nuevo jugador",
    entrada:"RUT: 12345678, nombre, teléfono, zona, password",
    esperado:"HTTP 201, usuario creado, token JWT retornado",
    obtenido:"HTTP 201", estado:"APROBADO" },
  { id:"CP-010", modulo:"Usuarios", submodulo:"GET /api/users",
    descripcion:"Listar todos los jugadores activos",
    entrada:"Sin parámetros adicionales",
    esperado:"HTTP 200, array de jugadores",
    obtenido:"HTTP 200, lista retornada", estado:"APROBADO" },
  { id:"CP-011", modulo:"Usuarios", submodulo:"GET /api/users/[rut]",
    descripcion:"Obtener perfil y estadísticas de jugador por RUT",
    entrada:"RUT: 12345678 (existe en BD)",
    esperado:"HTTP 200, perfil con MMR, zona, nivel",
    obtenido:"HTTP 200, perfil completo", estado:"APROBADO" },
  { id:"CP-012", modulo:"Usuarios", submodulo:"DELETE /api/users",
    descripcion:"Eliminar jugador existente por RUT",
    entrada:"RUT: 12345678 (existe en BD)",
    esperado:"HTTP 200, jugador eliminado",
    obtenido:"HTTP 200", estado:"APROBADO" },

  // ── SUGERENCIAS ─────────────────────────────────────────────────────────────
  { id:"CP-013", modulo:"Matchmaking", submodulo:"GET /api/users/suggestions",
    descripcion:"Sin token de autenticación",
    entrada:"Request sin header Authorization",
    esperado:"HTTP 401",
    obtenido:"HTTP 401", estado:"APROBADO" },
  { id:"CP-014", modulo:"Matchmaking", submodulo:"GET /api/users/suggestions",
    descripcion:"Usuario autenticado no encontrado en BD",
    entrada:"Token válido, pero userId no existe en BD",
    esperado:"HTTP 404",
    obtenido:"HTTP 404", estado:"APROBADO" },
  { id:"CP-015", modulo:"Matchmaking", submodulo:"GET /api/users/suggestions",
    descripcion:"Sugerencias con compatibilidad — rango ±150 con ≥5 rivales",
    entrada:"Usuario con MMR 1000, 5+ rivales en rango 850-1150",
    esperado:"HTTP 200, lista con porcentaje de compatibilidad",
    obtenido:"HTTP 200, sugerencias calculadas", estado:"APROBADO" },
  { id:"CP-016", modulo:"Matchmaking", submodulo:"GET /api/users/suggestions",
    descripcion:"Expansión de rango a ±300 cuando ±150 da menos de 5 rivales",
    entrada:"Pocos rivales en ±150, más en ±300",
    esperado:"HTTP 200, rango expandido automáticamente",
    obtenido:"HTTP 200, rango expandido correctamente", estado:"APROBADO" },
  { id:"CP-017", modulo:"Matchmaking", submodulo:"GET /api/users/suggestions",
    descripcion:"Fallback — retorna lo disponible aunque sean menos de 5",
    entrada:"Menos de 5 rivales en todos los rangos",
    esperado:"HTTP 200, retorna los disponibles",
    obtenido:"HTTP 200", estado:"APROBADO" },
  { id:"CP-018", modulo:"Matchmaking", submodulo:"GET /api/users/suggestions",
    descripcion:"Sugerencias ordenadas por compatibilidad descendente",
    entrada:"Múltiples rivales con distintos MMR",
    esperado:"HTTP 200, lista ordenada de mayor a menor compatibilidad",
    obtenido:"HTTP 200, orden correcto", estado:"APROBADO" },

  // ── MULTIMEDIA ───────────────────────────────────────────────────────────────
  { id:"CP-019", modulo:"Multimedia", submodulo:"POST /api/users/[rut]/profile/photo",
    descripcion:"Upload sin adjuntar archivo",
    entrada:"Request multipart sin campo 'file'",
    esperado:"HTTP 400 — se requiere archivo",
    obtenido:"HTTP 400", estado:"APROBADO" },
  { id:"CP-020", modulo:"Multimedia", submodulo:"DELETE /api/users/[rut]/profile/photo",
    descripcion:"Eliminar foto de perfil exitosamente",
    entrada:"RUT válido, photo_url existente en Cloudinary (mock)",
    esperado:"HTTP 200 — foto eliminada de Cloudinary y BD",
    obtenido:"HTTP 200", estado:"APROBADO" },

  // ── PARTIDOS ─────────────────────────────────────────────────────────────────
  { id:"CP-021", modulo:"Partidos", submodulo:"POST /api/matches",
    descripcion:"Crear partido con todos los campos requeridos",
    entrada:"organizer_id, club, format, match_date, match_time",
    esperado:"HTTP 201, partido creado en BD",
    obtenido:"HTTP 201", estado:"APROBADO" },
  { id:"CP-022", modulo:"Partidos", submodulo:"POST /api/matches",
    descripcion:"Crear partido sin campos obligatorios",
    entrada:"Body vacío {}",
    esperado:"HTTP 400 — faltan campos obligatorios",
    obtenido:"HTTP 400", estado:"APROBADO" },

  // ── CANCELAR PARTIDO ─────────────────────────────────────────────────────────
  { id:"CP-023", modulo:"Partidos", submodulo:"POST /api/matches/[id]/cancel",
    descripcion:"Cancelación por usuario que no es el organizador",
    entrada:"Token de usuario distinto al organizador",
    esperado:"HTTP 403 — solo el organizador puede cancelar",
    obtenido:"HTTP 403", estado:"APROBADO" },
  { id:"CP-024", modulo:"Partidos", submodulo:"POST /api/matches/[id]/cancel",
    descripcion:"Cancelación de partido ya cancelado",
    entrada:"Partido con status: 'cancelled'",
    esperado:"HTTP 400 — partido ya cancelado",
    obtenido:"HTTP 400", estado:"APROBADO" },
  { id:"CP-025", modulo:"Partidos", submodulo:"POST /api/matches/[id]/cancel",
    descripcion:"Cancelación exitosa por el organizador",
    entrada:"Token del organizador, partido en status 'open'",
    esperado:"HTTP 200 — partido cancelado, notificaciones enviadas",
    obtenido:"HTTP 200", estado:"APROBADO" },

  // ── RESULTADO ────────────────────────────────────────────────────────────────
  { id:"CP-026", modulo:"Partidos", submodulo:"POST /api/matches/[id]/result",
    descripcion:"Registro de resultado por no organizador",
    entrada:"Token de participante que no es organizador",
    esperado:"HTTP 403",
    obtenido:"HTTP 403", estado:"APROBADO" },
  { id:"CP-027", modulo:"Partidos", submodulo:"POST /api/matches/[id]/result",
    descripcion:"Registro de resultado en partido no confirmado",
    entrada:"Partido con status: 'open'",
    esperado:"HTTP 400 — partido debe estar confirmado",
    obtenido:"HTTP 400", estado:"APROBADO" },
  { id:"CP-028", modulo:"Partidos", submodulo:"POST /api/matches/[id]/result",
    descripcion:"Registro de resultado exitoso con cambios de MMR (ELO K=32)",
    entrada:"Partido confirmado, winner: 'team_a', organizer_team: 'team_a'",
    esperado:"HTTP 200, body contiene 'changes' con delta MMR de cada jugador",
    obtenido:"HTTP 200, cambios ELO calculados correctamente", estado:"APROBADO" },

  // ── VALORACIONES ─────────────────────────────────────────────────────────────
  { id:"CP-029", modulo:"Valoraciones", submodulo:"POST /api/matches/[id]/rate",
    descripcion:"Valorar sin token de autenticación",
    entrada:"Request sin header Authorization",
    esperado:"HTTP 401",
    obtenido:"HTTP 401", estado:"APROBADO" },
  { id:"CP-030", modulo:"Valoraciones", submodulo:"POST /api/matches/[id]/rate",
    descripcion:"Valorar en partido no finalizado",
    entrada:"Partido con status: 'confirmed'",
    esperado:"HTTP 400 — el partido debe estar finalizado",
    obtenido:"HTTP 400", estado:"APROBADO" },
  { id:"CP-031", modulo:"Valoraciones", submodulo:"POST /api/matches/[id]/rate",
    descripcion:"Valorar fuera de la ventana de 24h",
    entrada:"Partido finalizado hace 25 horas",
    esperado:"HTTP 403 — ventana de valoración expirada",
    obtenido:"HTTP 403", estado:"APROBADO" },
  { id:"CP-032", modulo:"Valoraciones", submodulo:"POST /api/matches/[id]/rate",
    descripcion:"Auto-valoración (valorarse a uno mismo)",
    entrada:"rated_id igual al userId del token",
    esperado:"HTTP 400 — no se puede valorar a uno mismo",
    obtenido:"HTTP 400", estado:"APROBADO" },
  { id:"CP-033", modulo:"Valoraciones", submodulo:"POST /api/matches/[id]/rate",
    descripcion:"Escala de valoración fuera de rango (1-5)",
    entrada:"fair_play: 6 (fuera del rango permitido)",
    esperado:"HTTP 400 — valor fuera de escala",
    obtenido:"HTTP 400", estado:"APROBADO" },
  { id:"CP-034", modulo:"Valoraciones", submodulo:"POST /api/matches/[id]/rate",
    descripcion:"Valoración exitosa de compañeros de partido",
    entrada:"Valoraciones válidas para 2 jugadores (fair_play, punctuality, skill_level 1-5)",
    esperado:"HTTP 200, valoraciones guardadas, notificaciones enviadas",
    obtenido:"HTTP 200", estado:"APROBADO" },

  // ── REPUTACIÓN ───────────────────────────────────────────────────────────────
  { id:"CP-035", modulo:"Valoraciones", submodulo:"GET /api/users/[rut]/ratings",
    descripcion:"RUT inválido (no numérico)",
    entrada:"rut: 'abc'",
    esperado:"HTTP 400 — RUT debe ser numérico",
    obtenido:"HTTP 400", estado:"APROBADO" },
  { id:"CP-036", modulo:"Valoraciones", submodulo:"GET /api/users/[rut]/ratings",
    descripcion:"Usuario sin valoraciones registradas",
    entrada:"RUT válido, usuario sin valoraciones en BD",
    esperado:"HTTP 404 — usuario no encontrado",
    obtenido:"HTTP 404", estado:"APROBADO" },
  { id:"CP-037", modulo:"Valoraciones", submodulo:"GET /api/users/[rut]/ratings",
    descripcion:"Promedios correctamente redondeados (1 decimal)",
    entrada:"Agregado: fair_play 4.333, punctuality 3.666, skill_level 4.0",
    esperado:"HTTP 200 — avg_fair_play: 4.3, avg_punctuality: 3.7, avg_skill_level: 4.0",
    obtenido:"HTTP 200, redondeos correctos", estado:"APROBADO" },
  { id:"CP-038", modulo:"Valoraciones", submodulo:"GET /api/users/[rut]/ratings",
    descripcion:"Usuario sin ninguna valoración — retorna nulls",
    entrada:"Agregado con _avg: null en todos los campos",
    esperado:"HTTP 200, total: 0, avg_fair_play: null",
    obtenido:"HTTP 200, nulls correctos", estado:"APROBADO" },

  // ── NOTIFICACIONES ───────────────────────────────────────────────────────────
  { id:"CP-039", modulo:"Notificaciones", submodulo:"GET /api/notifications",
    descripcion:"Obtener notificaciones sin token",
    entrada:"Request sin header Authorization",
    esperado:"HTTP 401",
    obtenido:"HTTP 401", estado:"APROBADO" },
  { id:"CP-040", modulo:"Notificaciones", submodulo:"GET /api/notifications",
    descripcion:"Obtener notificaciones con 2 no leídas",
    entrada:"3 notificaciones en BD: 2 read:false, 1 read:true",
    esperado:"HTTP 200, unread_count: 2, notifications.length: 3",
    obtenido:"HTTP 200, conteos correctos", estado:"APROBADO" },
  { id:"CP-041", modulo:"Notificaciones", submodulo:"GET /api/notifications",
    descripcion:"Todas las notificaciones leídas — unread_count 0",
    entrada:"Todas las notificaciones con read:true",
    esperado:"HTTP 200, unread_count: 0",
    obtenido:"HTTP 200, unread_count: 0", estado:"APROBADO" },
  { id:"CP-042", modulo:"Notificaciones", submodulo:"GET /api/notifications",
    descripcion:"Sin notificaciones — lista vacía",
    entrada:"BD sin notificaciones para el usuario",
    esperado:"HTTP 200, array vacío, unread_count: 0",
    obtenido:"HTTP 200, lista vacía", estado:"APROBADO" },
  { id:"CP-043", modulo:"Notificaciones", submodulo:"PATCH /api/notifications",
    descripcion:"Marcar como leídas sin token",
    entrada:"Request PATCH sin header Authorization",
    esperado:"HTTP 401",
    obtenido:"HTTP 401", estado:"APROBADO" },
  { id:"CP-044", modulo:"Notificaciones", submodulo:"PATCH /api/notifications",
    descripcion:"Marcar todas las notificaciones como leídas",
    entrada:"Token válido, 2 notificaciones no leídas",
    esperado:"HTTP 200, updateMany llamado con read:true para el usuario",
    obtenido:"HTTP 200, notificaciones marcadas", estado:"APROBADO" },

  // ── ADMIN LOGIN ───────────────────────────────────────────────────────────────
  { id:"CP-045", modulo:"Administración", submodulo:"POST /api/admin/login",
    descripcion:"Login de administrador exitoso",
    entrada:"RUT admin, password correcta, rol: 'admin'",
    esperado:"HTTP 200, token JWT (4h), datos del admin",
    obtenido:"HTTP 200, token y user retornados", estado:"APROBADO" },
  { id:"CP-046", modulo:"Administración", submodulo:"POST /api/admin/login",
    descripcion:"Contraseña incorrecta del administrador",
    entrada:"RUT admin, password errónea",
    esperado:"HTTP 401",
    obtenido:"HTTP 401", estado:"APROBADO" },
  { id:"CP-047", modulo:"Administración", submodulo:"POST /api/admin/login",
    descripcion:"Usuario sin rol de administrador intenta acceder",
    entrada:"RUT que no corresponde a un admin",
    esperado:"HTTP 401 — no es administrador",
    obtenido:"HTTP 401", estado:"APROBADO" },

  // ── AJUSTE MMR ────────────────────────────────────────────────────────────────
  { id:"CP-048", modulo:"Administración", submodulo:"PATCH /api/admin/users/[id]/mmr",
    descripcion:"Ajuste de MMR sin campo motivo",
    entrada:"new_mmr: 1100, sin campo reason",
    esperado:"HTTP 400 — motivo obligatorio",
    obtenido:"HTTP 400", estado:"APROBADO" },
  { id:"CP-049", modulo:"Administración", submodulo:"PATCH /api/admin/users/[id]/mmr",
    descripcion:"MMR fuera del rango válido (0-9999)",
    entrada:"new_mmr: 99999",
    esperado:"HTTP 400 — valor fuera de rango",
    obtenido:"HTTP 400", estado:"APROBADO" },
  { id:"CP-050", modulo:"Administración", submodulo:"PATCH /api/admin/users/[id]/mmr",
    descripcion:"Ajuste MMR a usuario inexistente",
    entrada:"ID de usuario que no existe en BD",
    esperado:"HTTP 404",
    obtenido:"HTTP 404", estado:"APROBADO" },
  { id:"CP-051", modulo:"Administración", submodulo:"PATCH /api/admin/users/[id]/mmr",
    descripcion:"Ajuste de MMR exitoso con registro en auditoría",
    entrada:"new_mmr: 1150, reason: 'Corrección por error de cálculo'",
    esperado:"HTTP 200, old_mmr: 1000, new_mmr: 1150, $transaction ejecutado",
    obtenido:"HTTP 200, cambios aplicados en transacción atómica", estado:"APROBADO" },

  // ── MÉTRICAS ──────────────────────────────────────────────────────────────────
  { id:"CP-052", modulo:"Administración", submodulo:"GET /api/admin/metrics",
    descripcion:"Obtener métricas generales de la plataforma",
    entrada:"Token de administrador válido",
    esperado:"HTTP 200, contiene: users, matches, avg_mmr (redondeado), zones, levels",
    obtenido:"HTTP 200, avg_mmr: 1051 (1050.5 redondeado), todos los campos presentes", estado:"APROBADO" },

  // ── AUDITORÍA ─────────────────────────────────────────────────────────────────
  { id:"CP-053", modulo:"Administración", submodulo:"GET /api/admin/audit-logs",
    descripcion:"Log de auditoría paginado con registros",
    entrada:"Token admin, sin filtros adicionales",
    esperado:"HTTP 200, logs[], total: 2, page: 1, pages: 1, admins[], actions[]",
    obtenido:"HTTP 200, paginación y metadatos correctos", estado:"APROBADO" },
  { id:"CP-054", modulo:"Administración", submodulo:"GET /api/admin/audit-logs",
    descripcion:"Log de auditoría sin registros — lista vacía",
    entrada:"Token admin, BD sin logs de auditoría",
    esperado:"HTTP 200, total: 0, logs.length: 0",
    obtenido:"HTTP 200, lista vacía correcta", estado:"APROBADO" },
];

// ─── Helpers de celda ─────────────────────────────────────────────────────────
function cellHeader(text) {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: AZUL_HEADER },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: BLANCO, size: 18 })],
    })],
  });
}

function cell(text, shade = BLANCO, bold = false, center = false) {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: shade },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), bold, size: 17 })],
    })],
  });
}

function cellAprobado() {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: VERDE_PASS },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "✓ APROBADO", bold: true, color: VERDE_TEXTO, size: 17 })],
    })],
  });
}

// ─── Construir tabla ──────────────────────────────────────────────────────────
const headerRow = new TableRow({
  tableHeader: true,
  children: [
    cellHeader("ID"),
    cellHeader("Módulo"),
    cellHeader("Endpoint"),
    cellHeader("Descripción del caso"),
    cellHeader("Datos de entrada"),
    cellHeader("Resultado esperado"),
    cellHeader("Resultado obtenido"),
    cellHeader("Estado"),
  ],
});

const dataRows = casos.map((c, i) => {
  const shade = i % 2 === 0 ? GRIS_FILA : BLANCO;
  return new TableRow({
    children: [
      cell(c.id,          shade, true,  true),
      cell(c.modulo,      shade, false, false),
      cell(c.submodulo,   shade, false, false),
      cell(c.descripcion, shade, false, false),
      cell(c.entrada,     shade, false, false),
      cell(c.esperado,    shade, false, false),
      cell(c.obtenido,    shade, false, false),
      cellAprobado(),
    ],
  });
});

const tabla = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [headerRow, ...dataRows],
});

// ─── Resumen final ────────────────────────────────────────────────────────────
const resumenRow = new TableRow({
  children: [
    new TableCell({
      columnSpan: 7,
      shading: { type: ShadingType.SOLID, color: AZUL_TITULO },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      children: [new Paragraph({
        children: [new TextRun({ text: "TOTAL DE CASOS EJECUTADOS: 54 / 54", bold: true, color: BLANCO, size: 20 })],
      })],
    }),
    new TableCell({
      shading: { type: ShadingType.SOLID, color: VERDE_PASS },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "100% PASS", bold: true, color: VERDE_TEXTO, size: 20 })],
      })],
    }),
  ],
});

const tablaResumen = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [resumenRow],
});

// ─── Documento ────────────────────────────────────────────────────────────────
const doc = new Document({
  sections: [{
    properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
    children: [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "PLAN DE PRUEBAS — PADELHUB", bold: true, size: 40, color: AZUL_HEADER })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Taller Aplicado de Programación — TPY1101", size: 24, color: "444444" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Fecha de ejecución: ${new Date().toLocaleDateString("es-CL")}`, size: 22, italics: true })],
      }),
      new Paragraph({ children: [new TextRun({ text: "" })] }),
      new Paragraph({
        children: [new TextRun({ text: "Resumen Ejecutivo", bold: true, size: 26, color: AZUL_TITULO })],
      }),
      new Paragraph({
        children: [new TextRun({ text: "El presente documento detalla el Plan de Pruebas Unitarias ejecutado sobre el sistema PadelHub. Se aplicaron 54 casos de prueba distribuidos en 8 módulos funcionales, utilizando Jest como framework de pruebas con la estrategia de mocking para aislar dependencias externas (Prisma ORM, servicios de email Resend, Cloudinary). Todos los casos fueron ejecutados exitosamente.", size: 20 })],
      }),
      new Paragraph({ children: [new TextRun({ text: "" })] }),
      new Paragraph({
        children: [new TextRun({ text: "Tecnologías y Metodología", bold: true, size: 26, color: AZUL_TITULO })],
      }),
      new Paragraph({ children: [new TextRun({ text: "• Framework de pruebas: Jest v29 con ts-jest", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "• Tipo de pruebas: Unitarias (aisladas con mocks)", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "• Entorno: Node.js — testEnvironment: 'node'", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "• Cobertura: 8 módulos / 54 casos / 0 fallos", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "• Comando de ejecución: npx jest --no-coverage --verbose", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "" })] }),
      new Paragraph({
        children: [new TextRun({ text: "Módulos cubiertos:", bold: true, size: 22, color: AZUL_TITULO })],
      }),
      new Paragraph({ children: [new TextRun({ text: "1. Autenticación (CP-001 a CP-008) — Login, Refresh token, Recuperación de contraseña", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "2. Usuarios (CP-009 a CP-012) — CRUD de jugadores", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "3. Matchmaking / Sugerencias (CP-013 a CP-018) — Compatibilidad MMR con expansión de rango", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "4. Multimedia (CP-019 a CP-020) — Upload y eliminación de foto de perfil (Cloudinary)", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "5. Partidos (CP-021 a CP-028) — Creación, cancelación y registro de resultados con ELO K=32", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "6. Valoraciones y Reputación (CP-029 a CP-038) — Sistema de rating post-partido (1-5 estrellas)", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "7. Notificaciones (CP-039 a CP-044) — Centro de notificaciones in-app", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "8. Administración (CP-045 a CP-054) — Login admin, ajuste MMR, métricas y auditoría", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: "" })] }),
      new Paragraph({
        children: [new TextRun({ text: "Tabla de Casos de Prueba", bold: true, size: 28, color: AZUL_HEADER })],
      }),
      new Paragraph({ children: [new TextRun({ text: "" })] }),
      tabla,
      new Paragraph({ children: [new TextRun({ text: "" })] }),
      tablaResumen,
      new Paragraph({ children: [new TextRun({ text: "" })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Resultado final: 54 pruebas ejecutadas — 54 APROBADAS — 0 FALLIDAS", bold: true, size: 22, color: VERDE_TEXTO })],
      }),
    ],
  }],
});

// ─── Generar archivo ──────────────────────────────────────────────────────────
Packer.toBuffer(doc).then((buffer) => {
  const outPath = path.join(__dirname, "..", "PlanDePruebas_PadelHub.docx");
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ Documento generado: ${outPath}`);
});
