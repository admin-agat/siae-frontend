// Semana bananera = semana ISO 8601 (lunes a domingo; la semana 1 es la que tiene el primer jueves del año).
// Es la misma que usa el backend (Carbon isoWeek / isoWeekYear) para pedidos, cupos y despachos.
export const semanaISO = (fecha = new Date()) => {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); // jueves de esa semana
  const anio = d.getUTCFullYear();
  const semana = 1 + Math.floor((d - Date.UTC(anio, 0, 1)) / (7 * 24 * 3600 * 1000));
  return { semana, anio };
};
