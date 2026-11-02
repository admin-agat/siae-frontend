import axios from "./axios";

// Solo lectura (02/11/2026): la ficha del cliente se crea y edita en Terceros.
export const getCustomers = (params = {}) => axios.get("/customers", { params });

export const getCustomer = (id) => axios.get(`/customers/${id}`);
