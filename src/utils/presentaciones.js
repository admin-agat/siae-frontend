// Presentaciones de una marca (02/11/2026). El precio de venta del contrato depende de marca + presentación.
// PACKED = la misma marca con cinta/banda (antes PALMS CON BANDA era una marca aparte).
export const PRESENTACIONES = ['CONVENCIONAL', 'PACKED'];
// 18/11/2026 (Peter): en el Pedido semanal se lee NORMAL y BANDA (en la base sigue CONVENCIONAL / PACKED)
export const ETIQUETA_PEDIDO = { CONVENCIONAL: 'NORMAL', PACKED: 'BANDA' };

// "PALMS BANANAS PACKED" / "PALMS BANANAS" (convencional no se repite en los textos cortos)
// 18/11/2026: `etiquetas` opcional (ETIQUETA_PEDIDO en el pedido: PALMS BANANAS BANDA)
export const marcaConPresentacion = (nombreMarca, presentacion, etiquetas = null) =>
  [nombreMarca, presentacion === 'PACKED' ? (etiquetas?.PACKED || 'PACKED') : null].filter(Boolean).join(' ');
