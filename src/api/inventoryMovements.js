import axios from './axios';

// Crea un movimiento de inventario completo (cabecera + líneas) en una sola
// petición. El backend lo procesa todo dentro de una transacción.
export const createInventoryMovement = (data) => {
  return axios.post('/inventory-movements', data);
};

// Lista movimientos, con filtros opcionales (warehouse_id, type, date_from, date_to).
export const getInventoryMovements = (params = {}) => {
  return axios.get('/inventory-movements', { params });
};

// Trae un movimiento puntual con su detalle completo.
export const getInventoryMovement = (id) => {
  return axios.get(`/inventory-movements/${id}`);
};

export const updateInventoryMovement = (id, data) => {
  return axios.put(`/inventory-movements/${id}`, data);
};

export const deactivateInventoryMovement = (id) => {
  return axios.delete(`/inventory-movements/${id}`);
};