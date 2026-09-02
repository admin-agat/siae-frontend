import axios from './axios';

// Lista todos los insumos activos, con búsqueda, filtro opcional por categoría
// y filtro opcional por proveedor (solo los insumos que ese proveedor vende,
// según la tabla pivote third_party_supplies)
export const getSupplies = (search = '', supplyCategoryId = null, thirdPartyId = null) => {
  const params = {};
  if (search) params.search = search;
  if (supplyCategoryId) params.supply_category_id = supplyCategoryId;
  if (thirdPartyId) params.third_party_id = thirdPartyId;
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