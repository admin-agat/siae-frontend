import axios from './axios';

export const getBookings = () => {
  return axios.get('/bookings');
};

export const getBooking = (id) => {
  return axios.get(`/bookings/${id}`);
};

export const createBooking = (data) => {
  return axios.post('/bookings', data);
};

export const updateBooking = (id, data) => {
  return axios.put(`/bookings/${id}`, data);
};

export const deactivateBooking = (id) => {
  return axios.patch(`/bookings/${id}/deactivate`);
};

export const reactivateBooking = (id) => {
  return axios.patch(`/bookings/${id}/reactivate`);
};