// Página principal del módulo Grupos de Insumo
import { useState, useEffect } from 'react';
import { getGruposInsumo, deleteGrupoInsumo } from '../../api/gruposInsumo';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import GrupoInsumoModal from '../../components/GrupoInsumoModal';

export default function GruposInsumoPage() {
    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [grupoEdit, setGrupoEdit] = useState(null);

    // Cargar grupos al montar el componente
    useEffect(() => {
        cargarGrupos();
    }, []);

    const cargarGrupos = async () => {
        try {
            setLoading(true);
            const res = await getGruposInsumo();
            setGrupos(res.data);
        } catch (error) {
            console.error('Error cargando grupos de insumo:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEliminar = async (id) => {
        if (!confirm('¿Estás seguro de cambiar de estado el grupo de insumo?')) return;
        try {
            await deleteGrupoInsumo(id);
            cargarGrupos(); // Recargar lista
        } catch (error) {
            console.error('Error eliminando grupo de insumo:', error);
        }
    };

    const handleEditar = (grupo) => {
        setGrupoEdit(grupo);
        setShowModal(true);
    };

    const handleNuevo = () => {
        setGrupoEdit(null);
        setShowModal(true);
    };

    // Filtrar por búsqueda
    const gruposFiltrados = grupos.filter(g =>
        g.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <div className="p-6">
            {/* Encabezado */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Grupos de Insumo</h1>
                    <p className="text-gray-500 text-sm">Catálogo de grupos para clasificación de insumos</p>
                </div>
                <button
                    onClick={handleNuevo}
                    className="flex items-center gap-2 bg-[#0F6E56] text-white px-4 py-2 rounded-lg hover:bg-[#0a5a45] transition"
                >
                    <Plus size={18} />
                    Nuevo grupo
                </button>
            </div>

            {/* Buscador */}
            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-4 w-full max-w-md">
                <Search size={18} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre..."
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
                            <th className="text-left px-4 py-3">Nombre</th>
                            <th className="text-left px-4 py-3">Estado</th>
                            <th className="text-left px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="3" className="text-center py-8 text-gray-400">
                                    Cargando grupos de insumo...
                                </td>
                            </tr>
                        ) : gruposFiltrados.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="text-center py-8 text-gray-400">
                                    No hay grupos de insumo registrados
                                </td>
                            </tr>
                        ) : (
                            gruposFiltrados.map((g, i) => (
                                <tr key={g.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-4 py-3 font-medium">{g.nombre}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            g.activo
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {g.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button
                                            onClick={() => handleEditar(g)}
                                            className="text-blue-500 hover:text-blue-700"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleEliminar(g.id)}
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
                <GrupoInsumoModal
                    grupoInsumo={grupoEdit}
                    onClose={() => setShowModal(false)}
                    onGuardado={cargarGrupos}
                />
            )}
        </div>
    );
}