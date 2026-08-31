// Servicio API para el módulo de Fincas
import axios from './axios';

export const getFarms = (params = {}) => axios.get('/farms', { params });
export const getFarm = (id) => axios.get(`/farms/${id}`);
export const createFarm = (data) => axios.post('/farms', data);
export const updateFarm = (id, data) => axios.put(`/farms/${id}`, data);
export const deleteFarm = (id) => axios.delete(`/farms/${id}`);