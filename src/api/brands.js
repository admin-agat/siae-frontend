// Wrapper de la API de Marcas — nunca se llama axios directo desde componentes
import axios from './axios';

export const getBrands = () => axios.get('/brands');

export const createBrand = (data) => axios.post('/brands', data);

export const updateBrand = (id, data) => axios.put(`/brands/${id}`, data);

export const deactivateBrand = (id) => axios.patch(`/brands/${id}/deactivate`);

export const reactivateBrand = (id) => axios.patch(`/brands/${id}/reactivate`);