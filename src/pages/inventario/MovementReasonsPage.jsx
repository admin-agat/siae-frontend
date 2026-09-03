// MovementReasonsPage.jsx
// Página de listado y gestión de Motivos de Movimiento (Compra a proveedor, Transferencia, etc.)
import { useState, useEffect } from 'react';
import { Plus, Pencil, Ban, Search, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import { getMovementReasons, deactivateMovementReason, reactivateMovementReason } from '../../api/movementReasons';
import MovementReasonModal from '../../components/MovementReasonModal';
// Estándar centralizado de mensajes toast (crear/actualizar/desactivar/reactivar)
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

const POR_PAGINA = 10;

export default function MovementReasonsPage() {
    const [reasons, setReasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [reasonEdit, setReasonEdit] = useState(null);
    const [paginaActual, setPaginaActual] = useState(1);
    // Fila resaltada al hacer click (mismo patrón visual que WarehousesPage)
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);

    // Modal de confirmación propio, reemplaza el confirm() nativo del navegador
    // (mismo motivo que en el resto del módulo: Chrome lo bloquea tras varios
    // usos seguidos y el botón parece no hacer nada)
    // confirmacion = null (cerrado) o { reason, accion: 'desactivar'|'reactivar' }
    const [confirmacion, setConfirmacion] = useState(null);

    // Toast de éxito/error, mismo formato visual y mismo helper que el resto del módulo
    // toast = null (oculto) o { tipo: 'exito'|'error', mensaje: string }
    const [toast, setToast] = useState(null);

    useEffect(() => {
        cargarReasons();
    }, []);

    useEffect(() => {
        setPaginaActual(1);
    }, [busqueda]);

    // Oculta el toast automáticamente después de un momento
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2500);
        return () => clearTimeout(timer);
    }, [toast]);

    const cargarReasons = async () => {
        try {
            setLoading(true);
            const res = await getMovementReasons();
            setReasons(res.data);
        } catch (error) {
            console.error('Error cargando motivos de movimiento:', error);
        } finally {
            setLoading(false);
        }
    };

    // Abre el modal de confirmación en vez de ejecutar la acción directo
    const pedirConfirmacion = (reason, accion) => {
        setConfirmacion({ reason, accion });
    };

    // Se ejecuta solo cuando el usuario confirma en el modal propio
    const ejecutarConfirmacion = async () => {
        if (!confirmacion) return;
        const { reason, accion } = confirmacion;

        try {
            if (accion === 'desactivar') {
                await deactivateMovementReason(reason.id);
            } else {
                await reactivateMovementReason(reason.id);
            }
            cargarReasons();
            setToast({ tipo: 'exito', mensaje: getMensajeExito('motivo', accion) });
        } catch (error) {
            console.error(`Error al ${accion} motivo:`, error);
            setToast({ tipo: 'error', mensaje: getMensajeError('motivo', accion) });
        } finally {
            setConfirmacion(null);
        }
    };

    const handleEditar = (reason) => {
        setReasonEdit(reason);
        setShowModal(true);
    };

    const handleNuevo = () => {
        setReasonEdit(null);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setReasonEdit(null);
    };

    const reasonsFiltrados = reasons.filter(r =>
        `${r.name} ${r.type}`.toLowerCase().includes(busqueda.toLowerCase())
    );

    const totalPaginas = Math.max(1, Math.ceil(reasonsFiltrados.length / POR_PAGINA));
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const reasonsPagina = reasonsFiltrados.slice(inicio, inicio + POR_PAGINA);

    const irPaginaAnterior = () => setPaginaActual(p => Math.max(1, p - 1));
    const irPaginaSiguiente = () => setPaginaActual(p => Math.min(totalPaginas, p + 1));

    return (
        <div className="p-6">
            {/* Toast de éxito/error — mismo formato visual y helper que el resto del módulo */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-[70] ${
                    toast.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'
                }`}>
                    {toast.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {toast.mensaje}
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Motivos de Movimiento</h1>
                    <p className="text-gray-500 text-sm">Compra a proveedor, Transferencia, Devolución...</p>
                </div>
                <button
                    onClick={handleNuevo}
                    className="flex items-center gap-2 bg-[#3B5BDB] text-white px-4 py-2 rounded-lg hover:bg-[#2F49B8] transition"
                >
                    <Plus size={18} />
                    Nuevo motivo
                </button>
            </div>

            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-4 w-full max-w-md">
                <Search size={18} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre o tipo..."
                    className="outline-none w-full text-sm uppercase placeholder:normal-case"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                />
            </div>

            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-[#3B5BDB] text-white">
                        <tr>
                            <th className="text-left px-4 py-3">Nombre</th>
                            <th className="text-left px-4 py-3">Tipo</th>
                            <th className="text-left px-4 py-3">Estado</th>
                            <th className="text-left px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="4" className="text-center py-8 text-gray-400">
                                    Cargando motivos...
                                </td>
                            </tr>
                        ) : reasonsPagina.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center py-8 text-gray-400">
                                    No hay motivos registrados
                                </td>
                            </tr>
                        ) : (
                            reasonsPagina.map((r, i) => (
                                <tr
                                    key={r.id}
                                    onClick={() => setFilaSeleccionada(r.id)}
                                    className={`cursor-pointer transition ${
                                        filaSeleccionada === r.id
                                            ? 'bg-blue-50'
                                            : i % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                                    } hover:bg-blue-50/60`}
                                >
                                    <td className="px-4 py-3 font-medium">{r.name}</td>
                                    <td className="px-4 py-3 text-gray-600">{r.type}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            r.status
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {r.status ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                        {r.status ? (
                                            <>
                                                <button onClick={() => handleEditar(r)} className="text-blue-500 hover:text-blue-700">
                                                    <Pencil size={16} />
                                                </button>
                                                {/* Ban en vez de Trash2: el motivo se desactiva (reversible), no
                                                    se borra permanentemente — mismo ícono que Bodegas/Insumos */}
                                                <button onClick={() => pedirConfirmacion(r, 'desactivar')} className="text-red-500 hover:text-red-700">
                                                    <Ban size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={() => pedirConfirmacion(r, 'reactivar')} className="text-green-600 hover:text-green-800" title="Reactivar">
                                                <RotateCcw size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {!loading && reasonsFiltrados.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                        <span className="text-xs text-gray-500">
                            Mostrando {inicio + 1}–{Math.min(inicio + POR_PAGINA, reasonsFiltrados.length)} de {reasonsFiltrados.length} motivos
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={irPaginaAnterior}
                                disabled={paginaActual === 1}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                <ChevronLeft size={16} />
                                Anterior
                            </button>
                            <span className="text-sm text-gray-600 px-2">
                                Página {paginaActual} de {totalPaginas}
                            </span>
                            <button
                                onClick={irPaginaSiguiente}
                                disabled={paginaActual === totalPaginas}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                Siguiente
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showModal && (
                <MovementReasonModal
                    reason={reasonEdit}
                    onClose={handleCloseModal}
                    onGuardado={cargarReasons}
                />
            )}

            {/* Modal de confirmación propio — reemplaza confirm() nativo */}
            {confirmacion && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                confirmacion.accion === 'desactivar' ? 'bg-red-100' : 'bg-green-100'
                            }`}>
                                <AlertTriangle
                                    size={20}
                                    className={confirmacion.accion === 'desactivar' ? 'text-red-600' : 'text-green-600'}
                                />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">
                                    {confirmacion.accion === 'desactivar' ? 'Desactivar motivo' : 'Reactivar motivo'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    ¿Estás seguro de {confirmacion.accion} <strong>{confirmacion.reason.name}</strong>?
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmacion(null)}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={ejecutarConfirmacion}
                                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg ${
                                    confirmacion.accion === 'desactivar'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-green-600 hover:bg-green-700'
                                }`}
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}