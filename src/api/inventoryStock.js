import axios from './axios';

// Trae el stock general: todas las bodegas con sus insumos y existencias.
export const getGeneralStock = () => {
  return axios.get('/inventory/stock');
};