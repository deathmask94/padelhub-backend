const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, HeadingLevel,
  BorderStyle, ShadingType, VerticalAlign, Header, Footer,
  PageNumber, PageBreak,
} = require("docx");
const fs   = require("fs");
const path = require("path");

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  azulOscuro : "1B3A6B",
  azulMedio  : "2E75B6",
  azulClaro  : "D6E4F0",
  azulMuyClaro: "EAF3FB",
  gris       : "F2F2F2",
  blanco     : "FFFFFF",
  rojo       : "C00000",
  naranja    : "ED7D31",
  verde      : "70AD47",
  negro      : "000000",
};

const B = { style: BorderStyle.SINGLE, size: 4, color: "BDD7EE" };
const BS = { style: BorderStyle.SINGLE, size: 6, color: C.azulOscuro };
const BN = { style: BorderStyle.NONE,   size: 0, color: C.blanco };

// ─── Helpers de párrafo ───────────────────────────────────────────────────────
const p = (text, opts = {}) => new Paragraph({
  alignment: opts.center ? AlignmentType.CENTER : opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
  spacing: opts.spacing ?? {},
  children: [new TextRun({
    text,
    bold:    opts.bold    ?? false,
    italics: opts.italic  ?? false,
    size:    opts.size    ?? 20,
    color:   opts.color   ?? C.negro,
    font:    "Calibri",
  })],
});

const pRuns = (runs, opts = {}) => new Paragraph({
  alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
  spacing: opts.spacing ?? {},
  children: runs,
});

const run = (text, opts = {}) => new TextRun({
  text,
  bold:    opts.bold    ?? false,
  italics: opts.italic  ?? false,
  size:    opts.size    ?? 20,
  color:   opts.color   ?? C.negro,
  font:    "Calibri",
});

const empty = () => new Paragraph({ children: [new TextRun({ text: "" })] });

// ─── Helpers de celda ─────────────────────────────────────────────────────────
function cHdr(text, span = 1) {
  return new TableCell({
    columnSpan: span,
    shading: { type: ShadingType.SOLID, color: C.azulOscuro },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: { top: BS, bottom: BS, left: BS, right: BS },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: C.blanco, size: 18, font: "Calibri" })],
    })],
  });
}

function cId(text, shade = C.azulMedio) {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: shade },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    borders: { top: B, bottom: B, left: B, right: B },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: C.blanco, size: 16, font: "Calibri" })],
    })],
  });
}

function cTxt(text, shade = C.blanco, italic = false) {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: shade },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    borders: { top: B, bottom: B, left: B, right: B },
    children: [new Paragraph({
      children: [new TextRun({ text: String(text), italics: italic, size: 17, font: "Calibri" })],
    })],
  });
}

function cBold(text, shade = C.blanco) {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: shade },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    borders: { top: B, bottom: B, left: B, right: B },
    children: [new Paragraph({
      children: [new TextRun({ text: String(text), bold: true, size: 17, font: "Calibri" })],
    })],
  });
}

function cPrio(prio) {
  const cfg = {
    "Alta":  { color: C.rojo,    label: "▪ Alta"  },
    "Media": { color: C.naranja, label: "▪ Media" },
    "Baja":  { color: C.verde,   label: "▪ Baja"  },
  }[prio] ?? { color: C.gris, label: prio };
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: cfg.color },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    borders: { top: B, bottom: B, left: B, right: B },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: cfg.label, bold: true, color: C.blanco, size: 16, font: "Calibri" })],
    })],
  });
}

function cMeta(label, value) {
  return [
    new TableCell({
      shading: { type: ShadingType.SOLID, color: C.azulOscuro },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [run(label, { bold: true, color: C.blanco, size: 20 })] })],
    }),
    new TableCell({
      shading: { type: ShadingType.SOLID, color: C.azulClaro },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [run(value, { size: 20 })] })],
    }),
  ];
}

// ─── Tabla de casos de prueba ─────────────────────────────────────────────────
function buildTestTable(rows) {
  const header = new TableRow({
    tableHeader: true,
    children: [
      cHdr("ID"),
      cHdr("Nombre del caso"),
      cHdr("Precondición"),
      cHdr("Pasos"),
      cHdr("Resultado esperado"),
      cHdr("Prio."),
    ],
  });
  const dataRows = rows.map((r, i) => {
    const shade = i % 2 === 0 ? C.azulMuyClaro : C.blanco;
    return new TableRow({
      children: [
        cId(r.id),
        cBold(r.nombre, shade),
        cTxt(r.precond, shade, true),
        cTxt(r.pasos, shade),
        cTxt(r.esperado, shade),
        cPrio(r.prio),
      ],
    });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [900, 2200, 2000, 2200, 2200, 700],
    rows: [header, ...dataRows],
  });
}

// ─── Encabezado de sección ────────────────────────────────────────────────────
function sectionTitle(num, title) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [
      new TableCell({
        shading: { type: ShadingType.SOLID, color: C.azulOscuro },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        borders: { top: BN, bottom: BN, left: BN, right: BN },
        children: [new Paragraph({
          children: [new TextRun({ text: `${num}. ${title}`, bold: true, color: C.blanco, size: 26, font: "Calibri" })],
        })],
      }),
    ]})],
  });
}

// ─── Banner de módulo ─────────────────────────────────────────────────────────
function moduleBanner(icon, title, subtitle) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [
      new TableCell({
        shading: { type: ShadingType.SOLID, color: C.azulMedio },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        borders: { top: BS, bottom: BS, left: BS, right: BS },
        children: [new Paragraph({
          children: [
            new TextRun({ text: `${icon}  `, size: 24, font: "Segoe UI Emoji" }),
            new TextRun({ text: title, bold: true, color: C.blanco, size: 24, font: "Calibri" }),
            new TextRun({ text: `  —  ${subtitle}`, color: C.azulClaro, size: 20, font: "Calibri", italics: true }),
          ],
        })],
      }),
    ]})],
  });
}

// ─── Título de subsección ─────────────────────────────────────────────────────
function subTitle(num, title, desc) {
  return [
    new Paragraph({
      spacing: { before: 240, after: 80 },
      children: [new TextRun({ text: `${num}  ${title}`, bold: true, color: C.azulOscuro, size: 22, font: "Calibri" })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 120 },
      children: [new TextRun({ text: desc, size: 18, italics: true, color: "444444", font: "Calibri" })],
    }),
  ];
}

// ─── Tabla genérica (2 columnas) ──────────────────────────────────────────────
function table2col(rows, w1 = 30, w2 = 70) {
  const hdrRow = new TableRow({
    tableHeader: true,
    children: rows[0].map(h => cHdr(h)),
  });
  const dataRows = rows.slice(1).map((r, i) => {
    const shade = i % 2 === 0 ? C.azulMuyClaro : C.blanco;
    return new TableRow({ children: r.map(v => cTxt(v, shade)) });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [hdrRow, ...dataRows],
  });
}

// ─── Tabla genérica (4 columnas para ambientes/defectos) ─────────────────────
function table4col(rows) {
  const hdrRow = new TableRow({
    tableHeader: true,
    children: rows[0].map(h => cHdr(h)),
  });
  const dataRows = rows.slice(1).map((r, i) => {
    const shade = i % 2 === 0 ? C.azulMuyClaro : C.blanco;
    return new TableRow({ children: r.map(v => cTxt(v, shade)) });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [hdrRow, ...dataRows],
  });
}

// ─── Texto evidencia (monospace) ─────────────────────────────────────────────
function evidenceBlock(lines) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [
      new TableCell({
        shading: { type: ShadingType.SOLID, color: "1E1E1E" },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        borders: { top: BS, bottom: BS, left: BS, right: BS },
        children: lines.map(l => new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text: l, color: "D4D4D4", size: 14, font: "Courier New" })],
        })),
      }),
    ]})],
  });
}

// ─── DATOS DE PRUEBA ──────────────────────────────────────────────────────────

