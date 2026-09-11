import axios from "./axios";

export const getDestinations = (params = {}) => axios.get("/destinations", { params });

export const createDestination = (data) => axios.post("/destinations", data);

export const updateDestination = (id, data) => axios.put(`/destinations/${id}`, data);

export const deactivateDestination = (id) => axios.patch(`/destinations/${id}/deactivate`);

export const reactivateDestination = (id) => axios.patch(`/destinations/${id}/reactivate`);