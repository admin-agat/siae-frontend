// Página principal del módulo Bodegas
import { useState, useEffect } from 'react';
import { Plus, Pencil, Ban, RotateCcw, Search, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import WarehouseModal from '../../components/WarehouseModal';
import { getWarehouses, deactivateWarehouse, reactivateWarehouse } from '../../api/warehouses';
// Estándar centralizado de mensajes toast (crear/actualizar/desactivar/reactivar)
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

const POR_PAGINA = 10;

export default function WarehousesPage() {
    const [bodegas, setBodegas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [bodegaEdit, setBodegaEdit] = useState(null);
    const [paginaActual, setPaginaActual] = useState(1);
    // Controla qué fila está resaltada al hacer click (solo visual, no afecta ninguna acción)
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);

    // Modal de confirmación propio, reemplaza al confirm() nativo del
    // navegador — este último dejaba de aparecer después de varios usos
    // seguidos (Chrome lo bloquea con la opción "Evitar más cuadros de
    // diálogo"), lo que hacía parecer que el botón no hacía nada.
    // confirmacion = null (cerrado) o { bodega, accion: 'desactivar'|'reactivar' }
    const [confirmacion, setConfirmacion] = useState(null);

    // Toast de éxito/error tras desactivar o reactivar (antes esta página
    // no mostraba ningún toast, solo un console.error en caso de falla)
    // toast = null (oculto) o { tipo: 'exito'|'error', mensaje: string }
    const [toast, setToast] = useState(null);

    useEffect(() => {
        cargarBodegas();
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

    const cargarBodegas = async () => {
        try {
            setLoading(true);
            const res = await getWarehouses();
            setBodegas(res.data);
        } catch (error) {
            console.error('Error cargando bodegas:', error);
        } finally {
            setLoading(false);
        }
    };

    // Abre el modal de confirmación en vez de ejecutar la acción directo
    const pedirConfirmacion = (bodega, accion) => {
        setConfirmacion({ bodega, accion });
    };

    // Se ejecuta solo cuando el usuario confirma en el modal propio
    const ejecutarConfirmacion = async () => {
        if (!confirmacion) return;
        const { bodega, accion } = confirmacion;

        try {
            if (accion === 'desactivar') {
                await deactivateWarehouse(bodega.id);
            } else {
                await reactivateWarehouse(bodega.id);
            }
            cargarBodegas();
            // Toast de éxito estandarizado (mismo helper que usan crear/actualizar)
            setToast({ tipo: 'exito', mensaje: getMensajeExito('bodega', accion) });
        } catch (error) {
            console.error(`Error al ${accion} bodega:`, error);
            setToast({ tipo: 'error', mensaje: getMensajeError('bodega', accion) });
        } finally {
            setConfirmacion(null);
        }
    };

    const handleEditar = (bodega) => {
        setBodegaEdit(bodega);
        setShowModal(true);
    };

    const handleNuevo = () => {
        setBodegaEdit(null);
        setShowModal(true);
    };

    const bodegasFiltradas = bodegas.filter(b =>
        b.name.toLowerCase().includes(busqueda.toLowerCase()) ||
        (b.code || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (b.zone || '').toLowerCase().includes(busqueda.toLowerCase())
    );

    const totalPaginas = Math.max(1, Math.ceil(bodegasFiltradas.length / POR_PAGINA));
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const bodegasPagina = bodegasFiltradas.slice(inicio, inicio + POR_PAGINA);

    const irPaginaAnterior = () => setPaginaActual(p => Math.max(1, p - 1));
    const irPaginaSiguiente = () => setPaginaActual(p => Math.min(totalPaginas, p + 1));

    return (
        <div className="p-6">
            {/* Toast de éxito/error — mismo formato visual que el usado en WarehouseModal */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-[70] ${toast.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'
                    }`}>
                    {toast.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {toast.mensaje}
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Bodegas</h1>
                    <p className="text-gray-500 text-sm">Bodegas físicas y su responsable</p>
                </div>
                <button
                    onClick={handleNuevo}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus size={18} />
                    Nueva bodega
                </button>
            </div>

            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-4 w-full max-w-md">
                <Search size={18} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre, código o zona..."
                    className="outline-none w-full text-sm uppercase placeholder:normal-case"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                />
            </div>

            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-[#3B5BDB] text-white">
                        <tr>
                            <th className="text-left px-4 py-3">Código</th>
                            <th className="text-left px-4 py-3">Nombre</th>
                            <th className="text-left px-4 py-3">Zona</th>
                            <th className="text-left px-4 py-3">Responsable</th>
                            <th className="text-left px-4 py-3">Estado</th>
                            <th className="text-left px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8 text-gray-400">
                                    Cargando bodegas...
                                </td>
                            </tr>
                        ) : bodegasPagina.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8 text-gray-400">
                                    No hay bodegas registradas
                                </td>
                            </tr>
                        ) : (
                            bodegasPagina.map((b, i) => (
                                <tr
                                    key={b.id}
                                    onClick={() => setFilaSeleccionada(b.id)}
                                    className={`cursor-pointer transition ${filaSeleccionada === b.id
                                            ? 'bg-blue-50'
                                            : i % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                                        } hover:bg-blue-50/60`}
                                >
                                    <td className="px-4 py-3 font-medium">{b.code}</td>
                                    <td className="px-4 py-3">{b.name}</td>
                                    <td className="px-4 py-3">{b.zone || '—'}</td>
                                    <td className="px-4 py-3">{b.responsible?.name || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {b.status ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                                                       <td className="px-4 py-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                        {b.status ? (
                                            <>
                                                <button onClick={() => handleEditar(b)} className="bg-green-600 hover:bg-green-700 text-white p-1 rounded-lg transition">
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => pedirConfirmacion(b, 'desactivar')} className="bg-red-600 hover:bg-red-700 text-white p-1 rounded-lg transition">
                                                    <Ban size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={() => pedirConfirmacion(b, 'reactivar')} className="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded-lg transition" title="Reactivar">
                                                <RotateCcw size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {!loading && bodegasFiltradas.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                        <span className="text-xs text-gray-500">
                            Mostrando {inicio + 1}–{Math.min(inicio + POR_PAGINA, bodegasFiltradas.length)} de {bodegasFiltradas.length} bodegas
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
                <WarehouseModal
                    warehouse={bodegaEdit}
                    onClose={() => setShowModal(false)}
                    onGuardado={cargarBodegas}
                />
            )}

            {/* Modal de confirmación propio — reemplaza confirm() nativo */}
            {confirmacion && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${confirmacion.accion === 'desactivar' ? 'bg-red-100' : 'bg-green-100'
                                }`}>
                                <AlertTriangle
                                    size={20}
                                    className={confirmacion.accion === 'desactivar' ? 'text-red-600' : 'text-green-600'}
                                />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">
                                    {confirmacion.accion === 'desactivar' ? 'Desactivar bodega' : 'Reactivar bodega'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    ¿Estás seguro de {confirmacion.accion} <strong>{confirmacion.bodega.name}</strong>?
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
                                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg ${confirmacion.accion === 'desactivar'
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