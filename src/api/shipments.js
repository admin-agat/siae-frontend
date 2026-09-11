import axios from "./axios";

export const getShipments = (params = {}) => axios.get("/shipments", { params });

export const getShipment = (id) => axios.get(`/shipments/${id}`);

export const getNextShipmentCode = () => axios.get("/shipments/next-code");

export const createShipment = (data) => axios.post("/shipments", data);

export const updateShipment = (id, data) => axios.put(`/shipments/${id}`, data);

export const deactivateShipment = (id) => axios.patch(`/shipments/${id}/deactivate`);

export const reactivateShipment = (id) => axios.patch(`/shipments/${id}/reactivate`);