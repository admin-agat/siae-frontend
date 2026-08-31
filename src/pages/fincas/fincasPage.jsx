// Página principal del módulo Fincas
import { useState, useEffect } from 'react';
import { getFarms, deleteFarm } from '../../api/farms';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import FarmModal from '../../components/FarmModal';

const POR_PAGINA = 10;

export default function FincasPage() {
    const [fincas, setFincas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [fincaEdit, setFincaEdit] = useState(null);
    const [paginaActual, setPaginaActual] = useState(1);

    useEffect(() => {
        cargarFincas();
    }, []);

    useEffect(() => {
        setPaginaActual(1);
    }, [busqueda]);

    const cargarFincas = async () => {
        try {
            setLoading(true);
            const res = await getFarms();
            setFincas(res.data);
        } catch (error) {
            console.error('Error cargando fincas:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEliminar = async (id) => {
        if (!confirm('¿Estás seguro de desactivar esta finca?')) return;
        try {
            await deleteFarm(id);
            cargarFincas();
        } catch (error) {
            console.error('Error eliminando finca:', error);
        }
    };

    const handleEditar = (finca) => {
        setFincaEdit(finca);
        setShowModal(true);
    };

    const handleNuevo = () => {
        setFincaEdit(null);
        setShowModal(true);
    };

    const fincasFiltradas = fincas.filter(f =>
        f.name.toLowerCase().includes(busqueda.toLowerCase()) ||
        (f.magap_code || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (f.third_party?.name || '').toLowerCase().includes(busqueda.toLowerCase())
    );

    const totalPaginas = Math.max(1, Math.ceil(fincasFiltradas.length / POR_PAGINA));
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const fincasPagina = fincasFiltradas.slice(inicio, inicio + POR_PAGINA);

    const irPaginaAnterior = () => setPaginaActual(p => Math.max(1, p - 1));
    const irPaginaSiguiente = () => setPaginaActual(p => Math.min(totalPaginas, p + 1));

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Fincas</h1>
                    <p className="text-gray-500 text-sm">Fincas registradas por productor</p>
                </div>
                <button
                    onClick={handleNuevo}
                    className="flex items-center gap-2 bg-[#0F6E56] text-white px-4 py-2 rounded-lg hover:bg-[#0a5a45] transition"
                >
                    <Plus size={18} />
                    Nueva finca
                </button>
            </div>

            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-4 w-full max-w-md">
                <Search size={18} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por finca, código MAGAP o productor..."
                    className="outline-none w-full text-sm uppercase placeholder:normal-case"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                />
            </div>

            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-[#0F6E56] text-white">
                        <tr>
                            <th className="text-left px-4 py-3">Finca</th>
                            <th className="text-left px-4 py-3">Productor</th>
                            <th className="text-left px-4 py-3">Código MAGAP</th>
                            <th className="text-left px-4 py-3">Zona</th>
                            <th className="text-left px-4 py-3">Estado</th>
                            <th className="text-left px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8 text-gray-400">
                                    Cargando fincas...
                                </td>
                            </tr>
                        ) : fincasPagina.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8 text-gray-400">
                                    No hay fincas registradas
                                </td>
                            </tr>
                        ) : (
                            fincasPagina.map((f, i) => (
                                <tr key={f.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-4 py-3 font-medium">{f.name}</td>
                                    <td className="px-4 py-3">{f.third_party?.name || '—'}</td>
                                    <td className="px-4 py-3">{f.magap_code || '—'}</td>
                                    <td className="px-4 py-3">{f.zone || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            f.status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {f.status ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button onClick={() => handleEditar(f)} className="text-blue-500 hover:text-blue-700">
                                            <Pencil size={16} />
                                        </button>
                                        <button onClick={() => handleEliminar(f.id)} className="text-red-500 hover:text-red-700">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {!loading && fincasFiltradas.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                        <span className="text-xs text-gray-500">
                            Mostrando {inicio + 1}–{Math.min(inicio + POR_PAGINA, fincasFiltradas.length)} de {fincasFiltradas.length} fincas
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
                <FarmModal
                    farm={fincaEdit}
                    onClose={() => setShowModal(false)}
                    onGuardado={cargarFincas}
                />
            )}
        </div>
    );
}