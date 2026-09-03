// SupplyCategoriesPage.jsx
// Página de listado y gestión de Categorías de Insumo (Cartón, Plásticos, Químicos, etc.)
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { getSupplyCategories, deactivateSupplyCategory, reactivateSupplyCategory } from '../../api/supplyCategories';
import SupplyCategoryModal from '../../components/SupplyCategoryModal';

const POR_PAGINA = 10;

export default function SupplyCategoriesPage() {
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [categoriaEdit, setCategoriaEdit] = useState(null);
    const [paginaActual, setPaginaActual] = useState(1);

    useEffect(() => {
        cargarCategorias();
    }, []);

    useEffect(() => {
        setPaginaActual(1);
    }, [busqueda]);

    const cargarCategorias = async () => {
        try {
            setLoading(true);
            const res = await getSupplyCategories();
            setCategorias(res.data);
        } catch (error) {
            console.error('Error cargando categorías de insumo:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDesactivar = async (id) => {
        if (!confirm('¿Estás seguro de desactivar esta categoría?')) return;
        try {
            await deactivateSupplyCategory(id);
            cargarCategorias();
        } catch (error) {
            console.error('Error desactivando categoría:', error);
        }
    };

    const handleReactivar = async (id) => {
        if (!confirm('¿Deseas reactivar esta categoría de insumo?')) return;
        try {
            await reactivateSupplyCategory(id);
            cargarCategorias();
        } catch (error) {
            console.error('Error reactivando categoría:', error);
        }
    };

    const handleEditar = (categoria) => {
        setCategoriaEdit(categoria);
        setShowModal(true);
    };

    const handleNueva = () => {
        setCategoriaEdit(null);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setCategoriaEdit(null);
    };

    const categoriasFiltradas = categorias.filter(c =>
        c.name.toLowerCase().includes(busqueda.toLowerCase())
    );

    const totalPaginas = Math.max(1, Math.ceil(categoriasFiltradas.length / POR_PAGINA));
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const categoriasPagina = categoriasFiltradas.slice(inicio, inicio + POR_PAGINA);

    const irPaginaAnterior = () => setPaginaActual(p => Math.max(1, p - 1));
    const irPaginaSiguiente = () => setPaginaActual(p => Math.min(totalPaginas, p + 1));

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Categorías de Insumo</h1>
                    <p className="text-gray-500 text-sm">Cartón, Plásticos, Químicos...</p>
                </div>
                <button
                    onClick={handleNueva}
                    className="flex items-center gap-2 bg-[#3B5BDB] text-white px-4 py-2 rounded-lg hover:bg-[#2F49B8] transition"
                >
                    <Plus size={18} />
                    Nueva categoría
                </button>
            </div>

            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-4 w-full max-w-md">
                <Search size={18} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    className="outline-none w-full text-sm uppercase placeholder:normal-case"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                />
            </div>

            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-[#3B5BDB] text-white">
                        <tr>
                            <th className="text-left px-4 py-3">Grupo</th>
                            <th className="text-left px-4 py-3">Categoría</th>
                            <th className="text-left px-4 py-3">Cobrable al productor</th>
                            <th className="text-left px-4 py-3">Estado</th>
                            <th className="text-left px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="text-center py-8 text-gray-400">
                                    Cargando categorías...
                                </td>
                            </tr>
                        ) : categoriasPagina.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="text-center py-8 text-gray-400">
                                    No hay categorías registradas
                                </td>
                            </tr>
                        ) : (
                            categoriasPagina.map((c, i) => (
                                <tr key={c.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-4 py-3 text-gray-600">{c.group_label}</td>
                                    <td className="px-4 py-3 font-medium">{c.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            c.chargeable_to_producer
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {c.chargeable_to_producer ? 'Sí' : 'No'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            c.status
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {c.status ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        {c.status ? (
                                            <>
                                                <button onClick={() => handleEditar(c)} className="text-blue-500 hover:text-blue-700">
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => handleDesactivar(c.id)} className="text-red-500 hover:text-red-700">
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={() => handleReactivar(c.id)} className="text-green-600 hover:text-green-800" title="Reactivar">
                                                <RotateCcw size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {!loading && categoriasFiltradas.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                        <span className="text-xs text-gray-500">
                            Mostrando {inicio + 1}–{Math.min(inicio + POR_PAGINA, categoriasFiltradas.length)} de {categoriasFiltradas.length} categorías
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
                <SupplyCategoryModal
                    supplyCategory={categoriaEdit}
                    onClose={handleCloseModal}
                    onGuardado={cargarCategorias}
                />
            )}
        </div>
    );
}
