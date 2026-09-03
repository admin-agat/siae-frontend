// Página principal del módulo Terceros
import { useState, useEffect } from 'react';
import { getThirdParties, deleteThirdParty } from '../../api/thirdParties';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import ThirdPartyModal from '../../components/ThirdPartyModal';

const TIPO_LABEL = {
    producer: 'Productor',
    supplier: 'Proveedor',
    customer: 'Cliente',
};

const POR_PAGINA = 10;

export default function TercerosPage() {
    const [terceros, setTerceros] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [terceroEdit, setTerceroEdit] = useState(null);
    const [paginaActual, setPaginaActual] = useState(1);

    useEffect(() => {
        cargarTerceros();
    }, []);

    // Cada vez que cambia la búsqueda, volvemos a la página 1
    useEffect(() => {
        setPaginaActual(1);
    }, [busqueda]);

    const cargarTerceros = async () => {
        try {
            setLoading(true);
            const res = await getThirdParties();
            setTerceros(res.data);
        } catch (error) {
            console.error('Error cargando terceros:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEliminar = async (id) => {
        if (!confirm('¿Estás seguro de desactivar este tercero?')) return;
        try {
            await deleteThirdParty(id);
            cargarTerceros();
        } catch (error) {
            console.error('Error eliminando tercero:', error);
        }
    };

    const handleEditar = (tercero) => {
        setTerceroEdit(tercero);
        setShowModal(true);
    };

    const handleNuevo = () => {
        setTerceroEdit(null);
        setShowModal(true);
    };

    const tercerosFiltrados = terceros.filter(t =>
        t.name.toLowerCase().includes(busqueda.toLowerCase()) ||
        (t.identification || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (t.zone || '').toLowerCase().includes(busqueda.toLowerCase())
    );

    // Cálculo de paginación
    const totalPaginas = Math.max(1, Math.ceil(tercerosFiltrados.length / POR_PAGINA));
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const tercerosPagina = tercerosFiltrados.slice(inicio, inicio + POR_PAGINA);

    const irPaginaAnterior = () => setPaginaActual(p => Math.max(1, p - 1));
    const irPaginaSiguiente = () => setPaginaActual(p => Math.min(totalPaginas, p + 1));

    return (
        <div className="p-6">
            {/* Encabezado */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Terceros</h1>
                    <p className="text-gray-500 text-sm">Productores, comercializadoras y clientes</p>
                </div>
                <button
                    onClick={handleNuevo}
                    className="flex items-center gap-2 bg-[#3B5BDB] text-white px-4 py-2 rounded-lg hover:bg-[#2F49B8] transition"
                >
                    <Plus size={18} />
                    Nuevo tercero
                </button>
            </div>

            {/* Buscador */}
            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-4 w-full max-w-md">
                <Search size={18} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre, RUC o zona..."
                    className="outline-none w-full text-sm"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-[#3B5BDB] text-white">
                        <tr>
                            <th className="text-left px-4 py-3">Nombre</th>
                            <th className="text-left px-4 py-3">Tipo</th>
                            <th className="text-left px-4 py-3">RUC / ID</th>
                            <th className="text-left px-4 py-3">Zona</th>
                            <th className="text-left px-4 py-3">Estado</th>
                            <th className="text-left px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8 text-gray-400">
                                    Cargando terceros...
                                </td>
                            </tr>
                        ) : tercerosPagina.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8 text-gray-400">
                                    No hay terceros registrados
                                </td>
                            </tr>
                        ) : (
                            tercerosPagina.map((t, i) => (
                                <tr key={t.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-4 py-3 font-medium">{t.name}</td>
                                    <td className="px-4 py-3">{TIPO_LABEL[t.type] || t.type}</td>
                                    <td className="px-4 py-3">{t.identification || '—'}</td>
                                    <td className="px-4 py-3">{t.zone || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            t.status
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {t.status ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button
                                            onClick={() => handleEditar(t)}
                                            className="text-blue-500 hover:text-blue-700"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleEliminar(t.id)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Controles de paginación */}
                {!loading && tercerosFiltrados.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                        <span className="text-xs text-gray-500">
                            Mostrando {inicio + 1}–{Math.min(inicio + POR_PAGINA, tercerosFiltrados.length)} de {tercerosFiltrados.length} terceros
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

            {/* Modal */}
            {showModal && (
                <ThirdPartyModal
                    thirdParty={terceroEdit}
                    onClose={() => setShowModal(false)}
                    onGuardado={cargarTerceros}
                />
            )}
        </div>
    );
}
