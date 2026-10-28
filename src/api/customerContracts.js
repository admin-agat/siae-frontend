// Capa API de Contratos de CLIENTES — src/api/customerContracts.js
// Mismo patrón que el resto del proyecto: instancia propia de axios ("./axios"),
// devuelve la promesa cruda (el componente lee res.data).
import axios from "./axios";

// Lista de contratos. params opcional, ej. { status: true } o { customer_id: 3 }
export const getCustomerContracts = (params = {}) => axios.get("/customer-contracts", { params });

// Crear contrato
export const createCustomerContract = (data) => axios.post("/customer-contracts", data);

// Actualizar contrato
export const updateCustomerContract = (id, data) => axios.put(`/customer-contracts/${id}`, data);

// Anular (baja lógica)
export const deactivateCustomerContract = (id) => axios.patch(`/customer-contracts/${id}/deactivate`);

// Reactivar
export const reactivateCustomerContract = (id) => axios.patch(`/customer-contracts/${id}/reactivate`);
