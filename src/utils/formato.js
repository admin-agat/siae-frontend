// 05/11/2026: montos con el formato de Ecuador (1.234,56), igual en todas las pantallas
export const dinero = (valor, decimales = 2) =>
  Number(valor || 0).toLocaleString('es-EC', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
