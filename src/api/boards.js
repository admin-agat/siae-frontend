// Tableros con datos reales — 11/11/2026
import axios from "./axios";

// Tablero de operaciones (sin dinero): { year, week_from, week_to, customer_id, brand_id, negotiation_type }
export const getOperationsBoard = (params) => axios.get("/boards/operations", { params });
