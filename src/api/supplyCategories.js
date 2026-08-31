import axios from './axios';

// Lista todas las categorías activas
export const getSupplyCategories = () => {
  return axios.get('/supply-categories');
};

// Trae una categoría puntual
export const getSupplyCategory = (id) => {
  return axios.get(`/supply-categories/${id}`);
};

// Crea una categoría nueva
export const createSupplyCategory = (data) => {
  return axios.post('/supply-categories', data);
};

// Actualiza una categoría existente
export const updateSupplyCategory = (id, data) => {
  return axios.put(`/supply-categories/${id}`, data);
};

// Desactiva una categoría (soft delete: status = false)
export const deactivateSupplyCategory = (id) => {
  return axios.patch(`/supply-categories/${id}/deactivate`);
};

// Reactiva una categoría previamente desactivada (status = true)
export const reactivateSupplyCategory = (id) => {
  return axios.patch(`/supply-categories/${id}/reactivate`);
};