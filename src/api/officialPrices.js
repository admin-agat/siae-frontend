// Wrapper de la API de Precios oficiales MAG (por tipo de caja) y Tipos de caja — 30/10/2026
import axios from './axios';

export const getBoxTypes = () => axios.get('/box-types');

export const getOfficialPrices = () => axios.get('/official-prices');

export const createOfficialPrice = (data) => axios.post('/official-prices', data);

export const updateOfficialPrice = (id, data) => axios.put(`/official-prices/${id}`, data);

export const deactivateOfficialPrice = (id) => axios.patch(`/official-prices/${id}/deactivate`);

export const reactivateOfficialPrice = (id) => axios.patch(`/official-prices/${id}/reactivate`);
