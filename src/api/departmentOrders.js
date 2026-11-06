import axios from './axios';

// 05/11/2026: órdenes de compra del departamento del usuario (Compras, Sistemas, Logística...).
// Las aprueba Contabilidad (api/accounting.js).
export const getDepartmentOrders = () => axios.get('/department-orders').then((res) => res.data);
export const createDepartmentOrder = (data) => axios.post('/department-orders', data).then((res) => res.data);
export const updateDepartmentOrder = (id, data) => axios.put(`/department-orders/${id}`, data).then((res) => res.data);
export const cancelDepartmentOrder = (id, cancellationReason) =>
    axios.patch(`/department-orders/${id}/cancel`, { cancellation_reason: cancellationReason }).then((res) => res.data);
