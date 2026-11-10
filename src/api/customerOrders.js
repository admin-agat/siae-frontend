// Capa API del PEDIDO SEMANAL (correo de Rusia) — src/api/customerOrders.js
// Mismo patrón que customerContracts.js: devuelve la promesa cruda (el componente lee res.data).
import axios from "./axios";

// Lista de pedidos con total de cajas y número de líneas. params opcional, ej. { status: true }
export const getCustomerOrders = (params = {}) => axios.get("/customer-orders", { params });

// Pedido con todas sus líneas
export const getCustomerOrder = (id) => axios.get(`/customer-orders/${id}`);

// Crear pedido: { week, year, received_at, comment, lines: [...] }
export const createCustomerOrder = (data) => axios.post("/customer-orders", data);

// Actualizar pedido (las líneas sin id se crean; las que faltan se borran)
export const updateCustomerOrder = (id, data) => axios.put(`/customer-orders/${id}`, data);

// Anular (baja lógica)
export const deactivateCustomerOrder = (id) => axios.patch(`/customer-orders/${id}/deactivate`);

// Reactivar
export const reactivateCustomerOrder = (id) => axios.patch(`/customer-orders/${id}/reactivate`);

// Fase 2 — distribución del pedido en barcos (Logística)
// Devuelve { order, shipments }: el pedido con sus líneas y los barcos con su reparto
export const getOrderDistribution = (id) => axios.get(`/customer-orders/${id}/distribution`);

// Guarda TODO el reparto de la semana: { version, shipments: [{ id?, shipping_line_id, vessel_id,
// departure_port_id, destination_port_id, departure_date, eta, comment,
// allocations: [{ customer_order_line_id, boxes }] }] }
export const saveOrderDistribution = (id, data) => axios.put(`/customer-orders/${id}/distribution`, data);

// Fase 3 — compra de fruta (Comercial)
// Devuelve { order, customers, shipments, blocks (con sus compras), executives, last_pickup, warehouses, version }
export const getOrderPurchases = (id) => axios.get(`/customer-orders/${id}/purchases`);

// Guarda TODAS las compras de la semana: { version, blocks: [{ ..., purchases: [{ id?, third_party_id,
// boxes, real_price, pickup_warehouse_id (bodega de retiro), ... }] }] }. 409 si otro usuario guardó antes.
export const saveOrderPurchases = (id, data) => axios.put(`/customer-orders/${id}/purchases`, data);

// 04/11/2026: finca nueva desde la compra { third_party_id, name, magap_code, zone } → queda en el catálogo
export const createPurchaseFarm = (id, data) => axios.post(`/customer-orders/${id}/purchases/farms`, data);

// 10/11/2026: enviar compras a bodega para que despache los materiales (una o todo el bloque).
// Las ya enviadas no se repiten. Devuelve lo mismo que getOrderPurchases + { enviadas, ya_enviadas }
export const sendPurchasesToWarehouse = (id, purchaseIds) => axios.post(`/customer-orders/${id}/purchases/send`, { purchase_ids: purchaseIds });

// Quitar el envío (enviada por error): solo si la bodega no entregó materiales todavía
export const unsendPurchase = (id, lineId) => axios.patch(`/customer-orders/${id}/purchases/${lineId}/unsend`);

// 29/10/2026 — Cierre de embarque (Exportaciones): bookings con lo realmente embarcado y documentos
// Devuelve { order, customers, shipments (con bookings), tallies, parties, version }
export const getOrderClosing = (id) => axios.get(`/customer-orders/${id}/closing`);

// Guarda los bookings de la semana: { version, shipments: [{ id, loading_from, loading_to,
// departure_date, eta, bookings: [...] }] }. 409 si otro usuario guardó antes (version vieja).
export const saveOrderClosing = (id, data) => axios.put(`/customer-orders/${id}/closing`, data);
