// Servicio API para el módulo de Fincas
// Ubicación: src/api/farms.js
// Usa la instancia configurada de axios del proyecto (./axios), nunca axios directo.
import axios from './axios';

// Lista fincas (con su productor). params opcionales: { third_party_id, search }
export const getFarms = (params = {}) => axios.get('/farms', { params });

// Obtiene una finca por id
export const getFarm = (id) => axios.get(`/farms/${id}`);

// Crea una finca
export const createFarm = (data) => axios.post('/farms', data);

// Actualiza una finca
export const updateFarm = (id, data) => axios.put(`/farms/${id}`, data);

// 27/10/2026: se ELIMINÓ deleteFarm (llamaba a DELETE, ruta que ya no existe).
// Estándar del SIAE: baja lógica reversible con PATCH, igual que Terceros y Bodegas.

// Desactiva una finca (status = false) — solo ADMIN
export const deactivateFarm = (id) => axios.patch(`/farms/${id}/deactivate`);

// Reactiva una finca (status = true) — solo ADMIN
export const reactivateFarm = (id) => axios.patch(`/farms/${id}/reactivate`);