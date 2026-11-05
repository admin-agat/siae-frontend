// 05/11/2026: fecha de HOY en la hora del equipo (Ecuador), "AAAA-MM-DD" para los campos de fecha.
// No usar new Date().toISOString(): da la fecha en UTC y desde las 19:00 de Ecuador ya es "mañana".
const dos = (n) => String(n).padStart(2, '0');
export const hoyISO = (d = new Date()) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
