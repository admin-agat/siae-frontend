import axios from './axios';

// 12/11/2026: campanita de notificaciones. Cada usuario solo ve y marca los suyos (el backend filtra).
// Cada función devuelve directamente res.data.

// Últimos 30 avisos (no leídos primero)
export const getNotificaciones = () =>
  axios.get('/notifications').then((res) => res.data);

// { count } no leídos
export const getNotificacionesCuenta = () =>
  axios.get('/notifications/count').then((res) => res.data);

export const marcarLeida = (id) =>
  axios.patch(`/notifications/${id}/read`).then((res) => res.data);

export const marcarTodasLeidas = () =>
  axios.patch('/notifications/read-all').then((res) => res.data);
