const XLSX = require('xlsx');
const path = require('path');

const stories = [
  {
    id: 'hu-013',
    enunciado: 'Como un Jugador, Necesito ver el leaderboard de mi zona, con la finalidad de compararme con los mejores jugadores de mi región.',
    alias: 'Leaderboard regional',
    estado: 'Completada',
    dimension: 5,
    iteracion: 'Sprint 3',
    prioridad: 'Alta',
    comentarios: 'Top de jugadores ordenados por MMR descendente. Filtrable por zona. Paginado (top 50). Endpoint GET /api/ranking.',
  },
  {
    id: 'hu-014',
    enunciado: 'Como un Jugador, Necesito ver el historial de variación de mi MMR, con la finalidad de analizar mi evolución y desempeño en el tiempo.',
    alias: 'Historial de MMR',
    estado: 'Completada',
    dimension: 8,
    iteracion: 'Sprint 3',
    prioridad: 'Alta',
    comentarios: 'Gráfico de barras semanal (13 semanas). Listado de partidos con delta de MMR. Endpoint GET /api/users/[rut]/mmr-history.',
  },
  {
    id: 'hu-015',
    enunciado: 'Como un Jugador, Necesito filtrar rivales sugeridos por zona geográfica, con la finalidad de encontrar oponentes cercanos a mi ubicación.',
    alias: 'Filtrar rivales por zona',
    estado: 'Completada',
    dimension: 5,
    iteracion: 'Sprint 3',
    prioridad: 'Media',
    comentarios: 'Zona del perfil usada por defecto. Combinable con filtro de MMR. Solo jugadores activos. Endpoint GET /api/users/search actualizado.',
  },
  {
    id: 'hu-016',
    enunciado: 'Como un Jugador, Necesito desafiar directamente a un rival sugerido, con la finalidad de concretar un partido contra alguien específico.',
    alias: 'Desafiar a un rival',
    estado: 'Completada',
    dimension: 8,
    iteracion: 'Sprint 3',
    prioridad: 'Alta',
    comentarios: 'Crea partido borrador automáticamente. Notifica al rival por email (Resend). Flujo: POST /api/matches → POST /api/matches/[id]/invite.',
  },
  {
    id: 'hu-017',
    enunciado: 'Como un Jugador Invitado, Necesito recibir una notificación cuando me inviten a un partido, con la finalidad de poder responder a tiempo.',
    alias: 'Notificación de invitación',
    estado: 'Completada',
    dimension: 5,
    iteracion: 'Sprint 3',
    prioridad: 'Alta',
    comentarios: 'Notificación por email vía Resend al ser invitado. Best-effort (no bloquea el flujo). Incluye link al partido en el email.',
  },
  {
    id: 'hu-018',
    enunciado: 'Como un Jugador, Necesito recibir recordatorios del partido, con la finalidad de no olvidar los compromisos agendados.',
    alias: 'Recordatorios de partido',
    estado: 'Completada',
    dimension: 8,
    iteracion: 'Sprint 3',
    prioridad: 'Media',
    comentarios: 'Email automático 24h y 1h antes del partido. Opt-out desde perfil (reminder_enabled). Cron job horario vía Vercel. Tabla match_reminders previene duplicados.',
  },
  {
    id: 'hu-019',
    enunciado: 'Como un Administrador, Necesito autenticarme en un panel de administración separado, con la finalidad de gestionar la plataforma de forma segura.',
    alias: 'Auth panel administrador',
    estado: 'Completada',
    dimension: 8,
    iteracion: 'Sprint 3',
    prioridad: 'Alta',
    comentarios: 'JWT 4h exclusivo para rol admin (sin refresh token). Registro de auditoría en admin_audit_logs. Panel web independiente de la app de jugadores.',
  },
  {
    id: 'hu-020',
    enunciado: 'Como un Administrador, Necesito ver y gestionar todos los usuarios registrados, con la finalidad de mantener la integridad de la comunidad.',
    alias: 'Gestión de usuarios (Admin)',
    estado: 'Completada',
    dimension: 13,
    iteracion: 'Sprint 3',
    prioridad: 'Alta',
    comentarios: 'Listado paginado con filtros por zona, nivel y estado. Ver perfil completo. Suspender/reactivar cuentas. Editar nivel y zona manualmente.',
  },
  {
    id: 'hu-021',
    enunciado: 'Como un Administrador, Necesito ver y gestionar todos los partidos registrados, con la finalidad de detectar resultados incorrectos o comportamientos indebidos.',
    alias: 'Gestión de partidos (Admin)',
    estado: 'Completada',
    dimension: 13,
    iteracion: 'Sprint 3',
    prioridad: 'Alta',
    comentarios: 'Listado con filtros por estado, fecha y zona. Detalle completo con jugadores y resultado. Anular resultado revierte MMR con upsert delta en transacción atómica.',
  },
  {
    id: 'hu-022',
    enunciado: 'Como un Administrador, Necesito respaldar e importar la base de datos desde el panel, con la finalidad de proteger los datos de la plataforma.',
    alias: 'Respaldo e importación de BD',
    estado: 'Completada',
    dimension: 8,
    iteracion: 'Sprint 3',
    prioridad: 'Media',
    comentarios: 'GET /api/admin/backup descarga JSON protegido con auth admin. POST /api/admin/backup/restore upsert no destructivo en orden FK. Modal de confirmación con resumen. Auditoría registrada.',
  },
];