// 3. AUTENTICACIÓN
const authUnit = [
  { id:"AU-01", nombre:"Login exitoso con credenciales válidas",       precond:"Usuario existe en BD con password hash bcrypt",     pasos:"POST /api/auth/login {rut, password válidos}",                        esperado:"HTTP 200; message: '¡Inicio de sesión exitoso!'; token JWT",          prio:"Alta"  },
  { id:"AU-02", nombre:"Login con RUT inexistente",                    precond:"RUT no registrado en BD",                           pasos:"POST /api/auth/login {rut: 99999999}",                                 esperado:"HTTP 401 — credenciales inválidas",                                  prio:"Alta"  },
  { id:"AU-03", nombre:"Login con contraseña incorrecta",              precond:"RUT válido, password distinto al almacenado",       pasos:"POST /api/auth/login con password erróneo",                           esperado:"HTTP 401 — contraseña no coincide con hash",                         prio:"Alta"  },
  { id:"AU-04", nombre:"Refresh token inexistente en BD",              precond:"Token de refresco no registrado",                   pasos:"POST /api/auth/refresh {refreshToken: 'invalido'}",                   esperado:"HTTP 401 — token no encontrado",                                     prio:"Alta"  },
  { id:"AU-05", nombre:"Refresh token expirado",                       precond:"Token con expires_at en el pasado",                 pasos:"POST /api/auth/refresh con token vencido",                            esperado:"HTTP 401 — token expirado, no emite nuevo access token",             prio:"Alta"  },
  { id:"AU-06", nombre:"Rotación exitosa de refresh token",            precond:"refreshToken válido y vigente en BD",               pasos:"POST /api/auth/refresh con token válido",                             esperado:"HTTP 200; nuevo accessToken y refreshToken rotado en BD",            prio:"Alta"  },
  { id:"AU-07", nombre:"Forgot password — email no registrado",        precond:"Email no existe en BD",                            pasos:"POST /api/auth/forgot-password {email inexistente}",                  esperado:"HTTP 200 — respuesta genérica (no revela existencia)",               prio:"Media" },
  { id:"AU-08", nombre:"Forgot password — genera token de reset",      precond:"Email registrado en BD",                           pasos:"POST /api/auth/forgot-password {email válido}",                       esperado:"HTTP 200; token creado en BD; email enviado vía Resend",            prio:"Alta"  },
];

const authInteg = [
  { id:"AI-01", nombre:"Login retorna accessToken y refreshToken",     precond:"Usuario en BD de test",                             pasos:"POST /api/auth/login con credenciales válidas",                       esperado:"HTTP 200; body con accessToken, refreshToken; persiste en BD",       prio:"Alta"  },
  { id:"AI-02", nombre:"Login con credenciales incorrectas",           precond:"Usuario registrado con password distinto",          pasos:"POST /api/auth/login con password incorrecto",                        esperado:"HTTP 401; sin tokens emitidos",                                      prio:"Alta"  },
  { id:"AI-03", nombre:"Refresco exitoso con rotación en BD",          precond:"refreshToken válido en BD de test",                 pasos:"POST /api/auth/refresh; luego usar nuevo token",                     esperado:"HTTP 200; accessToken nuevo; refreshToken anterior eliminado",       prio:"Alta"  },
  { id:"AI-04", nombre:"Acceso a ruta protegida con token válido",     precond:"accessToken vigente",                              pasos:"GET /api/matches con Authorization: Bearer <token>",                  esperado:"HTTP 200; datos del recurso retornados",                            prio:"Alta"  },
  { id:"AI-05", nombre:"Acceso a ruta protegida sin token",            precond:"Sin header Authorization",                         pasos:"GET /api/matches sin header Authorization",                           esperado:"HTTP 401; mensaje 'No autorizado'",                                  prio:"Alta"  },
];

const authE2E = [
  { id:"AE-01", nombre:"Flujo completo de autenticación",              precond:"Usuario registrado; navegador limpio",              pasos:"1.Login 2.Navegar ruta protegida 3.Esperar expiración 4.Refresh 5.Acceder",   esperado:"Acceso concedido en cada paso; token refrescado automáticamente",    prio:"Alta"  },
  { id:"AE-02", nombre:"Persistencia de sesión tras recarga",          precond:"Usuario autenticado en la app",                    pasos:"1.Login 2.Recargar página (F5) 3.Verificar estado sesión",            esperado:"Usuario permanece autenticado; datos de sesión consistentes",        prio:"Media" },
  { id:"AE-03", nombre:"Cierre de sesión limpia ambos tokens",         precond:"Usuario con sesión activa",                        pasos:"1.Logout 2.Intentar ruta protegida 3.Intentar refresh",               esperado:"Redirige al login; ambos tokens inválidos en BD",                    prio:"Alta"  },
];

const authPerf = [
  { id:"AP-01", nombre:"Throughput de login concurrente",              precond:"BD con 500 usuarios de prueba",                    pasos:"100 solicitudes POST /api/auth/login concurrentes con Artillery",     esperado:"P95 < 300ms; tasa de error < 1%; sin bloqueos de BD",               prio:"Media" },
  { id:"AP-02", nombre:"Latencia de verificación JWT",                 precond:"1000 tokens válidos generados",                    pasos:"Ejecutar verifyToken() 1000 veces en bucle y medir tiempo",           esperado:"Tiempo promedio < 2ms por verificación; sin degradación",            prio:"Baja"  },
];

// 4. USUARIOS Y PERFILES
const usersUnit = [
  { id:"UU-01", nombre:"Registro exitoso de nuevo jugador",            precond:"RUT y teléfono no registrados en BD",              pasos:"POST /api/users {rut, dv_rut, phone, name, password, zone}",         esperado:"HTTP 201; usuario creado; token JWT y refreshToken retornados",      prio:"Alta"  },
  { id:"UU-02", nombre:"Listar todos los jugadores activos",           precond:"BD con jugadores registrados",                     pasos:"GET /api/users con token válido",                                     esperado:"HTTP 200; array de jugadores activos",                               prio:"Media" },
  { id:"UU-03", nombre:"Obtener perfil por RUT",                       precond:"Jugador con RUT 12345678 en BD",                   pasos:"GET /api/users/12345678 con token válido",                            esperado:"HTTP 200; perfil con MMR, zona, nivel, stats",                       prio:"Alta"  },
  { id:"UU-04", nombre:"Eliminar jugador por RUT",                     precond:"Jugador con RUT existe en BD",                     pasos:"DELETE /api/users {rut: 12345678}",                                   esperado:"HTTP 200; jugador eliminado de BD",                                  prio:"Media" },
  { id:"UU-05", nombre:"Upload foto de perfil sin archivo",            precond:"Request multipart sin campo 'file'",               pasos:"POST /api/users/{rut}/profile/photo sin adjunto",                    esperado:"HTTP 400 — se requiere archivo",                                     prio:"Alta"  },
  { id:"UU-06", nombre:"Eliminar foto de perfil exitosamente",         precond:"photo_url existente en Cloudinary",                pasos:"DELETE /api/users/{rut}/profile/photo con token válido",              esperado:"HTTP 200; foto eliminada de Cloudinary y campo photo_url limpiado", prio:"Media" },
];

const usersInteg = [
  { id:"UI-01", nombre:"Registro con RUT duplicado rechazado",         precond:"RUT 12345678 ya registrado en BD",                 pasos:"POST /api/users con mismo RUT",                                       esperado:"HTTP 409 — RUT ya registrado",                                       prio:"Alta"  },
  { id:"UI-02", nombre:"Perfil incluye ranking actual",                precond:"Usuario con partidos jugados",                     pasos:"GET /api/users/{rut}/profile con token válido",                       esperado:"HTTP 200; campo ranking calculado desde tabla mmr_history",          prio:"Media" },
  { id:"UI-03", nombre:"Upload foto actualiza photo_url en BD",        precond:"Cloudinary configurado; imagen < 5MB",             pasos:"POST /api/users/{rut}/profile/photo con imagen válida",               esperado:"HTTP 200; photo_url actualizado; URL apunta a Cloudinary",           prio:"Alta"  },
  { id:"UI-04", nombre:"Historial MMR retorna variaciones semanales",  precond:"Usuario con partidos finalizados",                 pasos:"GET /api/users/{rut}/mmr-history",                                    esperado:"HTTP 200; array de entradas ordenadas por fecha desc",               prio:"Media" },
];

const usersE2E = [
  { id:"UE-01", nombre:"Flujo registro y actualización de perfil",     precond:"Navegador limpio; formulario de registro",         pasos:"1.Registrar 2.Login 3.Editar nombre y zona 4.Verificar cambios",     esperado:"Perfil actualizado visible en la app sin re-login",                  prio:"Alta"  },
  { id:"UE-02", nombre:"Ciclo completo foto de perfil",                precond:"Usuario autenticado; imagen disponible",           pasos:"1.Subir foto 2.Verificar preview 3.Eliminar 4.Verificar avatar default", esperado:"Foto visible tras subir; avatar default tras eliminar",           prio:"Media" },
];

const usersPerf = [
  { id:"UP-01", nombre:"Listado paginado con 10.000 usuarios",         precond:"BD de test con 10.000 registros",                  pasos:"GET /api/users?page=1 con 50 usuarios concurrentes",                  esperado:"P95 < 400ms; paginación correcta sin timeouts",                     prio:"Baja"  },
];

