// MovementReasonsPage.jsx
// Página de listado y gestión de Motivos de Movimiento (Compra a proveedor, Transferencia, etc.)
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { getMovementReasons, deactivateMovementReason, reactivateMovementReason } from '../../api/movementReasons';
import MovementReasonModal from '../../components/MovementReasonModal';

const POR_PAGINA = 10;

export default function MovementReasonsPage() {
    const [reasons, setReasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [reasonEdit, setReasonEdit] = useState(null);
    const [paginaActual, setPaginaActual] = useState(1);

    useEffect(() => {
        cargarReasons();
    }, []);

    useEffect(() => {
        setPaginaActual(1);
    }, [busqueda]);

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

    const handleDesactivar = async (id) => {
        if (!confirm('¿Estás seguro de desactivar este motivo?')) return;
        try {
            await deactivateMovementReason(id);
            cargarReasons();
        } catch (error) {
            console.error('Error desactivando motivo:', error);
        }
    };

    const handleReactivar = async (id) => {
        if (!confirm('¿Deseas reactivar este motivo de movimiento?')) return;
        try {
            await reactivateMovementReason(id);
            cargarReasons();
        } catch (error) {
            console.error('Error reactivando motivo:', error);
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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Motivos de Movimiento</h1>
                    <p className="text-gray-500 text-sm">Compra a proveedor, Transferencia, Devolución...</p>
                </div>
                <button
                    onClick={handleNuevo}
                    className="flex items-center gap-2 bg-[#0F6E56] text-white px-4 py-2 rounded-lg hover:bg-[#0a5a45] transition"
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
                    <thead className="bg-[#0F6E56] text-white">
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
                                <tr key={r.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
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
                                    <td className="px-4 py-3 flex gap-2">
                                        {r.status ? (
                                            <>
                                                <button onClick={() => handleEditar(r)} className="text-blue-500 hover:text-blue-700">
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => handleDesactivar(r.id)} className="text-red-500 hover:text-red-700">
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={() => handleReactivar(r.id)} className="text-green-600 hover:text-green-800" title="Reactivar">
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
        </div>
    );
}