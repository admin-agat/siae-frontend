// 10/11/2026 (pedido de Exportaciones y Logística): las 4 modalidades de carga, iguales en el pedido semanal,
// la distribución en barcos, la compra de fruta (bloques) y el cierre de embarque (bookings).
// Los códigos son los del pedido (CAJA_ = PALETIZADO); el backend los valida con CustomerOrderLine::TIPOS_CARGA.
export const MODALIDADES_CARGA = [
  { valor: 'GRANEL_BAJO_CUBIERTA', etiqueta: 'GRANEL BAJO CUBIERTA' },
  { valor: 'CAJA_BAJO_CUBIERTA', etiqueta: 'PALETIZADO BAJO CUBIERTA' },
  { valor: 'GRANEL_CONTENEDOR', etiqueta: 'CONTENEDOR AL GRANEL' },
  { valor: 'CAJA_CONTENEDOR', etiqueta: 'CONTENEDOR PALETIZADO' },
];

// { GRANEL_BAJO_CUBIERTA: 'GRANEL BAJO CUBIERTA', ... }
export const ETIQUETA_MODALIDAD = Object.fromEntries(MODALIDADES_CARGA.map((m) => [m.valor, m.etiqueta]));

export const MODALIDAD_POR_DEFECTO = 'GRANEL_BAJO_CUBIERTA';

export const esContenedor = (modalidad) => String(modalidad || '').endsWith('_CONTENEDOR');
