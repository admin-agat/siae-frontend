import axios from './axios'; // ajusta esta línea si en farms.js el import es distinto

// Lista todas las bodegas activas (sin paginar en backend, igual que getFarms)
export const getWarehouses = () => {
  return axios.get('/warehouses');
};

// Trae una bodega puntual
export const getWarehouse = (id) => {
  return axios.get(`/warehouses/${id}`);
};

// Crea una nueva bodega
export const createWarehouse = (data) => {
  return axios.post('/warehouses', data);
};

// Actualiza una bodega existente
export const updateWarehouse = (id, data) => {
  return axios.put(`/warehouses/${id}`, data);
};

// Desactiva una bodega (soft delete: status = false)
export const deleteWarehouse = (id) => {
  return axios.delete(`/warehouses/${id}`);
};