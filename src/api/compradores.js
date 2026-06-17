// Funciones para consumir la API de compradores
import api from './axios';

// Obtener todos los compradores
export const getCompradores = () => api.get('/compradores');

// Obtener un comprador por ID
export const getComprador = (id) => api.get(`/compradores/${id}`);

// Crear un nuevo comprador
export const createComprador = (data) => api.post('/compradores', data);

// Actualizar un comprador
export const updateComprador = (id, data) => api.put(`/compradores/${id}`, data);

// Eliminar un comprador
export const deleteComprador = (id) => api.delete(`/compradores/${id}`);