import axios from './axios';

// 11/11/2026: comerciales que compran la fruta (lista que maneja ADMIN desde Compra de fruta).
export const getComerciales = () => axios.get('/purchase-executives').then((res) => res.data);
export const crearComercial = (name) => axios.post('/purchase-executives', { name }).then((res) => res.data);
export const desactivarComercial = (id) => axios.patch(`/purchase-executives/${id}/deactivate`).then((res) => res.data);
export const reactivarComercial = (id) => axios.patch(`/purchase-executives/${id}/reactivate`).then((res) => res.data);
