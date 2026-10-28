// Página de Contratos de CLIENTES — src/pages/exportaciones/CustomerContractsPage.jsx
// Lista de contratos por cliente con su vigencia y precio por caja.
// Patrón del proyecto: modal propio, confirmación propia (no confirm()), toast local, deactivate/reactivate.
import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Ban, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import { getCustomerContracts, deactivateCustomerContract, reactivateCustomerContract } from '../../api/customerContracts';
import CustomerContractModal from '../../components/CustomerContractModal';

// Calcula si el contrato está VIGENTE, VENCIDO o FUTURO según la fecha de hoy
const estadoVigencia = (c) => {
    const hoy = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    if (c.end_date < hoy) return { texto: 'VENCIDO', clase: 'bg-gray-100 text-gray-600' };
    if (c.start_date > hoy) return { texto: 'FUTURO', clase: 'bg-amber-100 text-amber-700' };
    return { texto: 'VIGENTE', clase: 'bg-green-100 text-green-700' };
};

// "2026-01-15" → "15/01/2026" (sin new Date para no correr la fecha por zona horaria)
const formatoFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');

export default function CustomerContractsPage() {
    const [contratos, setContratos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');

    // Modal crear/editar: null = cerrado, {} = nuevo, objeto = edición
    const [contratoModal, setContratoModal] = useState(null);

    // Confirmación de anular/reactivar
    const [confirmacion, setConfirmacion] = useState(null); // { contrato, accion }
    const [toast, setToast] = useState(null); // { tipo, mensaje }
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);

    // Carga la lista desde el backend
    const cargarContratos = async () => {
        setCargando(true);
        try {
            const res = await getCustomerContracts();
            setContratos(Array.isArray(res.data) ? res.data : []); // defensivo
        } catch (err) {
            console.error('ERROR AL CARGAR CONTRATOS:', err);
            setContratos([]);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargarContratos(); }, []);

    // Muestra un toast y lo oculta a los 2.5 s
    const mostrarToast = (tipo, mensaje) => {
        setToast({ tipo, mensaje });
        setTimeout(() => setToast(null), 2500);
    };

    // Ejecuta anular o reactivar luego de confirmar
    const ejecutarCambioEstado = async () => {
        const { contrato, accion } = confirmacion;
        try {
            if (accion === 'anular') await deactivateCustomerContract(contrato.id);
            else await reactivateCustomerContract(contrato.id);
            mostrarToast('exito', accion === 'anular' ? 'CONTRATO ANULADO' : 'CONTRATO REACTIVADO');
            cargarContratos();
        } catch (err) {
            console.error(err);
            mostrarToast('error', err?.response?.data?.message || 'NO SE PUDO CAMBIAR EL ESTADO DEL CONTRATO');
        } finally {
            setConfirmacion(null);
        }
    };

    // Filtro por cliente o número de contrato
    const texto = busqueda.trim().toUpperCase();
    const filtrados = contratos.filter((c) => {
        if (!texto) return true;
        const cliente = c.customer?.third_party?.name || '';
        return cliente.toUpperCase().includes(texto) || (c.contract_number || '').includes(texto);
    });

    return (
        <div className="p-8 relative">
            {/* Toast local */}
            {toast && (
                <div className={`fixed top-6 right-6 z-[70] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 ${toast.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {toast.mensaje}
                </div>
            )}

            {/* Título + botón nuevo */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Contratos de clientes</h1>
                    <p className="text-sm text-gray-500">Vigencia y precio por caja de cada cliente</p>
                </div>
                <button onClick={() => setContratoModal({})}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition">
                    <Plus size={18} /> Nuevo contrato
                </button>
            </div>

            {/* Buscador */}
            <div className="relative w-full max-w-md mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                    placeholder="BUSCAR POR CLIENTE O N° CONTRATO..."
                    className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-indigo-600 text-white">
                        <tr>
                            <th className="text-left px-4 py-3">N° Contrato</th>
                            <th className="text-left px-4 py-3">Cliente</th>
                            <th className="text-left px-4 py-3">Incoterm</th>
                            <th className="text-left px-4 py-3">Inicio</th>
                            <th className="text-left px-4 py-3">Fin</th>
                            <th className="text-right px-4 py-3">Precio caja</th>
                            <th className="text-right px-4 py-3">Cajas/sem</th>
                            <th className="text-center px-4 py-3">Vigencia</th>
                            <th className="text-center px-4 py-3">Estado</th>
                            <th className="text-center px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cargando ? (
                            <tr><td colSpan={10} className="text-center py-8 text-gray-400">Cargando...</td></tr>
                        ) : filtrados.length === 0 ? (
                            <tr><td colSpan={10} className="text-center py-8 text-gray-400">No hay contratos registrados</td></tr>
                        ) : (
                            filtrados.map((c) => {
                                const vig = estadoVigencia(c);
                                return (
                                    <tr key={c.id}
                                        onClick={() => setFilaSeleccionada(c.id)}
                                        className={`border-t border-gray-100 cursor-pointer ${filaSeleccionada === c.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                        <td className="px-4 py-3">{c.contract_number || '—'}</td>
                                        <td className="px-4 py-3 font-semibold">{c.customer?.third_party?.name || '—'}</td>
                                        <td className="px-4 py-3">{c.incoterm || 'TODOS'}</td>
                                        <td className="px-4 py-3">{formatoFecha(c.start_date)}</td>
                                        <td className="px-4 py-3">{formatoFecha(c.end_date)}</td>
                                        <td className="px-4 py-3 text-right">${Number(c.box_price).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right">{c.weekly_boxes ? Number(c.weekly_boxes).toLocaleString('es-EC') : '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${vig.clase}`}>{vig.texto}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {c.status ? 'ACTIVO' : 'INACTIVO'}
                                            </span>
                                        </td>
                                        {/* stopPropagation: los botones no cambian la fila seleccionada */}
                                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-center gap-2">
                                                <button title="Editar" onClick={() => setContratoModal(c)}
                                                    className="p-1.5 rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 shadow-sm">
                                                    <Pencil size={16} />
                                                </button>
                                                {c.status ? (
                                                    <button title="Anular" onClick={() => setConfirmacion({ contrato: c, accion: 'anular' })}
                                                        className="p-1.5 rounded-lg border border-gray-200 text-red-600 hover:bg-red-50 shadow-sm">
                                                        <Ban size={16} />
                                                    </button>
                                                ) : (
                                                    <button title="Reactivar" onClick={() => setConfirmacion({ contrato: c, accion: 'reactivar' })}
                                                        className="p-1.5 rounded-lg border border-gray-200 text-green-600 hover:bg-green-50 shadow-sm">
                                                        <RotateCcw size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal crear/editar (se monta solo cuando está abierto) */}
            {contratoModal && (
                <CustomerContractModal
                    contract={contratoModal}
                    onClose={() => setContratoModal(null)}
                    onGuardado={cargarContratos}
                />
            )}

            {/* Confirmación propia de anular/reactivar */}
            {confirmacion && (
                <div className="fixed inset-0 flex items-center justify-center z-[60]" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm px-6 py-6">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={20} className={confirmacion.accion === 'anular' ? 'text-red-600' : 'text-green-600'} />
                            <h3 className="text-base font-bold text-gray-800">
                                {confirmacion.accion === 'anular' ? 'Anular contrato' : 'Reactivar contrato'}
                            </h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">
                            {confirmacion.accion === 'anular'
                                ? '¿Seguro que deseas anular este contrato? Ya no se usará para tomar precios en nuevos pedidos.'
                                : '¿Seguro que deseas reactivar este contrato?'}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => setConfirmacion(null)}
                                className="px-4 py-2 text-sm font-semibold bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
                                Cancelar
                            </button>
                            <button type="button" onClick={ejecutarCambioEstado}
                                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition ${confirmacion.accion === 'anular' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
