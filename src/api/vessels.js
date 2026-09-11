import axios from './axios';

export const getVessels = (shippingLineId = null) => {
  const params = shippingLineId ? { shipping_line_id: shippingLineId } : {};
  return axios.get('/vessels', { params });
};

export const createVessel = (data) => {
  return axios.post('/vessels', data);
};

export const updateVessel = (id, data) => {
  return axios.put(`/vessels/${id}`, data);
};

export const deactivateVessel = (id) => {
  return axios.patch(`/vessels/${id}/deactivate`);
};

export const reactivateVessel = (id) => {
  return axios.patch(`/vessels/${id}/reactivate`);
};