import axios from './axios';

// Lista todos los motivos (activos e inactivos, para el catálogo con columna Estado).
// Acepta filtros opcionales: getMovementReasons({ type: 'INGRESO', solo_activos: 1 })
export const getMovementReasons = (params = {}) => {
  return axios.get('/movement-reasons', { params });
};

// Trae un motivo puntual
export const getMovementReason = (id) => {
  return axios.get(`/movement-reasons/${id}`);
};

// Crea un motivo nuevo
export const createMovementReason = (data) => {
  return axios.post('/movement-reasons', data);
};

// Actualiza un motivo existente
export const updateMovementReason = (id, data) => {
  return axios.put(`/movement-reasons/${id}`, data);
};

// Desactiva un motivo (soft delete: status = false)
export const deactivateMovementReason = (id) => {
  return axios.patch(`/movement-reasons/${id}/deactivate`);
};

// Reactiva un motivo previamente desactivado (status = true)
export const reactivateMovementReason = (id) => {
  return axios.patch(`/movement-reasons/${id}/reactivate`);
};

// Trae solo los motivos activos, filtrados por tipo (INGRESO/EGRESO).
// Pensado para usarse desde el formulario de InventoryMovements.
export const getActiveMovementReasonsByType = (type) => {
  return axios.get('/movement-reasons', { params: { type, solo_activos: 1 } });
};