// 5. MATCHMAKING Y SUGERENCIAS
const matchmakingUnit = [
  { id:"KU-01", nombre:"Sin token — rechaza la solicitud",             precond:"Request sin header Authorization",                 pasos:"GET /api/users/suggestions sin token",                                esperado:"HTTP 401",                                                          prio:"Alta"  },
  { id:"KU-02", nombre:"Usuario autenticado no existe en BD",          precond:"Token válido pero userId sin registro",            pasos:"GET /api/users/suggestions con token de usuario fantasma",            esperado:"HTTP 404 — usuario no encontrado",                                   prio:"Alta"  },
  { id:"KU-03", nombre:"Sugerencias con ≥5 rivales en rango ±150",    precond:"Usuario MMR 1000; 5+ rivales en 850-1150",         pasos:"GET /api/users/suggestions",                                          esperado:"HTTP 200; lista con % de compatibilidad; rango ±150",                prio:"Alta"  },
  { id:"KU-04", nombre:"Expansión a ±300 si ±150 da menos de 5",      precond:"Pocos rivales en ±150; más en ±300",               pasos:"GET /api/users/suggestions",                                          esperado:"HTTP 200; rango expandido automáticamente a ±300",                   prio:"Alta"  },
  { id:"KU-05", nombre:"Fallback — retorna lo disponible (<5)",        precond:"Menos de 5 rivales en todos los rangos",          pasos:"GET /api/users/suggestions",                                          esperado:"HTTP 200; retorna los rivales disponibles aunque sean <5",          prio:"Media" },
  { id:"KU-06", nombre:"Sugerencias ordenadas por compatibilidad desc",precond:"Múltiples rivales con distintos MMR",             pasos:"GET /api/users/suggestions",                                          esperado:"HTTP 200; primer elemento = mayor % compat; orden descendente",      prio:"Alta"  },
];

const matchmakingInteg = [
  { id:"KI-01", nombre:"Búsqueda por zona filtra correctamente",       precond:"Jugadores en distintas zonas en BD",               pasos:"GET /api/users/search?zone=Viña del Mar",                             esperado:"HTTP 200; solo jugadores de esa zona",                               prio:"Alta"  },
  { id:"KI-02", nombre:"Filtro MMR mínimo y máximo funciona",          precond:"Jugadores con distintos MMR en BD",                pasos:"GET /api/users/search?mmr_min=900&mmr_max=1100",                     esperado:"HTTP 200; solo jugadores dentro del rango especificado",             prio:"Media" },
  { id:"KI-03", nombre:"Búsqueda por RUT exacto retorna jugador",      precond:"Jugador con RUT 12345678 en BD",                   pasos:"GET /api/users/search-rut?rut=12345678",                              esperado:"HTTP 200; jugador encontrado; HTTP 404 si no existe",                prio:"Alta"  },
];

const matchmakingE2E = [
  { id:"KE-01", nombre:"Flujo buscar y ver perfil de rival",           precond:"Dos cuentas en la app",                           pasos:"1.Buscar rival 2.Ver perfil 3.Ver stats y MMR",                       esperado:"Perfil completo del rival visible con datos actualizados",           prio:"Media" },
  { id:"KE-02", nombre:"Sugerencias se actualizan tras partido",       precond:"Usuario con partido registrado",                  pasos:"1.Ver sugerencias antes 2.Jugar partido 3.Ver sugerencias después",   esperado:"% compatibilidad recalculado con nuevo MMR post-partido",            prio:"Baja"  },
];

const matchmakingPerf = [
  { id:"KP-01", nombre:"Respuesta de sugerencias bajo carga",          precond:"BD con 5.000 usuarios activos",                   pasos:"50 solicitudes GET /api/users/suggestions concurrentes",              esperado:"P95 < 500ms; resultados consistentes sin datos cruzados",           prio:"Baja"  },
];

// 6. GESTIÓN DE PARTIDOS
const matchesUnit = [
  { id:"MU-01", nombre:"Crear partido con todos los campos requeridos",precond:"Datos válidos de partido",                        pasos:"POST /api/matches {organizer_id, club, format, match_date, match_time}", esperado:"HTTP 201; partido creado con status 'open'",                     prio:"Alta"  },
  { id:"MU-02", nombre:"Crear partido sin campos obligatorios",        precond:"Body vacío {}",                                   pasos:"POST /api/matches {}",                                                esperado:"HTTP 400 — faltan campos obligatorios",                              prio:"Alta"  },
  { id:"MU-03", nombre:"Cancelar por usuario no organizador",          precond:"Partido open; token de otro usuario",             pasos:"POST /api/matches/{id}/cancel con token de no-organizador",          esperado:"HTTP 403 — solo el organizador puede cancelar",                      prio:"Alta"  },
  { id:"MU-04", nombre:"Cancelar partido ya cancelado",               precond:"Partido con status 'cancelled'",                  pasos:"POST /api/matches/{id}/cancel",                                       esperado:"HTTP 400 — partido ya está cancelado",                               prio:"Alta"  },
  { id:"MU-05", nombre:"Cancelación exitosa por el organizador",       precond:"Partido 'open'; token del organizador",           pasos:"POST /api/matches/{id}/cancel con token correcto",                   esperado:"HTTP 200; status 'cancelled'; notificaciones enviadas",              prio:"Alta"  },
  { id:"MU-06", nombre:"Resultado por usuario no organizador",         precond:"Partido confirmado; token de participante",       pasos:"POST /api/matches/{id}/result con token de no-organizador",         esperado:"HTTP 403",                                                          prio:"Alta"  },
  { id:"MU-07", nombre:"Resultado en partido no confirmado",           precond:"Partido con status 'open'",                      pasos:"POST /api/matches/{id}/result",                                       esperado:"HTTP 400 — partido debe estar confirmado",                           prio:"Alta"  },
  { id:"MU-08", nombre:"Resultado exitoso con cambios ELO (K=32)",     precond:"Partido confirmado; organizador autenticado",     pasos:"POST /api/matches/{id}/result {winner, organizer_team, scores}",    esperado:"HTTP 200; campo 'changes' con delta MMR de cada jugador",           prio:"Alta"  },
];

const matchesInteg = [
  { id:"MI-01", nombre:"Creación y listado de partido en BD",          precond:"Usuario autenticado; BD de test",                 pasos:"POST /api/matches; luego GET /api/matches",                          esperado:"HTTP 201 al crear; HTTP 200 lista incluye el partido nuevo",         prio:"Alta"  },
  { id:"MI-02", nombre:"Unirse a partido abierto",                     precond:"Partido con status 'open' y cupo disponible",    pasos:"POST /api/matches/{id}/join con token válido",                       esperado:"HTTP 200; registro en match_players; partido se confirma si lleno",  prio:"Alta"  },
  { id:"MI-03", nombre:"Resultado actualiza MMR en BD",                precond:"Partido confirmado con jugadores",                pasos:"POST /api/matches/{id}/result con resultado válido",                  esperado:"HTTP 200; nuevas filas en mmr_history; MMR actualizado en users",    prio:"Alta"  },
  { id:"MI-04", nombre:"Invitación notifica al jugador invitado",      precond:"Organizador y jugador existentes",                pasos:"POST /api/matches/{id}/invite {userId}",                             esperado:"HTTP 201; notificación in-app creada; email best-effort enviado",    prio:"Media" },
];

const matchesE2E = [
  { id:"ME-01", nombre:"Flujo completo creación-resultado-MMR",        precond:"2+ usuarios registrados y autenticados",          pasos:"1.Crear 2.Unirse 3.Confirmar 4.Registrar resultado 5.Ver MMR",       esperado:"MMR de ganador sube; MMR de perdedor baja; historial visible",       prio:"Alta"  },
  { id:"ME-02", nombre:"Partido visible en sección 'Mis partidos'",    precond:"Usuario con partidos creados y jugados",          pasos:"1.Crear partido 2.Navegar a Mis Partidos",                            esperado:"Partido aparece con estado correcto en la sección del usuario",      prio:"Media" },
];

const matchesPerf = [
  { id:"MP-01", nombre:"Listado con carga de 1.000 partidos",          precond:"BD de test con 1.000 matches",                   pasos:"GET /api/matches con 30 usuarios concurrentes y paginación",         esperado:"P95 < 500ms; paginación correcta sin datos duplicados",             prio:"Media" },
];

