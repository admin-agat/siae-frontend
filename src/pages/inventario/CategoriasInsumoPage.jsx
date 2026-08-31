// Página principal del módulo Categorías de Insumo
import { useState, useEffect } from 'react';
import { getCategoriasInsumo, deleteCategoriaInsumo } from '../../api/categoriasInsumo';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import CategoriaInsumoModal from '../../components/CategoriaInsumoModal';

export default function CategoriasInsumoPage() {
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [categoriaEdit, setCategoriaEdit] = useState(null);

    // Cargar categorías al montar el componente
    useEffect(() => {
        cargarCategorias();
    }, []);

    const cargarCategorias = async () => {
        try {
            setLoading(true);
            const res = await getCategoriasInsumo();
            setCategorias(res.data);
        } catch (error) {
            console.error('Error cargando categorías de insumo:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEliminar = async (id) => {
        if (!confirm('¿Estás seguro de cambiar de estado la categoría de insumo?')) return;
        try {
            await deleteCategoriaInsumo(id);
            cargarCategorias(); // Recargar lista
        } catch (error) {
            console.error('Error eliminando categoría de insumo:', error);
        }
    };

    const handleEditar = (categoria) => {
    setCategoriaEdit(categoria);
    setShowModal(true);
};

    const handleNuevo = () => {
        setCategoriaEdit(null);
        setShowModal(true);
    };

    // Filtrar por búsqueda (nombre de categoría o nombre del grupo)
    const categoriasFiltradas = categorias.filter(c =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (c.grupo?.nombre ?? '').toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <div className="p-6">
            {/* Encabezado */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Categorías de Insumo</h1>
                    <p className="text-gray-500 text-sm">Catálogo de categorías por grupo de insumo</p>
                </div>
                <button
                    onClick={handleNuevo}
                    className="flex items-center gap-2 bg-[#0F6E56] text-white px-4 py-2 rounded-lg hover:bg-[#0a5a45] transition"
                >
                    <Plus size={18} />
                    Nueva categoría
                </button>
            </div>

            {/* Buscador */}
            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-4 w-full max-w-md">
                <Search size={18} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre o grupo..."
                    className="outline-none w-full text-sm"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-[#0F6E56] text-white">
                        <tr>
                            <th className="text-left px-4 py-3">Grupo</th>
                            <th className="text-left px-4 py-3">Categoría</th>
                            <th className="text-left px-4 py-3">Estado</th>
                            <th className="text-left px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="4" className="text-center py-8 text-gray-400">
                                    Cargando categorías de insumo...
                                </td>
                            </tr>
                        ) : categoriasFiltradas.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center py-8 text-gray-400">
                                    No hay categorías de insumo registradas
                                </td>
                            </tr>
                        ) : (
                            categoriasFiltradas.map((c, i) => (
                                <tr key={c.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-4 py-3 text-gray-500">{c.grupo?.nombre ?? '—'}</td>
                                    <td className="px-4 py-3 font-medium">{c.nombre}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            c.activo
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {c.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button
                                            onClick={() => handleEditar(c)}
                                            className="text-blue-500 hover:text-blue-700"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleEliminar(c.id)}
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
            </div>

            {/* Modal */}
            {showModal && (
                <CategoriaInsumoModal
                    categoriaInsumo={categoriaEdit}
                    onClose={() => setShowModal(false)}
                    onGuardado={cargarCategorias}
                />
            )}
        </div>
    );
}