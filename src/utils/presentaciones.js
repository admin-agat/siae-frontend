// Presentaciones de una marca (02/11/2026). El precio de venta del contrato depende de marca + presentación.
// PACKED = la misma marca con cinta/banda (antes PALMS CON BANDA era una marca aparte).
export const PRESENTACIONES = ['CONVENCIONAL', 'PACKED'];
// 18/11/2026 (Peter): en pantalla se lee NORMAL y BANDA en todo el sistema (en la base sigue CONVENCIONAL / PACKED)
export const ETIQUETA_PRESENTACION = { CONVENCIONAL: 'NORMAL', PACKED: 'BANDA' };

// "PALMS BANANAS PACKED" / "PALMS BANANAS" (convencional no se repite en los textos cortos)
// 18/11/2026: "PALMS BANANAS BANDA" (antes PACKED)
export const marcaConPresentacion = (nombreMarca, presentacion) =>
  [nombreMarca, presentacion === 'PACKED' ? ETIQUETA_PRESENTACION.PACKED : null].filter(Boolean).join(' ');
