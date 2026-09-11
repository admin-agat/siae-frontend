import axios from "./axios";

export const getShippingLines = (params = {}) => axios.get("/shipping-lines", { params });

export const getShippingLine = (id) => axios.get(`/shipping-lines/${id}`);

export const createShippingLine = (data) => axios.post("/shipping-lines", data);

export const updateShippingLine = (id, data) => axios.put(`/shipping-lines/${id}`, data);

export const deactivateShippingLine = (id) => axios.patch(`/shipping-lines/${id}/deactivate`);

export const reactivateShippingLine = (id) => axios.patch(`/shipping-lines/${id}/reactivate`);