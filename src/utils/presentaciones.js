// Presentaciones de una marca (02/11/2026). El precio de venta del contrato depende de marca + presentación.
// PACKED = la misma marca con cinta/banda (antes PALMS CON BANDA era una marca aparte).
export const PRESENTACIONES = ['CONVENCIONAL', 'PACKED'];

// "PALMS BANANAS PACKED" / "PALMS BANANAS" (convencional no se repite en los textos cortos)
export const marcaConPresentacion = (nombreMarca, presentacion) =>
  [nombreMarca, presentacion === 'PACKED' ? 'PACKED' : null].filter(Boolean).join(' ');