// 7. VALORACIONES Y REPUTACIÓN
const ratingsUnit = [
  { id:"VU-01", nombre:"Valorar sin token de autenticación",           precond:"Request sin header Authorization",                pasos:"POST /api/matches/{id}/rate sin token",                               esperado:"HTTP 401",                                                          prio:"Alta"  },
  { id:"VU-02", nombre:"Valorar en partido no finalizado",             precond:"Partido con status 'confirmed'",                  pasos:"POST /api/matches/{id}/rate {ratings:[...]}",                         esperado:"HTTP 400 — el partido debe estar finalizado",                        prio:"Alta"  },
  { id:"VU-03", nombre:"Valorar fuera de ventana de 24h",             precond:"Partido finalizado hace 25 horas",                pasos:"POST /api/matches/{id}/rate con updated_at > 24h",                   esperado:"HTTP 403 — ventana de valoración expirada",                          prio:"Alta"  },
  { id:"VU-04", nombre:"Auto-valoración rechazada",                    precond:"rated_id igual al userId del token",              pasos:"POST /api/matches/{id}/rate {rated_id: mismo userId}",               esperado:"HTTP 400 — no se puede valorar a uno mismo",                         prio:"Alta"  },
  { id:"VU-05", nombre:"Escala fuera de rango (1-5)",                  precond:"Rating con valor > 5",                           pasos:"POST /api/matches/{id}/rate {fair_play: 6}",                          esperado:"HTTP 400 — valor fuera de escala permitida",                         prio:"Alta"  },
  { id:"VU-06", nombre:"Valoración exitosa con notificación",          precond:"Partido finalizado; rater es participante",       pasos:"POST /api/matches/{id}/rate {ratings: [{rated_id, 1-5 vals}]}",      esperado:"HTTP 200; valoraciones guardadas; notif. anónima a cada valorado", prio:"Alta"  },
  { id:"VU-07", nombre:"RUT inválido en consulta de reputación",       precond:"rut: 'abc' (no numérico)",                       pasos:"GET /api/users/abc/ratings",                                          esperado:"HTTP 400 — RUT debe ser numérico",                                   prio:"Media" },
  { id:"VU-08", nombre:"Reputación de usuario sin valoraciones",       precond:"Usuario en BD sin valoraciones",                 pasos:"GET /api/users/{rut}/ratings",                                        esperado:"HTTP 404 — usuario no encontrado",                                   prio:"Media" },
  { id:"VU-09", nombre:"Promedios redondeados a 1 decimal",            precond:"Agregado: fair_play 4.333, punctuality 3.666",   pasos:"GET /api/users/{rut}/ratings",                                        esperado:"HTTP 200; avg_fair_play: 4.3; avg_punctuality: 3.7",                prio:"Alta"  },
  { id:"VU-10", nombre:"Usuario sin valoraciones — retorna nulls",     precond:"Usuario con 0 valoraciones en BD",               pasos:"GET /api/users/{rut}/ratings",                                        esperado:"HTTP 200; total: 0; avg_fair_play: null",                           prio:"Media" },
];

const ratingsInteg = [
  { id:"VI-01", nombre:"Valoración persiste en BD de test",            precond:"Match finalizado; 2 jugadores",                  pasos:"POST /api/matches/{id}/rate; luego consultar player_ratings en BD",  esperado:"2 registros en player_ratings; rated_ids correctos",                prio:"Alta"  },
  { id:"VI-02", nombre:"No se puede valorar dos veces el mismo match", precond:"Rating ya enviado por el usuario",               pasos:"POST /api/matches/{id}/rate una segunda vez",                         esperado:"HTTP 409 o skipDuplicates aplicado silenciosamente",                 prio:"Media" },
  { id:"VI-03", nombre:"Reputación refleja promedio acumulado",        precond:"Usuario con 5 valoraciones en BD",               pasos:"GET /api/users/{rut}/ratings",                                        esperado:"HTTP 200; promedios calculados sobre los 5 registros",               prio:"Alta"  },
];

const ratingsE2E = [
  { id:"VE-01", nombre:"Flujo completo valoración y ver reputación",   precond:"Partido finalizado; usuarios autenticados",      pasos:"1.Registrar valoraciones 2.Navegar al perfil del valorado 3.Ver rating", esperado:"Reputación visible y actualizada en el perfil del jugador",     prio:"Alta"  },
  { id:"VE-02", nombre:"Botón valorar desaparece tras 24h",            precond:"Partido finalizado hace > 24h",                  pasos:"Navegar al detalle del partido",                                      esperado:"Botón 'Valorar' no visible; sin opción de enviar valoraciones",      prio:"Media" },
];

const ratingsPerf = [
  { id:"VP-01", nombre:"Cálculo de promedios con 10.000 valoraciones", precond:"BD con 10.000 registros en player_ratings",      pasos:"GET /api/users/{rut}/ratings con alta concurrencia",                  esperado:"P95 < 300ms; promedios correctos con índice en rated_id",           prio:"Baja"  },
];

// 8. NOTIFICACIONES
const notifsUnit = [
  { id:"NU-01", nombre:"Obtener notificaciones sin token",             precond:"Request sin header Authorization",                pasos:"GET /api/notifications sin token",                                    esperado:"HTTP 401",                                                          prio:"Alta"  },
  { id:"NU-02", nombre:"Obtener lista con unread_count correcto",      precond:"3 notifs en BD: 2 read:false, 1 read:true",      pasos:"GET /api/notifications con token válido",                             esperado:"HTTP 200; unread_count: 2; notifications.length: 3",                prio:"Alta"  },
  { id:"NU-03", nombre:"Todas leídas — unread_count 0",               precond:"Todas las notifs con read:true",                  pasos:"GET /api/notifications",                                              esperado:"HTTP 200; unread_count: 0",                                         prio:"Alta"  },
  { id:"NU-04", nombre:"Sin notificaciones — lista vacía",             precond:"BD sin notifs para el usuario",                  pasos:"GET /api/notifications",                                              esperado:"HTTP 200; notifications: []; unread_count: 0",                      prio:"Media" },
  { id:"NU-05", nombre:"Marcar como leídas sin token",                 precond:"Request PATCH sin Authorization",                 pasos:"PATCH /api/notifications sin token",                                  esperado:"HTTP 401",                                                          prio:"Alta"  },
  { id:"NU-06", nombre:"Marcar todas como leídas",                     precond:"2 notificaciones no leídas del usuario",         pasos:"PATCH /api/notifications con token válido",                           esperado:"HTTP 200; updateMany ejecutado con read:true para el usuario",       prio:"Alta"  },
];

const notifsInteg = [
  { id:"NI-01", nombre:"Invitación a partido genera notif in-app",     precond:"Match creado; jugador con userId válido",         pasos:"POST /api/matches/{id}/invite; luego GET /api/notifications",        esperado:"1 notificación nueva con título 'Te invitaron a un partido'",       prio:"Alta"  },
  { id:"NI-02", nombre:"Cancelación genera notifs a todos los jugadores",precond:"Match con 3 jugadores inscritos",              pasos:"POST /api/matches/{id}/cancel; luego GET /api/notifications",        esperado:"3 notificaciones 'Partido cancelado' para los jugadores",           prio:"Alta"  },
  { id:"NI-03", nombre:"Valoración genera notif anónima al valorado",  precond:"Valoración enviada tras partido",                pasos:"POST /api/matches/{id}/rate; luego GET /api/notifications del valorado", esperado:"1 notif 'Recibiste una valoración' sin revelar quién valoró",   prio:"Media" },
];

const notifsE2E = [
  { id:"NE-01", nombre:"Badge de campana se actualiza en NavBar",       precond:"Usuario con notificaciones no leídas",          pasos:"1.Login 2.Verificar badge rojo en campana 3.Leer todo 4.Verificar",   esperado:"Badge muestra count; desaparece al leer todas",                     prio:"Alta"  },
  { id:"NE-02", nombre:"Flujo completo invitación — notificación",      precond:"Dos cuentas; partido creado",                   pasos:"1.Invitar desde cuenta A 2.Verificar notif en cuenta B",              esperado:"Notificación visible; badge actualizado; puede aceptar/rechazar",   prio:"Alta"  },
];

const notifsPerf = [
  { id:"NP-01", nombre:"Carga de notificaciones bajo alta concurrencia",precond:"100 usuarios con 30+ notifs cada uno",          pasos:"100 GET /api/notifications concurrentes",                             esperado:"P95 < 200ms; respuestas con datos correctos por usuario",           prio:"Baja"  },
];

