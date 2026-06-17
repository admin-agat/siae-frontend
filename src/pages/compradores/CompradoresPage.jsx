// Página principal del módulo Compradores
import { useState, useEffect } from 'react';
import { getCompradores, deleteComprador } from '../../api/compradores';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import CompradorModal from '../../components/CompradorModal';

export default function CompradoresPage() {
    const [compradores, setCompradores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [compradorEdit, setCompradorEdit] = useState(null);

    // Cargar compradores al montar el componente
    useEffect(() => {
        cargarCompradores();
    }, []);

    const cargarCompradores = async () => {
        try {
            setLoading(true);
            const res = await getCompradores();
            setCompradores(res.data);
        } catch (error) {
            console.error('Error cargando compradores:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEliminar = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este comprador?')) return;
        try {
            await deleteComprador(id);
            cargarCompradores(); // Recargar lista
        } catch (error) {
            console.error('Error eliminando comprador:', error);
        }
    };

    const handleEditar = (comprador) => {
        setCompradorEdit(comprador);
        setShowModal(true);
    };

    const handleNuevo = () => {
        setCompradorEdit(null);
        setShowModal(true);
    };

    // Filtrar por búsqueda
    const compradoresFiltrados = compradores.filter(c =>
        c.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.pais.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <div className="p-6">
            {/* Encabezado */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Compradores</h1>
                    <p className="text-gray-500 text-sm">Gestión de compradores internacionales</p>
                </div>
                <button
                    onClick={handleNuevo}
                    className="flex items-center gap-2 bg-[#0F6E56] text-white px-4 py-2 rounded-lg hover:bg-[#0a5a45] transition"
                >
                    <Plus size={18} />
                    Nuevo comprador
                </button>
            </div>

            {/* Buscador */}
            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-4 w-full max-w-md">
                <Search size={18} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre o país..."
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
                            <th className="text-left px-4 py-3">Razón Social</th>
                            <th className="text-left px-4 py-3">País</th>
                            <th className="text-left px-4 py-3">Contacto</th>
                            <th className="text-left px-4 py-3">Tipo</th>
                            <th className="text-left px-4 py-3">Moneda</th>
                            <th className="text-left px-4 py-3">Estado</th>
                            <th className="text-left px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="text-center py-8 text-gray-400">
                                    Cargando compradores...
                                </td>
                            </tr>
                        ) : compradoresFiltrados.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="text-center py-8 text-gray-400">
                                    No hay compradores registrados
                                </td>
                            </tr>
                        ) : (
                            compradoresFiltrados.map((c, i) => (
                                <tr key={c.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-4 py-3 font-medium">{c.razon_social}</td>
                                    <td className="px-4 py-3">{c.pais}</td>
                                    <td className="px-4 py-3">{c.contacto_nombre || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            c.tipo === 'contractual'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {c.tipo}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">{c.moneda}</td>
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
                <CompradorModal
                    comprador={compradorEdit}
                    onClose={() => setShowModal(false)}
                    onGuardado={cargarCompradores}
                />
            )}
        </div>
    );
}