// Gastos y ganancia por viaje (Finanzas) — 02/11/2026
import axios from "./axios";

// Barcos de la semana (pedido) con tarifa, gastos y carga de cada uno
export const getVoyageCosts = (customerOrderId) => axios.get("/voyage-costs", { params: { customer_order_id: customerOrderId } });

// Tarifas, gastos y carga por cliente de un barco
export const getVoyageCost = (shipmentId) => axios.get(`/voyage-costs/${shipmentId}`);

// Guarda { container_rate, under_deck_amount, notes, expenses: [...] } (reemplaza la lista de gastos)
export const saveVoyageCost = (shipmentId, data) => axios.put(`/voyage-costs/${shipmentId}`, data);

// Ganancia de los viajes de la semana, por viaje y por cliente
export const getVoyageProfit = (customerOrderId) => axios.get("/voyage-profit", { params: { customer_order_id: customerOrderId } });
