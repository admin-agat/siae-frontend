import axios from "./axios";

export const getPortTariffItems = (params = {}) => axios.get("/port-tariff-items", { params });

export const getPortTariffItem = (id) => axios.get(`/port-tariff-items/${id}`);

export const createPortTariffItem = (data) => axios.post("/port-tariff-items", data);

export const updatePortTariffItem = (id, data) => axios.put(`/port-tariff-items/${id}`, data);

export const deactivatePortTariffItem = (id) => axios.patch(`/port-tariff-items/${id}/deactivate`);

export const reactivatePortTariffItem = (id) => axios.patch(`/port-tariff-items/${id}/reactivate`);

export const getPortTariffItemPriceHistory = (id) => axios.get(`/port-tariff-items/${id}/price-history`);