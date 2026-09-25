// Wrapper de la API de Recetas de Materiales — nunca se llama axios directo desde componentes
import axios from './axios';

// Lista recetas. Si se pasa brand, filtra solo esa marca (ej. 'GLOBAL_VILLAGE')
export const getMaterialRecipes = (brand = null) => {
    const params = brand ? { brand } : {};
    return axios.get('/material-recipes', { params });
};

// Insumos que se pueden asignar a una marca (excluye los que ya tienen receta
// en esa marca o en TODAS). Sin brand, excluye los que tienen receta en cualquier marca.
export const getAvailableSupplies = (brand = null) => {
    const params = brand ? { brand } : {};
    return axios.get('/material-recipes/available-supplies', { params });
};

export const createMaterialRecipe = (data) => axios.post('/material-recipes', data);

export const updateMaterialRecipe = (id, data) => axios.put(`/material-recipes/${id}`, data);

export const deactivateMaterialRecipe = (id) => axios.patch(`/material-recipes/${id}/deactivate`);

export const reactivateMaterialRecipe = (id) => axios.patch(`/material-recipes/${id}/reactivate`);