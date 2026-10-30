// Wrapper de la API de la Bitácora (30/10/2026) — solo ADMIN, solo lectura
import axios from './axios';

// params: { user_id, table_name, action, record_id, desde, hasta, q, page }
export const getAuditLogs = (params = {}) => axios.get('/audit-logs', { params });
