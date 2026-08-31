// importa para consumir la api third-parties
import api from "./axios";

// get all third parties
export const getThirdParties = () => api.get('third-parties');

// get third party by id
export const getThirdParty = (id) => api.get(`/third-parties/${id}`);

// create new third party
export const createThirdParty = (data) => api.post('/third-parties', data);

// update third party
export const updateThirdParty = (id, data) => api.put(`/third-parties/${id}`, data);

// deactivate third party (soft delete, status = false)
export const deleteThirdParty = (id) => api.delete(`/third-parties/${id}`);