// Capa API de USUARIOS (CONFIGURACIÓN, solo ADMIN) — src/api/users.js
// Devuelve la promesa cruda (el componente lee res.data), igual que customerOrders.js.
import axios from "./axios";

// Lista de usuarios con su bodega (si es BODEGUERO)
export const getUsers = () => axios.get("/users");

// Crear: { name, email (correo o usuario), password, role, phone, warehouse_id (BODEGUERO) }
export const createUser = (data) => axios.post("/users", data);

// Actualizar (password vacío = no cambia). Si cambia rol, usuario o contraseña, se cierra su sesión.
export const updateUser = (id, data) => axios.put(`/users/${id}`, data);

// Desactivar: no puede iniciar sesión y sale del sistema al instante
export const deactivateUser = (id) => axios.patch(`/users/${id}/deactivate`);

export const reactivateUser = (id) => axios.patch(`/users/${id}/reactivate`);
