// Capa API de VACACIONES Y PERMISOS, fase 1 (LEGAL → Empleados y saldos) — 16/11/2026
// Ficha de empleados, kárdex de días, departamentos y feriados. Todo con la pantalla empleados_saldos.
import axios from "./axios";

// Empleados (cédula enmascarada en la lista; completa solo en getEmployee)
export const getEmployees = (params = {}) => axios.get("/employees", { params });
export const getEmployeeOptions = () => axios.get("/employees/options"); // { departments, supervisors, users }
export const getEmployee = (id) => axios.get(`/employees/${id}`);
export const createEmployee = (data) => axios.post("/employees", data); // + initial_balance opcional
export const updateEmployee = (id, data) => axios.put(`/employees/${id}`, data);
export const deactivateEmployee = (id, terminationDate) => axios.patch(`/employees/${id}/deactivate`, { termination_date: terminationDate });
export const reactivateEmployee = (id) => axios.patch(`/employees/${id}/reactivate`);

// Kárdex: { employee, resumen, movements } · movimiento manual { type: SALDO_INICIAL|AJUSTE, days, movement_date?, reason }
export const getEmployeeLedger = (id) => axios.get(`/employees/${id}/ledger`);
export const addEmployeeMovement = (id, data) => axios.post(`/employees/${id}/movements`, data);

// Departamentos (catálogo)
export const getDepartments = (params = {}) => axios.get("/departments", { params });
export const createDepartment = (data) => axios.post("/departments", data);
export const updateDepartment = (id, data) => axios.put(`/departments/${id}`, data);
export const deactivateDepartment = (id) => axios.patch(`/departments/${id}/deactivate`);
export const reactivateDepartment = (id) => axios.patch(`/departments/${id}/reactivate`);

// Feriados ({ year } opcional)
export const getHolidays = (params = {}) => axios.get("/holidays", { params });
export const createHoliday = (data) => axios.post("/holidays", data);
export const updateHoliday = (id, data) => axios.put(`/holidays/${id}`, data);
export const deactivateHoliday = (id) => axios.patch(`/holidays/${id}/deactivate`);
export const reactivateHoliday = (id) => axios.patch(`/holidays/${id}/reactivate`);
