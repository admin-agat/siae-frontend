import axios from './axios';

// 05/11/2026: Contabilidad — aprobación de las OC de todos los departamentos, lotes de pago al banco
// (TXT de Banco Pichincha), bancos y cuentas bancarias de proveedores.
export const getOrdenesContabilidad = () => axios.get('/accounting/purchase-orders').then((res) => res.data);
export const aprobarOC = (id) => axios.patch(`/accounting/purchase-orders/${id}/approve`).then((res) => res.data);
export const rechazarOC = (id, motivo) => axios.patch(`/accounting/purchase-orders/${id}/reject`, { rejection_reason: motivo }).then((res) => res.data);

export const getLotes = () => axios.get('/accounting/bank-batches').then((res) => res.data);
export const generarLote = (ids) => axios.post('/accounting/bank-batches', { ids }).then((res) => res.data);
export const lotePagado = (id) => axios.patch(`/accounting/bank-batches/${id}/paid`).then((res) => res.data);
export const anularLote = (id, motivo) => axios.patch(`/accounting/bank-batches/${id}/cancel`, { cancellation_reason: motivo }).then((res) => res.data);

// Baja el TXT del lote (el mismo archivo cada vez)
export const descargarLote = async (lote) => {
    const res = await axios.get(`/accounting/bank-batches/${lote.id}/file`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = lote.file_name || `${lote.code}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

export const getBancos = () => axios.get('/accounting/banks').then((res) => res.data);
export const crearBanco = (data) => axios.post('/accounting/banks', data).then((res) => res.data);
export const actualizarBanco = (id, data) => axios.put(`/accounting/banks/${id}`, data).then((res) => res.data);

export const getCuentasProveedores = () => axios.get('/accounting/bank-accounts').then((res) => res.data);
export const guardarCuenta = (thirdPartyId, data) => axios.put(`/accounting/bank-accounts/${thirdPartyId}`, data).then((res) => res.data);
