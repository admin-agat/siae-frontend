import axios from "./axios";

export const getCustomers = (params = {}) => axios.get("/customers", { params });

export const getCustomer = (id) => axios.get(`/customers/${id}`);

export const createCustomer = (data) => axios.post("/customers", data);

export const updateCustomer = (id, data) => axios.put(`/customers/${id}`, data);

export const deactivateCustomer = (id) => axios.patch(`/customers/${id}/deactivate`);

export const reactivateCustomer = (id) => axios.patch(`/customers/${id}/reactivate`);