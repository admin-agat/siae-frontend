import axios from './axios';

// Lista órdenes de compra. Si se pasa un status (ej. 'PENDIENTE', o varios
// separados por coma como 'PENDIENTE,PARCIAL'), filtra solo esas — útil
// para el selector del Ingreso, que necesita OCs que aún tienen algo por
// recibir. thirdPartyId filtra además por proveedor (se usa junto con el
// Tercero ya elegido en el formulario de Ingreso).
export const getPurchaseOrders = (status = null, thirdPartyId = null) => {
  const params = {};
  if (status) params.status = status;
  if (thirdPartyId) params.third_party_id = thirdPartyId;
  return axios.get('/purchase-orders', { params });
};

// Trae una orden de compra puntual con sus líneas.
export const getPurchaseOrder = (id) => {
  return axios.get(`/purchase-orders/${id}`);
};

// Crea una nueva orden de compra con sus líneas.
export const createPurchaseOrder = (data) => {
  return axios.post('/purchase-orders', data);
};

// Vista previa del próximo código de OC (OC-2026-XXX) antes de guardar
export const getNextPurchaseOrderCode = (date) => {
  return axios.get('/purchase-orders/next-code', { params: { date } });
};