// Crear workbook
const wb = XLSX.utils.book_new();

// Preparar datos
const headers = [
  'Identificador (ID)',
  'Enunciado de la Historia',
  'Alias',
  'Estado',
  'Dimensión',
  'Iteración (Sprint)',
  'Prioridad',
  'Comentarios',
];

const rows = stories.map((s) => [
  s.id,
  s.enunciado,
  s.alias,
  s.estado,
  s.dimension,
  s.iteracion,
  s.prioridad,
  s.comentarios,
]);

const wsData = [headers, ...rows];
const ws = XLSX.utils.aoa_to_sheet(wsData);

// Anchos de columna
ws['!cols'] = [
  { wch: 14 },  // ID
  { wch: 80 },  // Enunciado
  { wch: 28 },  // Alias
  { wch: 12 },  // Estado
  { wch: 11 },  // Dimensión
  { wch: 16 },  // Iteración
  { wch: 10 },  // Prioridad
  { wch: 80 },  // Comentarios
];

// Estilo de cabecera (fondo oscuro, texto blanco, negrita)
const headerStyle = {
  font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  fill:      { fgColor: { rgb: '1F4E79' }, patternType: 'solid' },
  alignment: { vertical: 'center', wrapText: true },
  border: {
    top:    { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left:   { style: 'thin', color: { rgb: '000000' } },
    right:  { style: 'thin', color: { rgb: '000000' } },
  },
};

// Colores filas alternas
const rowEvenStyle = { fill: { fgColor: { rgb: 'D6E4F0' }, patternType: 'solid' }, alignment: { wrapText: true, vertical: 'center' } };
const rowOddStyle  = { fill: { fgColor: { rgb: 'FFFFFF' }, patternType: 'solid' }, alignment: { wrapText: true, vertical: 'center' } };

// Color especial para "Pendiente"
const pendingStyle = { font: { bold: true, color: { rgb: 'C00000' } }, alignment: { wrapText: true, vertical: 'center' } };
const doneStyle    = { font: { bold: true, color: { rgb: '375623' } }, alignment: { wrapText: true, vertical: 'center' } };

const colLetters = ['A','B','C','D','E','F','G','H'];

// Aplicar estilos
wsData.forEach((row, ri) => {
  row.forEach((_, ci) => {
    const cellRef = `${colLetters[ci]}${ri + 1}`;
    if (!ws[cellRef]) return;
    if (ri === 0) {
      ws[cellRef].s = headerStyle;
    } else {
      const base = ri % 2 === 0 ? rowOddStyle : rowEvenStyle;
      ws[cellRef].s = { ...base };
      // Colorear columna Estado
      if (ci === 3) {
        ws[cellRef].s = rows[ri - 1][3] === 'Completada'
          ? { ...base, ...doneStyle }
          : { ...base, ...pendingStyle };
      }
    }
  });
});

// Congelar primera fila
ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', sqref: 'A2' };

XLSX.utils.book_append_sheet(wb, ws, 'Sprint 3');

const outPath = path.join(__dirname, '..', 'Sprint3_HistoriasDeUsuario.xlsx');
XLSX.writeFile(wb, outPath, { bookType: 'xlsx', type: 'binary', cellStyles: true });
console.log('Excel generado:', outPath);