// 9. ADMINISTRACIÓN
const adminUnit = [
  { id:"ADU-01", nombre:"Login admin exitoso con JWT 4h",              precond:"Usuario con role:'admin' en BD",                 pasos:"POST /api/admin/login {rut, password}",                               esperado:"HTTP 200; token JWT (4h); datos del admin; log en auditoría",       prio:"Alta"  },
  { id:"ADU-02", nombre:"Contraseña incorrecta del admin",             precond:"RUT válido; password erróneo",                   pasos:"POST /api/admin/login con password incorrecto",                       esperado:"HTTP 401",                                                          prio:"Alta"  },
  { id:"ADU-03", nombre:"Usuario sin rol admin rechazado",             precond:"RUT de jugador normal (role:'player')",          pasos:"POST /api/admin/login con RUT de jugador",                            esperado:"HTTP 401 — no es administrador",                                     prio:"Alta"  },
  { id:"ADU-04", nombre:"Ajuste MMR sin campo motivo",                 precond:"Token de admin válido",                         pasos:"PATCH /api/admin/users/{id}/mmr {new_mmr: 1100} sin reason",         esperado:"HTTP 400 — motivo obligatorio",                                      prio:"Alta"  },
  { id:"ADU-05", nombre:"Ajuste MMR fuera de rango (0-9999)",         precond:"Token admin; nuevo MMR = 99999",                 pasos:"PATCH /api/admin/users/{id}/mmr {new_mmr: 99999, reason:'...'}",     esperado:"HTTP 400 — valor fuera de rango permitido",                          prio:"Alta"  },
  { id:"ADU-06", nombre:"Ajuste MMR a usuario inexistente",            precond:"ID de usuario que no existe en BD",              pasos:"PATCH /api/admin/users/{id}/mmr {new_mmr, reason}",                  esperado:"HTTP 404 — usuario no encontrado",                                   prio:"Alta"  },
  { id:"ADU-07", nombre:"Ajuste MMR exitoso con auditoría",            precond:"Usuario existente; token admin válido",          pasos:"PATCH /api/admin/users/{id}/mmr {new_mmr:1150, reason:'corrección'}",esperado:"HTTP 200; old_mmr:1000; new_mmr:1150; $transaction ejecutado",     prio:"Alta"  },
  { id:"ADU-08", nombre:"Métricas de plataforma retorna todos los KPIs",precond:"BD con datos; token admin",                   pasos:"GET /api/admin/metrics",                                              esperado:"HTTP 200; users, matches, avg_mmr (redondeado), zones, levels",     prio:"Alta"  },
  { id:"ADU-09", nombre:"avg_mmr redondeado correctamente",            precond:"Promedio en BD: 1050.5",                        pasos:"GET /api/admin/metrics",                                              esperado:"avg_mmr: 1051 (redondeo matemático estándar)",                      prio:"Media" },
  { id:"ADU-10", nombre:"Audit log paginado con metadatos",            precond:"2 logs en BD; token admin",                     pasos:"GET /api/admin/audit-logs",                                           esperado:"HTTP 200; logs[], total:2, page:1, pages:1, admins[], actions[]",    prio:"Alta"  },
  { id:"ADU-11", nombre:"Audit log vacío — lista vacía sin error",     precond:"BD sin registros en admin_audit_logs",          pasos:"GET /api/admin/audit-logs",                                           esperado:"HTTP 200; total:0; logs:[]",                                         prio:"Media" },
];

const adminInteg = [
  { id:"ADI-01", nombre:"Listar usuarios con filtros desde panel",     precond:"BD con jugadores de distintas zonas/niveles",    pasos:"GET /api/admin/users?zone=Viña&status=active",                       esperado:"HTTP 200; solo usuarios que cumplen los filtros",                    prio:"Alta"  },
  { id:"ADI-02", nombre:"Suspender usuario registra en auditoría",     precond:"Usuario activo; admin autenticado",              pasos:"PATCH /api/admin/users/{id} {is_active: false}",                     esperado:"HTTP 200; usuario inactivo; entrada USER_UPDATE en audit log",       prio:"Alta"  },
  { id:"ADI-03", nombre:"Exportar audit log en CSV con BOM UTF-8",     precond:"Logs de auditoría en BD; admin autenticado",     pasos:"GET /api/admin/audit-logs/export",                                   esperado:"Content-Type text/csv; BOM ﻿; archivo descargable con ñ/tildes OK", prio:"Media" },
  { id:"ADI-04", nombre:"Anular resultado revierte MMR en transacción",precond:"Match finalizado con resultado registrado",      pasos:"POST /api/admin/matches/{id}/annul-result",                          esperado:"HTTP 200; MMR revertido; log MATCH_RESULT_ANNULLED en auditoría",    prio:"Alta"  },
];

const adminE2E = [
  { id:"ADE-01", nombre:"Flujo login admin — ver métricas — exportar",  precond:"Admin registrado; navegador limpio",            pasos:"1.Login admin 2.Ver métricas 3.Ver auditoría 4.Exportar CSV",        esperado:"Todos los pasos exitosos; CSV descargable con datos reales",        prio:"Alta"  },
  { id:"ADE-02", nombre:"Ajuste MMR desde perfil de jugador en panel",  precond:"Admin autenticado; jugador seleccionado",       pasos:"1.Buscar jugador 2.Ingresar nuevo MMR y motivo 3.Confirmar",         esperado:"MMR actualizado; historial visible; email enviado al jugador",       prio:"Alta"  },
];

const adminPerf = [
  { id:"ADP-01", nombre:"Listado de usuarios con 50.000 registros",    precond:"BD con 50.000 usuarios",                        pasos:"GET /api/admin/users?page=1 con 20 admins concurrentes",              esperado:"P95 < 800ms; paginación correcta; índices utilizados",              prio:"Baja"  },
];

// 10. RESPALDO DE BD
const backupUnit = [
  { id:"BU-01", nombre:"Iteración dinámica de modelos Prisma",         precond:"Cliente Prisma inicializado con 6 modelos",      pasos:"Llamar getModelNames(prismaClient)",                                  esperado:"Array con ['users','matches','match_players','match_results','mmr_history','refresh_tokens']", prio:"Alta" },
  { id:"BU-02", nombre:"Estructura correcta de backup_info",           precond:"Llamada a buildBackupMetadata('MANUAL')",        pasos:"Ejecutar buildBackupMetadata con tipo MANUAL",                        esperado:"Objeto con type, backup_date ISO 8601 y database_provider",         prio:"Media" },
  { id:"BU-03", nombre:"Serialización JSON sin pérdida de datos",      precond:"Datos con caracteres especiales y fechas",       pasos:"Llamar serializeBackup(mockData)",                                    esperado:"JSON válido; fechas como strings ISO; sin pérdida de datos",        prio:"Alta"  },
  { id:"BU-04", nombre:"Nombre de archivo con timestamp correcto",     precond:"Fecha mock: 2025-05-26T02:00:01.000Z Santiago", pasos:"Llamar generateBackupFilename('cron', mockDate)",                     esperado:"'cron_backup_2025-05-26_02-00-01.json' con hora local Santiago",    prio:"Media" },
];

const backupInteg = [
  { id:"BI-01", nombre:"GET /api/backup retorna descarga JSON",        precond:"BD con datos; admin autenticado",                pasos:"GET /api/admin/backup con token admin válido",                        esperado:"HTTP 200; Content-Disposition: attachment; JSON parseable",          prio:"Alta"  },
  { id:"BI-02", nombre:"Backup incluye todas las tablas del schema",   precond:"BD con ≥1 registro por tabla",                  pasos:"GET /api/admin/backup y parsear respuesta JSON",                      esperado:"database contiene las 6 claves; cada una es array no vacío",        prio:"Alta"  },
  { id:"BI-03", nombre:"Acceso a backup sin autenticación rechazado",  precond:"Sin header Authorization",                      pasos:"GET /api/admin/backup sin token",                                     esperado:"HTTP 401; sin datos expuestos; sin descarga iniciada",               prio:"Alta"  },
  { id:"BI-04", nombre:"Restauración desde archivo JSON (upsert)",     precond:"Archivo de backup previo disponible",            pasos:"POST /api/admin/backup/restore con body del backup",                  esperado:"HTTP 200; conteos por tabla; relaciones foráneas íntegras",          prio:"Alta"  },
  { id:"BI-05", nombre:"Backup registra acción en log de auditoría",   precond:"Admin autenticado; BD con datos",               pasos:"GET /api/admin/backup; luego GET /api/admin/audit-logs",              esperado:"Entrada BACKUP_DOWNLOADED visible en el log de auditoría",           prio:"Media" },
];

const backupE2E = [
  { id:"BE-01", nombre:"Descarga manual y validación de contenido",    precond:"BD con datos reales; admin autenticado",         pasos:"1.Admin login 2.GET backup 3.Abrir archivo 4.Verificar conteos",     esperado:"Nombre correcto; conteos coinciden con BD; JSON bien formado",      prio:"Alta"  },
  { id:"BE-02", nombre:"Restauración desde backup verifica integridad",precond:"Backup generado; BD de test vacía",             pasos:"1.Truncar BD test 2.POST restore 3.Comparar conteos pre/post",        esperado:"Conteos idénticos al backup; FK íntegras; sin errores Prisma",       prio:"Alta"  },
  { id:"BE-03", nombre:"Ciclo completo backup → restauración → validación",precond:"BD con datos; admin autenticado",          pasos:"1.Generar backup 2.Limpiar BD 3.Restaurar 4.Verificar todos los datos",esperado:"100% de registros restaurados; aplicación funcional post-restore", prio:"Alta"  },
];

