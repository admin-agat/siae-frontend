import axios from './axios';

// Lista todos los insumos activos, con búsqueda y filtro opcional por categoría
export const getSupplies = (search = '', supplyCategoryId = null) => {
  const params = {};
  if (search) params.search = search;
  if (supplyCategoryId) params.supply_category_id = supplyCategoryId;
  return axios.get('/supplies', { params });
};

// Trae un insumo puntual
export const getSupply = (id) => {
  return axios.get(`/supplies/${id}`);
};

// Crea un insumo nuevo
export const createSupply = (data) => {
  return axios.post('/supplies', data);
};

// Actualiza un insumo existente
export const updateSupply = (id, data) => {
  return axios.put(`/supplies/${id}`, data);
};

export const deactivateSupply = (id) => {
  return axios.patch(`/supplies/${id}/deactivate`);
};

export const reactivateSupply = (id) => {
  return axios.patch(`/supplies/${id}/reactivate`);
};