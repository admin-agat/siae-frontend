import axios from './axios';

// 06/11/2026: datos base de la liquidación como el Excel — parámetros de la semana, tabla de
// retención IR único banano, contratos y régimen de retención de productores.
export const getParametros = () => axios.get('/settlement-parameters').then((res) => res.data);
export const getPropuestaParametros = () => axios.get('/settlement-parameters/propuesta').then((res) => res.data);
export const crearParametros = (data) => axios.post('/settlement-parameters', data).then((res) => res.data);
export const actualizarParametros = (id, data) => axios.put(`/settlement-parameters/${id}`, data).then((res) => res.data);

export const getTramos = () => axios.get('/retention-brackets').then((res) => res.data);
export const guardarTramos = (brackets) => axios.put('/retention-brackets', { brackets }).then((res) => res.data);
export const simularRetencion = (params) => axios.get('/retention-brackets/simular', { params }).then((res) => res.data);

export const getContratosProductores = () => axios.get('/producer-contracts').then((res) => res.data);
// 12/11/2026: LEGAL guarda contratos y cajas MAG; Liquidaciones solo la retención (rutas separadas)
export const guardarContratosProductor = (thirdPartyId, data) => axios.put(`/producer-contracts/${thirdPartyId}/contracts`, data).then((res) => res.data);
export const guardarRetencionProductor = (thirdPartyId, data) => axios.put(`/producer-contracts/${thirdPartyId}/retention`, data).then((res) => res.data);
// 18/11/2026 (fase 2b): Liquidaciones completa la ficha del vendedor y registra su cuenta bancaria
// (solo la crea; después la ve enmascarada ****1234; cambiarla es de Contabilidad)
export const guardarFichaVendedor = (thirdPartyId, data) => axios.put(`/producer-profiles/${thirdPartyId}`, data).then((res) => res.data);
export const getCuentaVendedor = (thirdPartyId) => axios.get(`/producer-bank-accounts/${thirdPartyId}`).then((res) => res.data);
export const crearCuentaVendedor = (thirdPartyId, data) => axios.post(`/producer-bank-accounts/${thirdPartyId}`, data).then((res) => res.data);
