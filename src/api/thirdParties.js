// Funciones para consumir la API de Terceros (third-parties)
// Ubicación: src/api/thirdParties.js
// Usa la instancia configurada de axios del proyecto (./axios), nunca axios directo.
import api from "./axios";

// Lista todos los terceros (cada uno trae su ficha "customer" si es CLIENTE)
// Se agregó "/" al inicio para que todas las rutas del archivo sigan el mismo formato
export const getThirdParties = () => api.get('/third-parties');

// Obtiene un tercero por id
export const getThirdParty = (id) => api.get(`/third-parties/${id}`);

// Crea un tercero (si es CLIENTE, el backend crea también su ficha en customers)
export const createThirdParty = (data) => api.post('/third-parties', data);

// Actualiza un tercero
export const updateThirdParty = (id, data) => api.put(`/third-parties/${id}`, data);

// 27/10/2026: se ELIMINÓ deleteThirdParty (llamaba a DELETE, ruta que ya no existe).
// Estándar del SIAE: baja lógica reversible con PATCH, igual que Bodegas.

// Desactiva un tercero (status = false) — solo ADMIN
export const deactivateThirdParty = (id) => api.patch(`/third-parties/${id}/deactivate`);

// Reactiva un tercero (status = true) — solo ADMIN
export const reactivateThirdParty = (id) => api.patch(`/third-parties/${id}/reactivate`);