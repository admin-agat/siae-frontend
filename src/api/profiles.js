// Capa API de PERFILES de permisos (CONFIGURACIÓN, solo ADMIN) — src/api/profiles.js (30/10/2026)
import axios from "./axios";

// Catálogo de pantallas que se pueden dar: [{ key, seccion, nombre }] en el orden del menú
export const getScreens = () => axios.get("/screens");

// Perfiles con users_count (usuarios activos)
export const getProfiles = () => axios.get("/profiles");

// { name, base_role, description, screens: [claves] }
export const createProfile = (data) => axios.post("/profiles", data);
export const updateProfile = (id, data) => axios.put(`/profiles/${id}`, data);
export const deactivateProfile = (id) => axios.patch(`/profiles/${id}/deactivate`);
export const reactivateProfile = (id) => axios.patch(`/profiles/${id}/reactivate`);
