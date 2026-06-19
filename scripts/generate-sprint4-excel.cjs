const XLSX = require('xlsx');
const path = require('path');

const stories = [
  {
    id: 'hu-023',
    enunciado: 'Como un Jugador, Necesito recibir sugerencias de rivales con nivel similar al mío, con la finalidad de encontrar oponentes equilibrados rápidamente.',
    alias: 'Sugerencias de rivales',
    estado: 'Completada',
    dimension: 8,
    iteracion: 'Sprint 4',
    prioridad: 'Alta',
    comentarios: 'Rango MMR ±150 (expande a ±300 y ±500 si hay menos de 5 resultados). Compatibilidad % ordenada descendente. Sección "Sugeridos para ti" al inicio del matchmaking. Endpoint GET /api/users/suggestions.',
  },
  {
    id: 'hu-024',
    enunciado: 'Como un Jugador, Necesito valorar a mis compañeros y rivales tras un partido, con la finalidad de construir una reputación comunitaria basada en el comportamiento real.',
    alias: 'Valoración post-partido',
    estado: 'Completada',
    dimension: 8,
    iteracion: 'Sprint 4',
    prioridad: 'Alta',
    comentarios: 'Ventana de 24h tras finalizar partido. Dimensiones: fair play, puntualidad, nivel percibido (1-5 estrellas). Anónima (rater_id no expuesto). Una sola valoración por jugador por partido (unique constraint). Todos los co-jugadores en una pantalla. POST /api/matches/[id]/rate.',
  },
  {
    id: 'hu-025',
    enunciado: 'Como un Jugador, Necesito ver mi reputación acumulada en mi perfil, con la finalidad de conocer la percepción de la comunidad sobre mi comportamiento en la cancha.',
    alias: 'Reputación en perfil',
    estado: 'Completada',
    dimension: 5,
    iteracion: 'Sprint 4',
    prioridad: 'Media',
    comentarios: 'Promedios de fair play, puntualidad y nivel percibido. Total de valoraciones recibidas. Visible solo si total > 0. Se actualiza automáticamente. Tarjeta "Reputación" en perfil del jugador. GET /api/users/[rut]/ratings.',
  },
  {
    id: 'hu-026',
    enunciado: 'Como un Jugador, Necesito ver un centro de notificaciones dentro de la app, con la finalidad de estar informado de eventos relevantes sin depender del correo electrónico.',
    alias: 'Centro de notificaciones',
    estado: 'Completada',
    dimension: 13,
    iteracion: 'Sprint 4',
    prioridad: 'Media',
    comentarios: '4 eventos disparan notificación: invitación, cancelación de partido, resultado registrado y valoración recibida. Historial de 30 días, ordenado por fecha. No leídas marcadas visualmente. "Leer todo" masivo. Badge con conteo en campana de la barra de navegación. GET /api/notifications · PATCH /api/notifications.',
  },
  {
    id: 'hu-027',
    enunciado: 'Como un Administrador, Necesito ajustar manualmente el MMR de un jugador, con la finalidad de corregir errores del sistema o situaciones excepcionales reportadas.',
    alias: 'Ajuste MMR (Admin)',
    estado: 'Completada',
    dimension: 8,
    iteracion: 'Sprint 4',
    prioridad: 'Media',
    comentarios: 'Valor nuevo 0-9999. Motivo obligatorio. Registra entrada en mmr_history (sin match_id). Auditoría con acción MMR_ADJUST y detalle mmr_antes→mmr_después. Email al jugador con tabla de variación y motivo. PATCH /api/admin/users/[id]/mmr.',
  },
  {
    id: 'hu-028',
    enunciado: 'Como un Administrador, Necesito ver métricas generales del uso de la plataforma, con la finalidad de tomar decisiones informadas sobre el crecimiento y comportamiento de los usuarios.',
    alias: 'Métricas de plataforma',
    estado: 'Completada',
    dimension: 8,
    iteracion: 'Sprint 4',
    prioridad: 'Media',
    comentarios: 'KPIs: usuarios activos, % que han jugado, partidos esta semana, partidos en curso, MMR promedio. Top 5 zonas por jugadores activos (barras CSS). Distribución de niveles (barras CSS). Datos en tiempo real desde PostgreSQL. Botón actualizar manual. GET /api/admin/metrics.',
  },
  {
    id: 'hu-029',
    enunciado: 'Como un Administrador, Necesito ver el log de auditoría de todas las acciones administrativas, con la finalidad de mantener trazabilidad y detectar usos indebidos del panel.',
    alias: 'Log de auditoría',
    estado: 'Completada',
    dimension: 13,
    iteracion: 'Sprint 4',
    prioridad: 'Alta',
    comentarios: 'Registra: login, suspensión, ajuste MMR, anulación de resultado, backup/restore. Columnas: fecha/hora, admin, acción (badge coloreado), detalle, IP. Filtros: acción, administrador, rango de fechas. Paginado 30/página. Exporta CSV con BOM UTF-8 (compatible Excel), respetando filtros activos. GET /api/admin/audit-logs · GET /api/admin/audit-logs/export.',
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

// Estilos
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

const rowEvenStyle = { fill: { fgColor: { rgb: 'D6E4F0' }, patternType: 'solid' }, alignment: { wrapText: true, vertical: 'center' } };
const rowOddStyle  = { fill: { fgColor: { rgb: 'FFFFFF' }, patternType: 'solid' }, alignment: { wrapText: true, vertical: 'center' } };
const pendingStyle = { font: { bold: true, color: { rgb: 'C00000' } }, alignment: { wrapText: true, vertical: 'center' } };
const doneStyle    = { font: { bold: true, color: { rgb: '375623' } }, alignment: { wrapText: true, vertical: 'center' } };

const colLetters = ['A','B','C','D','E','F','G','H'];

wsData.forEach((row, ri) => {
  row.forEach((_, ci) => {
    const cellRef = `${colLetters[ci]}${ri + 1}`;
    if (!ws[cellRef]) return;
    if (ri === 0) {
      ws[cellRef].s = headerStyle;
    } else {
      const base = ri % 2 === 0 ? rowOddStyle : rowEvenStyle;
      ws[cellRef].s = { ...base };
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

XLSX.utils.book_append_sheet(wb, ws, 'Sprint 4');

const outPath = path.join(__dirname, '..', 'Sprint4_HistoriasDeUsuario.xlsx');
XLSX.writeFile(wb, outPath, { bookType: 'xlsx', type: 'binary', cellStyles: true });
console.log('Excel generado:', outPath);
