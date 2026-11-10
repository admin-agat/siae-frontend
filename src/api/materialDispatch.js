import axios from './axios';

// Todas las llamadas del Despacho de Materiales pasan por aquí (regla: nunca axios desde la página).
// Cada función devuelve directamente res.data.

// Calcula materiales por cupo de marca.
// payload: { warehouse_id, third_party_id, cupos: { GLOBAL_VILLAGE: 700, ... } }
// Respuesta: { materiales: [...], cupo_existente: {...} | null }
export const calcularDespacho = (payload) =>
  axios.post('/material-dispatch/calculate', payload).then((res) => res.data);

// Guarda el despacho: crea/reutiliza el cupo de la semana + el EGRESO (descuenta stock).
// Respuesta: el movimiento completo (se pasa directo a la guía imprimible).
export const guardarDespacho = (payload) =>
  axios.post('/material-dispatch', payload).then((res) => res.data);

// Historial de despachos. params opcionales: { warehouse_id, third_party_id, week, year }
export const getDespachos = (params = {}) =>
  axios.get('/material-dispatch', { params }).then((res) => res.data);

// Detalle de un despacho
export const getDespacho = (id) =>
  axios.get(`/material-dispatch/${id}`).then((res) => res.data);

// Anula un despacho (solo COORDINADOR_INVENTARIO / ADMIN). El stock regresa a la bodega.
export const anularDespacho = (id) =>
  axios.patch(`/material-dispatch/${id}/deactivate`).then((res) => res.data);
// Fase 3 — cupos que Comercial asignó a un productor/comercializadora (sin liquidar), por
// semana y marca: [{ producer_quota_id, week, year, status, brand_code, brand_name, cajas }]
export const getCuposAsignados = (thirdPartyId) =>
  axios.get(`/material-dispatch/quotas/${thirdPartyId}`).then((res) => res.data);
// 05/11/2026: bandeja "Por despachar" — compras de Comercial sin liquidar y lo que falta entregar:
// [{ producer_quota_id, third_party_id, producer_name, farms, week, year, brand_code, brand_name, cajas,
//    warehouse_id, warehouse_name, estado: PENDIENTE|PARCIAL|COMPLETO|SIN_RECETA, avance, retiros, ultimo_retiro }]
export const getPorDespachar = (params = {}) =>
  axios.get('/material-dispatch/pending', { params }).then((res) => res.data);
// 10/11/2026: cuántas compras enviadas por Comercial faltan por despachar (contador del menú): { count }
export const getPorDespacharCuenta = () =>
  axios.get('/material-dispatch/pending/count').then((res) => res.data);
