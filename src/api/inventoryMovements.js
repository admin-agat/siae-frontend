import axios from './axios';

// Crea un movimiento de inventario completo (cabecera + líneas) en una sola
// petición. El backend lo procesa todo dentro de una transacción.
export const createInventoryMovement = (data) => {
  return axios.post('/inventory-movements', data);
};

// Transferencia entre bodegas: crea el EGRESO en estado PENDIENTE en el
// backend. Distinta de createInventoryMovement porque no lleva
// movement_reason_id/third_party_id en el payload — el backend fija el
// motivo de transferencia automáticamente. El INGRESO en destino se crea
// después, cuando el Coordinador confirma con confirmTransfer().
export const transferInventoryMovement = (data) => {
  return axios.post('/inventory-movements/transfer', data);
};

// Lista movimientos, con filtros opcionales (warehouse_id, type, date_from, date_to).
export const getInventoryMovements = (params = {}) => {
  return axios.get('/inventory-movements', { params });
};

// Trae un movimiento puntual con su detalle completo.
export const getInventoryMovement = (id) => {
  return axios.get(`/inventory-movements/${id}`);
};

export const updateInventoryMovement = (id, data) => {
  return axios.put(`/inventory-movements/${id}`, data);
};

export const deactivateInventoryMovement = (id) => {
  return axios.delete(`/inventory-movements/${id}`);
};

// Trae el stock actual de todos los insumos de UNA bodega (usa el filtro
// warehouse_id agregado a stockGeneral en el backend). Se usa en el modo
// Transferencia para validar cantidad contra existencia real antes de guardar.
export const getStockByWarehouse = (warehouseId) => {
  return axios.get('/inventory/stock', { params: { warehouse_id: warehouseId } });
};

// NUEVO — Coordinador de Inventario: lista las transferencias pendientes
// de confirmación (EGRESOs con transfer_status = PENDIENTE).
export const getPendingTransfers = () => {
  return axios.get('/inventory-movements/pending-transfers');
};

// NUEVO — Coordinador de Inventario: confirma una transferencia pendiente,
// creando el INGRESO en destino. Recibe las líneas (posiblemente ajustadas
// si algo se perdió/dañó en el traslado) + reception_note opcional por línea.
export const confirmTransfer = (id, data) => {
  return axios.post(`/inventory-movements/${id}/confirm-transfer`, data);
};


export const cancelTransfer = (id) => axios.post(`/inventory-movements/${id}/cancel-transfer`);
