// Página principal del módulo Unidades de Medida
import { useState, useEffect } from 'react';
import { getUnidadesMedida, deleteUnidadMedida } from '../../api/unidadesMedida';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import UnidadMedidaModal from '../../components/UnidadMedidaModal';

export default function UnidadesMedidaPage() {
    const [unidades, setUnidades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [unidadEdit, setUnidadEdit] = useState(null);

    // Cargar unidades al montar el componente
    useEffect(() => {
        cargarUnidades();
    }, []);

    const cargarUnidades = async () => {
        try {
            setLoading(true);
            const res = await getUnidadesMedida();
            setUnidades(res.data);
        } catch (error) {
            console.error('Error cargando unidades de medida:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEliminar = async (id) => {
        if (!confirm('¿Estás seguro de cambiar de estado la unidad de medida?')) return;
        try {
            await deleteUnidadMedida(id);
            cargarUnidades(); // Recargar lista
        } catch (error) {
            console.error('Error eliminando unidad de medida:', error);
        }
    };

    const handleEditar = (unidad) => {
        setUnidadEdit(unidad);
        setShowModal(true);
    };

    const handleNuevo = () => {
        setUnidadEdit(null);
        setShowModal(true);
    };

    // Filtrar por búsqueda
    const unidadesFiltradas = unidades.filter(u =>
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.codigo.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <div className="p-6">
            {/* Encabezado */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Unidades de Medida</h1>
                    <p className="text-gray-500 text-sm">Catálogo de unidades de medida para insumos</p>
                </div>
                <button
                    onClick={handleNuevo}
                    className="flex items-center gap-2 bg-[#0F6E56] text-white px-4 py-2 rounded-lg hover:bg-[#0a5a45] transition"
                >
                    <Plus size={18} />
                    Nueva unidad
                </button>
            </div>

            {/* Buscador */}
            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-4 w-full max-w-md">
                <Search size={18} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por código o nombre..."
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
                            <th className="text-left px-4 py-3">Código</th>
                            <th className="text-left px-4 py-3">Nombre</th>
                            <th className="text-left px-4 py-3">Estado</th>
                            <th className="text-left px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="4" className="text-center py-8 text-gray-400">
                                    Cargando unidades de medida...
                                </td>
                            </tr>
                        ) : unidadesFiltradas.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center py-8 text-gray-400">
                                    No hay unidades de medida registradas
                                </td>
                            </tr>
                        ) : (
                            unidadesFiltradas.map((u, i) => (
                                <tr key={u.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-4 py-3 font-medium">{u.codigo}</td>
                                    <td className="px-4 py-3">{u.nombre}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            u.activo
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {u.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button
                                            onClick={() => handleEditar(u)}
                                            className="text-blue-500 hover:text-blue-700"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleEliminar(u.id)}
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
                <UnidadMedidaModal
                    unidadMedida={unidadEdit}
                    onClose={() => setShowModal(false)}
                    onGuardado={cargarUnidades}
                />
            )}
        </div>
    );
}