const backupPerf = [
  { id:"BP-01", nombre:"Generación con BD de 100.000 registros",       precond:"BD de test con 100.000 registros distribuidos",  pasos:"GET /api/admin/backup; medir tiempo con curl",                        esperado:"Respuesta en < 10s; sin timeout HTTP; sin memory leak",             prio:"Media" },
  { id:"BP-02", nombre:"Backup no degrada otras rutas",                precond:"Servidor bajo carga moderada (20 req/s)",         pasos:"Disparar backup durante carga activa; medir latencia de otras rutas", esperado:"Latencia P95 de rutas normales no aumenta > 20% durante backup",    prio:"Baja"  },
];

// ─── Output real de Jest ──────────────────────────────────────────────────────
const jestOutput = [
  "PS padelhub-backend> npx jest --no-coverage --verbose",
  "",
  "PASS __tests__/photo.test.ts",
  "  ✔ Deberia retornar status 400 en POST si no se envia ningun archivo (21 ms)",
  "  ✔ Deberia retornar 200 al eliminar exitosamente la foto de perfil (3 ms)",
  "",
  "PASS __tests__/suggestions.test.ts",
  "  ✔ Deberia retornar 401 si no se envia token (14 ms)",
  "  ✔ Deberia retornar 404 si el usuario no existe (3 ms)",
  "  ✔ Deberia retornar sugerencias con compatibilidad cuando hay 5+ rivales en +-150 (7 ms)",
  "  ✔ Deberia expandir el rango a +-300 si +-150 da menos de 5 rivales (2 ms)",
  "  ✔ Deberia retornar lo que haya aunque sean <5 rivales tras agotar todos los rangos (3 ms)",
  "  ✔ Las sugerencias deben venir ordenadas por compatibilidad descendente (2 ms)",
  "",
  "PASS __tests__/users.test.ts",
  "  ✔ Deberia retornar 201 al crear un usuario exitosamente (20 ms)",
  "  ✔ Deberia retornar la lista completa de jugadores (2 ms)",
  "  ✔ Deberia retornar el perfil y stats de un usuario existente por su RUT (2 ms)",
  "  ✔ Deberia retornar 200 al eliminar un usuario por su RUT (2 ms)",
  "",
  "PASS __tests__/notifications.test.ts",
  "  ✔ Deberia retornar 401 si no se envia token [GET] (15 ms)",
  "  ✔ Deberia retornar 200 con lista de notificaciones y unread_count correcto (7 ms)",
  "  ✔ Deberia retornar unread_count 0 cuando todas estan leidas (2 ms)",
  "  ✔ Deberia retornar lista vacia si no hay notificaciones (2 ms)",
  "  ✔ Deberia retornar 401 si no se envia token [PATCH] (1 ms)",
  "  ✔ Deberia retornar 200 al marcar todas las notificaciones como leidas (4 ms)",
  "",
  "PASS __tests__/ratings.test.ts",
  "  ✔ Deberia retornar 401 si no se envia token (15 ms)",
  "  ✔ Deberia retornar 400 si el partido no ha finalizado (3 ms)",
  "  ✔ Deberia retornar 403 si han pasado mas de 24h desde que termino el partido (1 ms)",
  "  ✔ Deberia retornar 400 si se intenta valorar a uno mismo (1 ms)",
  "  ✔ Deberia retornar 400 si un valor de escala esta fuera de rango (1-5) (1 ms)",
  "  ✔ Deberia retornar 200 y crear las valoraciones correctamente (4 ms)",
  "  ✔ Deberia retornar 400 si el RUT no es un numero valido (1 ms)",
  "  ✔ Deberia retornar 404 si el usuario no existe",
  "  ✔ Deberia retornar 200 con promedios correctamente redondeados (2 ms)",
  "  ✔ Deberia retornar ceros/null si el usuario no tiene valoraciones (1 ms)",
  "",
  "PASS __tests__/matches.test.ts",
  "  ✔ Deberia agendar un partido correctamente y retornar status 201 (14 ms)",
  "  ✔ Deberia retornar 400 si faltan campos obligatorios al crear un partido (2 ms)",
  "  ✔ Deberia retornar 403 si quien cancela no es el organizador (2 ms)",
  "  ✔ Deberia retornar 400 si el partido ya esta cancelado (1 ms)",
  "  ✔ Deberia retornar 200 al cancelar correctamente (3 ms)",
  "  ✔ Deberia retornar 403 si quien registra no es el organizador (1 ms)",
  "  ✔ Deberia retornar 400 si el partido no esta confirmado o en progreso (1 ms)",
  "  ✔ Deberia retornar 200 y aplicar cambios de MMR correctamente (2 ms)",
  "",
  "PASS __tests__/admin.test.ts",
  "  ✔ Deberia retornar 200 con token JWT al autenticar correctamente al administrador (14 ms)",
  "  ✔ Deberia retornar 401 si la contrasena es incorrecta (1 ms)",
  "  ✔ Deberia retornar 401 si el usuario existe pero no tiene rol admin (1 ms)",
  "  ✔ Deberia retornar 400 si no se envia motivo (3 ms)",
  "  ✔ Deberia retornar 400 si el MMR esta fuera del rango 0-9999 (1 ms)",
  "  ✔ Deberia retornar 404 si el usuario no existe (1 ms)",
  "  ✔ Deberia retornar 200 y actualizar el MMR correctamente (2 ms)",
  "  ✔ Deberia retornar 200 con todas las metricas correctamente (2 ms)",
  "  ✔ Deberia retornar 200 con logs paginados y metadatos correctos (4 ms)",
  "  ✔ Deberia retornar lista vacia si no hay registros de auditoria (2 ms)",
  "",
  "PASS __tests__/auth.test.ts",
  "  ✔ Deberia retornar status 200 si el RUT existe y la contrasena es correcta (236 ms)",
  "  ✔ Deberia retornar 404 si el RUT no existe (1 ms)",
  "  ✔ Deberia retornar status 401 si la contrasena es invalida (217 ms)",
  "  ✔ Deberia retornar 401 si el refresh token no existe en BD (2 ms)",
  "  ✔ Deberia retornar 401 si el refresh token esta expirado (2 ms)",
  "  ✔ Deberia retornar 200 con nuevo token y refresh token rotado (3 ms)",
  "  ✔ Deberia retornar 200 aunque el email no exista (seguridad: no revela existencia) (2 ms)",
  "  ✔ Deberia retornar 200 y generar token cuando el email existe (1 ms)",
  "",
  "Test Suites: 8 passed, 8 total",
  "Tests:       54 passed, 54 total",
  "Snapshots:   0 total",
  "Time:        2.453 s",
  "Ran all test suites.",
];

// ─── Header y Footer ──────────────────────────────────────────────────────────
const pageHeader = new Header({
  children: [
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.azulOscuro, space: 6 } },
      children: [
        new TextRun({ text: "PadelHub — Plan de Pruebas del Sistema", bold: true, size: 18, font: "Calibri", color: C.azulOscuro }),
        new TextRun({ text: "\t\t\t\tCONFIDENCIAL | USO INTERNO", size: 16, font: "Calibri", italics: true, color: "666666" }),
      ],
    }),
  ],
});

const pageFooter = new Footer({
  children: [
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: C.azulOscuro, space: 6 } },
      children: [
        new TextRun({ text: "QA-TEST-PLAN-001 v1.0 — PadelHub", size: 16, font: "Calibri", color: "666666" }),
        new TextRun({ text: "\t\t\t\t\t\t", size: 16 }),
        new TextRun({ text: "Página ", size: 16, font: "Calibri", color: "666666" }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Calibri", color: "666666" }),
      ],
    }),
  ],
});

