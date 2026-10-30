// Capa API de LIQUIDACIÓN AL PRODUCTOR — src/api/settlements.js
// Tarjas (lo recibido en puerto), anticipos/préstamos y liquidaciones con sus pagos.
// Devuelve la promesa cruda (el componente lee res.data). Solo ADMIN (backend: middleware admin).
import axios from "./axios";

// ---- Tarjas de una semana (pedido) ----
export const getOrderTallies = (orderId) => axios.get(`/customer-orders/${orderId}/tallies`);
export const saveOrderTallies = (orderId, data) => axios.put(`/customer-orders/${orderId}/tallies`, data);

// ---- Anticipos y préstamos ----
// params opcional: { third_party_id, status, con_saldo: 1 }
export const getProducerAdvances = (params = {}) => axios.get("/producer-advances", { params });
export const createProducerAdvance = (data) => axios.post("/producer-advances", data);
export const updateProducerAdvance = (id, data) => axios.put(`/producer-advances/${id}`, data);
export const deactivateProducerAdvance = (id) => axios.patch(`/producer-advances/${id}/deactivate`);
export const reactivateProducerAdvance = (id) => axios.patch(`/producer-advances/${id}/reactivate`);

// ---- Liquidaciones ----
// Cupos de Comercial con lo que dicen sus tarjas y su liquidación (si tiene)
export const getSettlementQuotas = (params = {}) => axios.get("/settlements/quotas", { params });
// Cálculo sin guardar de un cupo + anticipos con saldo
export const getSettlementPreview = (quotaId) => axios.get(`/settlements/preview/${quotaId}`);
// params opcional: { third_party_id, status, pendientes: 1, nc_pendiente: 1 }
export const getSettlements = (params = {}) => axios.get("/settlements", { params });
export const getSettlement = (id) => axios.get(`/settlements/${id}`);
export const createSettlement = (data) => axios.post("/settlements", data);
export const paySettlement = (id, installment, data) => axios.patch(`/settlements/${id}/payments/${installment}/pay`, data);
export const unpaySettlement = (id, installment) => axios.patch(`/settlements/${id}/payments/${installment}/unpay`);
export const annulSettlement = (id, reason) => axios.patch(`/settlements/${id}/annul`, { reason });
// N° de factura y de nota de crédito del vendedor (30/10/2026)
export const saveSettlementDocuments = (id, data) => axios.patch(`/settlements/${id}/documents`, data);
