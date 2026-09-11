import axios from "./axios";

export const getPorts = (params = {}) => axios.get("/ports", { params });

export const getPort = (id) => axios.get(`/ports/${id}`);

export const createPort = (data) => axios.post("/ports", data);

export const updatePort = (id, data) => axios.put(`/ports/${id}`, data);

export const deactivatePort = (id) => axios.patch(`/ports/${id}/deactivate`);

export const reactivatePort = (id) => axios.patch(`/ports/${id}/reactivate`);