// ─── MÓDULO helper ───────────────────────────────────────────────────────────
function moduleSection(num, icon, title, subtitle, unit, integ, e2e, perf) {
  return [
    empty(),
    sectionTitle(num, `Módulo: ${title}`),
    empty(),
    moduleBanner(icon, title, subtitle),
    empty(),
    ...subTitle(`${num}.1`, "Pruebas Unitarias", "Validan la lógica aislada de funciones y reglas de negocio mediante mocks de Prisma y servicios externos."),
    buildTestTable(unit),
    empty(),
    ...subTitle(`${num}.2`, "Pruebas de Integración", "Verifican el comportamiento de los endpoints con BD de test real y middleware de seguridad activo."),
    buildTestTable(integ),
    empty(),
    ...subTitle(`${num}.3`, "Pruebas End-to-End", "Simulan flujos completos de usuario desde el navegador contra el entorno de staging."),
    buildTestTable(e2e),
    empty(),
    ...subTitle(`${num}.4`, "Pruebas de Rendimiento", "Miden latencia, throughput y estabilidad bajo carga concurrente con Artillery o k6."),
    buildTestTable(perf),
    empty(),
  ];
}

// ─── RESUMEN EJECUTIVO ────────────────────────────────────────────────────────
const resumenData = [
  ["Módulo / Área",                       "Unit.", "Integr.", "E2E", "Rend.", "Total"],
  ["Autenticación (JWT / Tokens)",          "8",    "5",      "3",   "2",    "18"],
  ["Gestión de Usuarios y Perfiles",        "6",    "4",      "2",   "1",    "13"],
  ["Matchmaking y Sugerencias",             "6",    "3",      "2",   "1",    "12"],
  ["Gestión de Partidos (Matches)",         "8",    "4",      "2",   "1",    "15"],
  ["Valoraciones y Reputación",            "10",    "3",      "2",   "1",    "16"],
  ["Notificaciones In-App",                 "6",    "3",      "2",   "1",    "12"],
  ["Panel de Administración",              "11",    "4",      "2",   "1",    "18"],
  ["Respaldo de Base de Datos",             "4",    "5",      "3",   "2",    "14"],
  ["TOTAL",                                "59",   "31",     "18",   "10",  "118"],
];

function buildResumenTable(rows) {
  const hdr = new TableRow({
    tableHeader: true,
    children: rows[0].map((h, i) => cHdr(h)),
  });
  const data = rows.slice(1).map((r, i) => {
    const isTotal = r[0] === "TOTAL";
    const shade = isTotal ? C.azulOscuro : (i % 2 === 0 ? C.azulMuyClaro : C.blanco);
    const txtColor = isTotal ? C.blanco : C.negro;
    return new TableRow({
      children: r.map((v, j) => new TableCell({
        shading: { type: ShadingType.SOLID, color: shade },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        borders: { top: B, bottom: B, left: B, right: B },
        children: [new Paragraph({
          alignment: j > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text: v, bold: isTotal, color: txtColor, size: 18, font: "Calibri" })],
        })],
      })),
    });
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [hdr, ...data] });
}

// ─── PORTADA ──────────────────────────────────────────────────────────────────
const portada = [
  empty(), empty(), empty(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text: "PADELHUB", bold: true, size: 72, color: C.azulOscuro, font: "Calibri" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 600 },
    children: [new TextRun({ text: "Plataforma de Gestión de Pádel Competitivo", italics: true, size: 28, color: C.azulMedio, font: "Calibri" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 100 },
    children: [new TextRun({ text: "PLAN DE PRUEBAS DEL SISTEMA", bold: true, size: 40, color: C.azulOscuro, font: "Calibri" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 600 },
    children: [new TextRun({ text: "QA-TEST-PLAN-001", italics: true, size: 24, color: "666666", font: "Calibri" })],
  }),
  new Table({
    width: { size: 60, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: cMeta("Proyecto",          "PadelHub") }),
      new TableRow({ children: cMeta("Tipo de documento", "Plan de Pruebas") }),
      new TableRow({ children: cMeta("Versión",           "1.0.0") }),
      new TableRow({ children: cMeta("Fecha de emisión",  "Junio 2026") }),
      new TableRow({ children: cMeta("Módulos cubiertos", "Autenticación, Partidos, Usuarios, Notificaciones, Admin, Backup") }),
      new TableRow({ children: cMeta("Tipos de prueba",   "Unitarias, Integración, E2E, Rendimiento") }),
      new TableRow({ children: cMeta("Estado",            "Vigente") }),
    ],
  }),
  empty(), empty(), empty(), empty(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Proyecto Académico — Ingeniería de Software | TPY1101", italics: true, size: 18, color: "888888", font: "Calibri" })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ─── SECCIÓN 1: INTRODUCCIÓN ──────────────────────────────────────────────────
const intro = [
  sectionTitle("1", "Introducción"),
  empty(),
  new Paragraph({ spacing: { before: 160, after: 80 }, children: [run("1.1  Propósito", { bold: true, color: C.azulOscuro, size: 22 })] }),
  new Paragraph({ spacing: { before: 0, after: 200 }, children: [run("Este documento define el plan de pruebas para el sistema PadelHub, estableciendo los casos de prueba, criterios de éxito y estrategia de validación para los ocho módulos que conforman la plataforma. El objetivo es garantizar la correctitud funcional, seguridad, integridad de datos y rendimiento del sistema antes de su puesta en producción.", { size: 20 })] }),
  new Paragraph({ spacing: { before: 160, after: 80 }, children: [run("1.2  Alcance", { bold: true, color: C.azulOscuro, size: 22 })] }),
  ...[
    "Módulo de Autenticación: generación y verificación de JWT, gestión de refresh tokens, recuperación de contraseña.",
    "Módulo de Usuarios: registro, perfil, foto de perfil (Cloudinary), historial MMR.",
    "Módulo de Matchmaking: sugerencias por compatibilidad MMR con expansión de rango.",
    "Módulo de Partidos: creación, unión, invitación, cancelación, registro de resultados con ELO K=32.",
    "Módulo de Valoraciones: sistema de rating post-partido (fair play, puntualidad, nivel percibido).",
    "Módulo de Notificaciones: centro de notificaciones in-app con badge en NavBar.",
    "Módulo de Administración: login admin, gestión de usuarios, métricas KPI, auditoría.",
    "Módulo de Respaldo: endpoint HTTP manual y restauración desde JSON.",
  ].map(t => new Paragraph({ spacing: { before: 40, after: 40 }, bullet: { level: 0 }, children: [run(t, { size: 20 })] })),
  empty(),
  new Paragraph({ spacing: { before: 160, after: 80 }, children: [run("1.3  Stack tecnológico de pruebas", { bold: true, color: C.azulOscuro, size: 22 })] }),
  table4col([
    ["Tipo de prueba",  "Herramienta recomendada", "Descripción"],
    ["Unitarias",       "Jest + ts-jest",           "Pruebas de funciones y lógica de negocio aisladas con mocks de Prisma"],
    ["Integración",     "Jest + Supertest",          "Pruebas de API Routes con BD de test real (PostgreSQL local o Supabase staging)"],
    ["End-to-End",      "Playwright o Cypress",      "Flujos completos de usuario en navegador real contra entorno de staging"],
    ["Rendimiento",     "Artillery o k6",            "Simulación de carga, medición de latencia P95/P99 y detección de cuellos de botella"],
  ]),
  empty(),
  new Paragraph({ spacing: { before: 160, after: 80 }, children: [run("1.4  Criterios de aceptación global", { bold: true, color: C.azulOscuro, size: 22 })] }),
  ...[
    "Cobertura de código ≥ 80% en pruebas unitarias para los ocho módulos.",
    "Tasa de éxito ≥ 95% en casos de integración ejecutados sobre BD de test.",
    "Cero defectos de severidad Alta abiertos al momento del release.",
    "Todas las pruebas E2E de flujos críticos ejecutadas sin errores en staging.",
    "Tiempos de respuesta P95 dentro de los umbrales definidos por caso de rendimiento.",
  ].map(t => new Paragraph({ spacing: { before: 40, after: 40 }, bullet: { level: 0 }, children: [run(t, { size: 20 })] })),
  empty(),
];

// ─── SECCIÓN 2: RESUMEN EJECUTIVO ────────────────────────────────────────────
const resumen = [
  sectionTitle("2", "Resumen Ejecutivo de Cobertura"),
  empty(),
  new Paragraph({ spacing: { before: 0, after: 160 }, children: [run("La siguiente tabla consolida la cantidad de casos de prueba definidos por módulo y tipo, con un total de 118 casos diseñados para cubrir escenarios funcionales, de borde y de fallo.", { size: 20 })] }),
  buildResumenTable(resumenData),
  empty(),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [
      new TableCell({
        shading: { type: ShadingType.SOLID, color: C.azulClaro },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        borders: { top: B, bottom: B, left: B, right: B },
        children: [new Paragraph({ children: [
          new TextRun({ text: "Leyenda de Prioridades   ", bold: true, size: 18, color: C.azulOscuro, font: "Calibri" }),
          new TextRun({ text: "▪ Alta", bold: true, color: C.rojo,    size: 18, font: "Calibri" }),
          new TextRun({ text: " — Funcionalidad crítica; bloquea el release si falla.   ", size: 18, font: "Calibri" }),
          new TextRun({ text: "▪ Media", bold: true, color: C.naranja, size: 18, font: "Calibri" }),
          new TextRun({ text: " — Importante; debe resolverse antes del release.   ", size: 18, font: "Calibri" }),
          new TextRun({ text: "▪ Baja", bold: true, color: C.verde,   size: 18, font: "Calibri" }),
          new TextRun({ text: " — Mejora; puede postergarse.", size: 18, font: "Calibri" }),
        ]})] ,
      }),
    ]})],
  }),
  empty(),
];

// ─── SECCIÓN 6: AMBIENTES ─────────────────────────────────────────────────────
const ambientes = [
  sectionTitle("11", "Ambientes de Prueba y Configuración"),
  empty(),
  table4col([
    ["Ambiente",    "Infraestructura",                      "Base de datos",                   "Uso"],
    ["Local (Dev)", "Docker Compose + Next.js dev server",  "postgres:15 contenedor local",     "Unitarias e integración durante desarrollo"],
    ["CI/CD",       "GitHub Actions / Runner",              "postgres:15 servicio efímero",     "Ejecución automática en cada push"],
    ["Staging",     "Vercel Preview + Supabase staging",    "Supabase instancia de staging",    "E2E y pruebas de rendimiento pre-release"],
    ["Producción",  "Vercel + Supabase PostgreSQL",         "PostgreSQL Supabase (prod)",       "Solo smoke tests post-deploy"],
  ]),
  empty(),
  new Paragraph({ spacing: { before: 160, after: 80 }, children: [run("11.1  Variables de entorno requeridas para pruebas", { bold: true, color: C.azulOscuro, size: 22 })] }),
  ...[
    "DATABASE_URL: URL de conexión a la BD de test (nunca producción).",
    "JWT_SECRET: clave de firma para tokens en ambiente de test.",
    "NEXT_RUNTIME: 'nodejs' para habilitar funcionalidades de cron en pruebas de integración.",
    "RESEND_API_KEY: clave de Resend (se puede usar sandbox para pruebas).",
    "CLOUDINARY_*: credenciales de Cloudinary (entorno de test separado del de producción).",
  ].map(t => new Paragraph({ spacing: { before: 40, after: 40 }, bullet: { level: 0 }, children: [run(t, { size: 20 })] })),
  empty(),
  new Paragraph({ spacing: { before: 160, after: 80 }, children: [run("11.2  Estrategia de aislamiento de datos", { bold: true, color: C.azulOscuro, size: 22 })] }),
  ...[
    "Cada suite de tests utiliza mocks de Prisma para no contaminar la BD entre casos.",
    "Seeds de datos estáticos definidos inline en cada archivo de test para reproducibilidad.",
    "La BD de producción nunca debe ser usada en ningún ambiente de prueba.",
  ].map(t => new Paragraph({ spacing: { before: 40, after: 40 }, bullet: { level: 0 }, children: [run(t, { size: 20 })] })),
  empty(),
];

// ─── SECCIÓN 7: CRITERIOS DE SALIDA ──────────────────────────────────────────
const criterios = [
  sectionTitle("12", "Criterios de Salida y Gestión de Defectos"),
  empty(),
  table4col([
    ["Severidad",        "Criterio",              "Descripción",                                                          "Tiempo de resolución"],
    ["S1 — Crítica",     "Bloquea release",        "Sistema caído, pérdida de datos, vulnerabilidad de seguridad explotable", "Inmediato (< 4 horas)"],
    ["S2 — Alta",        "Resuelto pre-release",   "Funcionalidad principal no opera; sin workaround disponible",            "< 1 día hábil"],
    ["S3 — Media",       "Planificado al release", "Funcionalidad degradada; workaround disponible",                         "< 3 días hábiles"],
    ["S4 — Baja",        "Backlog",                "Cosmético, mejora de UX o caso de borde poco probable",                  "Siguiente sprint"],
  ]),
  empty(),
];

// ─── SECCIÓN 8: CONTROL DE CAMBIOS ───────────────────────────────────────────
const cambios = [
  sectionTitle("13", "Control de Cambios"),
  empty(),
  table4col([
    ["Versión", "Fecha",      "Descripción",                                                                   "Autor"],
    ["1.0.0",   "01-06-2026", "Emisión inicial: 118 casos de prueba para 8 módulos",                          "Equipo PadelHub"],
    ["1.0.1",   "19-06-2026", "Actualización: 54 casos unitarios ejecutados y validados; anexo con evidencia", "Equipo PadelHub"],
  ]),
  empty(),
];

// ─── SECCIÓN ANEXO ────────────────────────────────────────────────────────────
const anexo = [
  sectionTitle("14", "Anexo — Evidencia de Pruebas Unitarias Ejecutadas"),
  empty(),
  new Paragraph({ spacing: { before: 0, after: 160 }, children: [run("A continuación se presenta la salida completa del runner Jest con los 54 casos de prueba unitarias ejecutados, mostrando cada test en estado PASS. Comando ejecutado: npx jest --no-coverage --verbose", { size: 20, italic: true })] }),
  empty(),
  new Paragraph({ spacing: { before: 0, after: 80 }, children: [run("14.1  Resultado de Ejecución de Pruebas Unitarias — 54/54 PASS", { bold: true, color: C.azulOscuro, size: 22 })] }),
  empty(),
  evidenceBlock(jestOutput),
  empty(),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [
      new TableCell({
        shading: { type: ShadingType.SOLID, color: "E2EFDA" },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "70AD47" }, bottom: { style: BorderStyle.SINGLE, size: 6, color: "70AD47" }, left: { style: BorderStyle.SINGLE, size: 6, color: "70AD47" }, right: { style: BorderStyle.SINGLE, size: 6, color: "70AD47" } },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "RESULTADO FINAL: ", bold: true, color: "375623", size: 24, font: "Calibri" }),
            new TextRun({ text: "8 Test Suites PASS | 54 Tests PASS | 0 Fallos | Tiempo: 2.453s", bold: true, color: "375623", size: 22, font: "Calibri" }),
          ],
        })],
      }),
    ]})],
  }),
  empty(),
];

// ─── DOCUMENTO FINAL ──────────────────────────────────────────────────────────
const doc = new Document({
  sections: [
    // Portada (sin header/footer)
    {
      properties: { page: { margin: { top: 720, bottom: 720, left: 1000, right: 1000 } } },
      children: portada,
    },
    // Contenido (con header/footer)
    {
      properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
      headers: { default: pageHeader },
      footers: { default: pageFooter },
      children: [
        ...intro,
        ...resumen,
        ...moduleSection("3",  "🔐", "Autenticación (JWT / Refresh Tokens)", "Seguridad de acceso, gestión de tokens y ciclo de vida de sesiones", authUnit, authInteg, authE2E, authPerf),
        ...moduleSection("4",  "👤", "Gestión de Usuarios y Perfiles",        "Registro, actualización de perfil, foto de perfil y MMR-historial",  usersUnit, usersInteg, usersE2E, usersPerf),
        ...moduleSection("5",  "🎯", "Matchmaking y Sugerencias",             "Compatibilidad MMR, búsqueda de rivales y expansión de rango",        matchmakingUnit, matchmakingInteg, matchmakingE2E, matchmakingPerf),
        ...moduleSection("6",  "🎾", "Gestión de Partidos (Matches)",         "Creación, validación, resultados y actualización automática de MMR",  matchesUnit, matchesInteg, matchesE2E, matchesPerf),
        ...moduleSection("7",  "⭐", "Valoraciones y Reputación",             "Sistema de rating post-partido y cálculo de promedios de reputación", ratingsUnit, ratingsInteg, ratingsE2E, ratingsPerf),
        ...moduleSection("8",  "🔔", "Notificaciones In-App",                 "Centro de notificaciones con badge en NavBar y mark-all-read",        notifsUnit, notifsInteg, notifsE2E, notifsPerf),
        ...moduleSection("9",  "🛡️", "Panel de Administración",              "Login admin, gestión de usuarios, métricas KPI y log de auditoría",   adminUnit, adminInteg, adminE2E, adminPerf),
        ...moduleSection("10", "🗄️", "Respaldo de Base de Datos",            "Endpoint HTTP manual, restauración y validación del ciclo de backup",  backupUnit, backupInteg, backupE2E, backupPerf),
        ...ambientes,
        ...criterios,
        ...cambios,
        ...anexo,
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buffer => {
  const out = path.join(__dirname, "..", "PlanDePruebas_PadelHub.docx");
  fs.writeFileSync(out, buffer);
  console.log(`✅ Documento generado: ${out}`);
});
