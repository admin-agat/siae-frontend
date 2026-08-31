// SuppliesMasterDetailPage.jsx
// Vista maestro-detalle: categorías de insumo a la izquierda, insumos de la
// categoría seleccionada a la derecha. Reemplaza la navegación entre
// SupplyCategoriesPage y SuppliesPage por una sola pantalla.
import { useState, useEffect } from 'react';
import { Plus, Pencil, Ban, Search, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSupplyCategories, deactivateSupplyCategory, reactivateSupplyCategory } from '../../api/supplyCategories';
import { getSupplies, deactivateSupply, reactivateSupply } from '../../api/supplies';
import SupplyCategoryModal from '../../components/SupplyCategoryModal';
import SupplyModal from '../../components/SupplyModal';

// Cantidad de filas por página, tanto en Categorías como en Insumos.
const POR_PAGINA = 9;

export default function SuppliesMasterDetailPage() {
    // Categorías (columna izquierda)
    const [categorias, setCategorias] = useState([]);
    const [loadingCategorias, setLoadingCategorias] = useState(true);
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
    const [busquedaCategoria, setBusquedaCategoria] = useState('');
    const [filtroEstadoCategoria, setFiltroEstadoCategoria] = useState('ACTIVOS'); // ACTIVOS | INACTIVOS | TODOS
    const [paginaCategoria, setPaginaCategoria] = useState(1);
    const [showCategoriaModal, setShowCategoriaModal] = useState(false);
    const [categoriaEdit, setCategoriaEdit] = useState(null);

    // Insumos (columna derecha, filtrados por la categoría seleccionada)
    const [insumos, setInsumos] = useState([]);
    const [loadingInsumos, setLoadingInsumos] = useState(true);
    const [busquedaInsumo, setBusquedaInsumo] = useState('');
    const [filtroEstadoInsumo, setFiltroEstadoInsumo] = useState('ACTIVOS'); // ACTIVOS | INACTIVOS | TODOS
    const [paginaInsumo, setPaginaInsumo] = useState(1);
    const [showInsumoModal, setShowInsumoModal] = useState(false);
    const [insumoEdit, setInsumoEdit] = useState(null);

    useEffect(() => {
        cargarCategorias();
        cargarInsumos();
    }, []);

    // Cada vez que cambia la búsqueda, el filtro de estado, o la categoría
    // seleccionada, volvemos a la página 1 (si no, podés quedar "varado" en
    // una página que ya no existe para el nuevo resultado filtrado).
    useEffect(() => {
        setPaginaCategoria(1);
    }, [busquedaCategoria, filtroEstadoCategoria]);

    useEffect(() => {
        setPaginaInsumo(1);
    }, [busquedaInsumo, filtroEstadoInsumo, categoriaSeleccionada]);

    const cargarCategorias = async () => {
        try {
            setLoadingCategorias(true);
            const res = await getSupplyCategories();
            setCategorias(res.data);
            // Si todavía no hay categoría seleccionada, seleccionamos la
            // primera activa por defecto para que la derecha no quede vacía.
            setCategoriaSeleccionada(prev => {
                if (prev) return prev;
                const primeraActiva = res.data.find(c => c.status);
                return primeraActiva || res.data[0] || null;
            });
        } catch (error) {
            console.error('Error cargando categorías de insumo:', error);
        } finally {
            setLoadingCategorias(false);
        }
    };

    // Traemos TODOS los insumos una sola vez y filtramos por categoría en el
    // frontend (catálogo chico y casi estático, no hace falta pedirlo al
    // backend cada vez que cambiás de categoría).
    const cargarInsumos = async () => {
        try {
            setLoadingInsumos(true);
            const res = await getSupplies();
            setInsumos(res.data);
        } catch (error) {
            console.error('Error cargando insumos:', error);
        } finally {
            setLoadingInsumos(false);
        }
    };

    // --- Acciones de Categoría ---

    const handleDesactivarCategoria = async (id) => {
        if (!confirm('¿Estás seguro de desactivar esta categoría?')) return;
        try {
            await deactivateSupplyCategory(id);
            cargarCategorias();
        } catch (error) {
            console.error('Error desactivando categoría:', error);
        }
    };

    const handleReactivarCategoria = async (id) => {
        if (!confirm('¿Deseas reactivar esta categoría de insumo?')) return;
        try {
            await reactivateSupplyCategory(id);
            cargarCategorias();
        } catch (error) {
            console.error('Error reactivando categoría:', error);
        }
    };

    // --- Acciones de Insumo ---

    const handleDesactivarInsumo = async (id) => {
        if (!confirm('¿Estás seguro de desactivar este insumo?')) return;
        try {
            await deactivateSupply(id);
            cargarInsumos();
        } catch (error) {
            console.error('Error desactivando insumo:', error);
        }
    };

    const handleReactivarInsumo = async (id) => {
        if (!confirm('¿Deseas reactivar este insumo?')) return;
        try {
            await reactivateSupply(id);
            cargarInsumos();
        } catch (error) {
            console.error('Error reactivando insumo:', error);
        }
    };

    const handleNuevoInsumo = () => {
        // Pre-cargamos la categoría seleccionada en el modal de insumo,
        // para que el usuario no tenga que volver a elegirla.
        setInsumoEdit(
            categoriaSeleccionada
                ? { supply_category_id: categoriaSeleccionada.id }
                : null
        );
        setShowInsumoModal(true);
    };

    // --- Filtros de Categoría (búsqueda + estado) ---

    const categoriasFiltradas = categorias
        .filter(c => c.name.toLowerCase().includes(busquedaCategoria.toLowerCase()))
        .filter(c => {
            if (filtroEstadoCategoria === 'ACTIVOS') return c.status;
            if (filtroEstadoCategoria === 'INACTIVOS') return !c.status;
            return true; // TODOS
        });

    const totalPaginasCategoria = Math.max(1, Math.ceil(categoriasFiltradas.length / POR_PAGINA));
    const categoriasPagina = categoriasFiltradas.slice(
        (paginaCategoria - 1) * POR_PAGINA,
        paginaCategoria * POR_PAGINA
    );

    // --- Filtros de Insumo (categoría + búsqueda + estado) ---

    const insumosDeCategoria = insumos.filter(i =>
        categoriaSeleccionada && i.supply_category_id === categoriaSeleccionada.id
    );

    const insumosFiltrados = insumosDeCategoria
        .filter(i => `${i.name} ${i.code}`.toLowerCase().includes(busquedaInsumo.toLowerCase()))
        .filter(i => {
            if (filtroEstadoInsumo === 'ACTIVOS') return i.status;
            if (filtroEstadoInsumo === 'INACTIVOS') return !i.status;
            return true; // TODOS
        });

    const totalPaginasInsumo = Math.max(1, Math.ceil(insumosFiltrados.length / POR_PAGINA));
    const insumosPagina = insumosFiltrados.slice(
        (paginaInsumo - 1) * POR_PAGINA,
        paginaInsumo * POR_PAGINA
    );

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Insumos por Categoría</h1>
                <p className="text-gray-500 text-sm">Seleccioná una categoría para ver y gestionar sus insumos</p>
            </div>

                       <div className="grid grid-cols-3 gap-6">

                {/* Columna izquierda: Categorías — tarjeta en tono slate,
                    para que se lea como el panel de NAVEGACIÓN, no el de trabajo */}
                <div className="col-span-1 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 bg-slate-400 rounded-full" />
                            <h2 className="font-semibold text-slate-700">Categorías</h2>
                        </div>
                        <button
                            onClick={() => { setCategoriaEdit(null); setShowCategoriaModal(true); }}
                            className="flex items-center gap-1 text-sm font-semibold text-[#0F6E56] hover:text-[#0a5a45]"
                        >
                            <Plus size={16} />
                            Nueva
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 mb-3">
                        <Search size={16} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar categoría..."
                            className="outline-none w-full text-sm uppercase placeholder:normal-case"
                            value={busquedaCategoria}
                            onChange={(e) => setBusquedaCategoria(e.target.value.toUpperCase())}
                        />
                    </div>

                    {/* Filtro de estado: Activos / Inactivos / Todos */}
                    <div className="flex gap-1 mb-3 bg-slate-200/60 rounded-lg p-1">
                        {['ACTIVOS', 'INACTIVOS', 'TODOS'].map((opcion) => (
                            <button
                                key={opcion}
                                onClick={() => setFiltroEstadoCategoria(opcion)}
                                className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${
                                    filtroEstadoCategoria === opcion
                                        ? 'bg-white text-slate-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {opcion === 'ACTIVOS' ? 'Activos' : opcion === 'INACTIVOS' ? 'Inactivos' : 'Todos'}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        {loadingCategorias ? (
                            <p className="text-center py-6 text-gray-400 text-sm">Cargando...</p>
                        ) : categoriasPagina.length === 0 ? (
                            <p className="text-center py-6 text-gray-400 text-sm">Sin categorías</p>
                        ) : (
                            categoriasPagina.map((c) => (
                                <div
                                    key={c.id}
                                    onClick={() => setCategoriaSeleccionada(c)}
                                    className={`flex items-center justify-between px-4 py-3 border-b last:border-0 cursor-pointer transition ${
                                        categoriaSeleccionada?.id === c.id
                                            ? 'bg-green-50 border-l-4 border-l-[#0F6E56]'
                                            : 'hover:bg-slate-50'
                                    }`}
                                >
                                    <div>
                                        <p className="font-medium text-sm text-gray-800">{c.name}</p>
                                        <p className="text-xs text-gray-500">{c.group_label}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                            c.status ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {c.status ? 'Activo' : 'Inactivo'}
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setCategoriaEdit(c); setShowCategoriaModal(true); }}
                                            className="text-blue-500 hover:text-blue-700"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        {c.status ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDesactivarCategoria(c.id); }}
                                                className="text-gray-400 hover:text-red-600"
                                                title="Desactivar categoría"
                                            >
                                                <Ban size={14} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleReactivarCategoria(c.id); }}
                                                className="text-green-600 hover:text-green-800"
                                                title="Reactivar categoría"
                                            >
                                                <RotateCcw size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Paginación de Categorías */}
                    {!loadingCategorias && categoriasFiltradas.length > POR_PAGINA && (
                        <div className="flex items-center justify-between mt-3 text-sm">
                            <button
                                onClick={() => setPaginaCategoria(p => Math.max(1, p - 1))}
                                disabled={paginaCategoria === 1}
                                className="flex items-center gap-1 text-slate-600 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-600"
                            >
                                <ChevronLeft size={16} />
                                Anterior
                            </button>
                            <span className="text-slate-500">
                                Página {paginaCategoria} de {totalPaginasCategoria}
                            </span>
                            <button
                                onClick={() => setPaginaCategoria(p => Math.min(totalPaginasCategoria, p + 1))}
                                disabled={paginaCategoria === totalPaginasCategoria}
                                className="flex items-center gap-1 text-slate-600 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-600"
                            >
                                Siguiente
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Columna derecha: Insumos — tarjeta con acento verde
                    institucional, panel de TRABAJO principal */}
                <div className="col-span-2 bg-[#0F6E56]/[0.03] border border-[#0F6E56]/20 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 bg-[#0F6E56] rounded-full" />
                            <h2 className="font-semibold text-gray-800">
                                {categoriaSeleccionada
                                    ? `Insumos de ${categoriaSeleccionada.name}`
                                    : 'Seleccioná una categoría'}
                            </h2>
                        </div>
                        <button
                            onClick={handleNuevoInsumo}
                            disabled={!categoriaSeleccionada}
                            className="flex items-center gap-2 bg-[#0F6E56] text-white px-4 py-2 rounded-lg hover:bg-[#0a5a45] transition disabled:opacity-40"
                        >
                            <Plus size={18} />
                            Nuevo insumo
                        </button>
                    </div>

                    <div className="flex items-center gap-3 mb-3 flex-nowrap">
                        <div className="flex items-center gap-2 bg-white border border-[#0F6E56]/20 rounded-lg px-3 py-2 flex-1 min-w-0">
                            <Search size={16} className="text-gray-400 shrink-0" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o código..."
                                className="outline-none w-full text-sm uppercase placeholder:normal-case"
                                value={busquedaInsumo}
                                onChange={(e) => setBusquedaInsumo(e.target.value.toUpperCase())}
                            />
                        </div>

                        {/* Filtro de estado: Activos / Inactivos / Todos */}
                        <div className="flex gap-1 bg-[#0F6E56]/10 rounded-lg p-1 shrink-0">
                            {['ACTIVOS', 'INACTIVOS', 'TODOS'].map((opcion) => (
                                <button
                                    key={opcion}
                                    onClick={() => setFiltroEstadoInsumo(opcion)}
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                                        filtroEstadoInsumo === opcion
                                            ? 'bg-white text-[#0F6E56] shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {opcion === 'ACTIVOS' ? 'Activos' : opcion === 'INACTIVOS' ? 'Inactivos' : 'Todos'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-[#0F6E56]/15 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-[#0F6E56] text-white">
                                <tr>
                                    <th className="text-left px-4 py-3">Código</th>
                                    <th className="text-left px-4 py-3">Insumo</th>
                                    <th className="text-left px-4 py-3">Unidad</th>
                                    <th className="text-left px-4 py-3">Costo</th>
                                    <th className="text-left px-4 py-3">Estado</th>
                                    <th className="text-left px-4 py-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!categoriaSeleccionada ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-gray-400">
                                            Elegí una categoría de la izquierda
                                        </td>
                                    </tr>
                                ) : loadingInsumos ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-gray-400">
                                            Cargando insumos...
                                        </td>
                                    </tr>
                                ) : insumosPagina.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-gray-400">
                                            Esta categoría no tiene insumos {filtroEstadoInsumo === 'TODOS' ? '' : filtroEstadoInsumo.toLowerCase()} que coincidan
                                        </td>
                                    </tr>
                                ) : (
                                    insumosPagina.map((i, idx) => (
                                        <tr key={i.id} className={idx % 2 === 0 ? 'bg-slate-50/60' : 'bg-white'}>
                                            <td className="px-4 py-3 text-gray-600">{i.code}</td>
                                            <td className="px-4 py-3 font-medium">{i.name}</td>
                                            <td className="px-4 py-3">{i.unit}</td>
                                            <td className="px-4 py-3">${Number(i.cost).toFixed(2)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    i.status ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {i.status ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 flex gap-2">
                                                {i.status ? (
                                                    <>
                                                        <button onClick={() => { setInsumoEdit(i); setShowInsumoModal(true); }} className="text-blue-500 hover:text-blue-700">
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDesactivarInsumo(i.id)}
                                                            className="text-gray-400 hover:text-red-600"
                                                            title="Desactivar insumo"
                                                        >
                                                            <Ban size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleReactivarInsumo(i.id)}
                                                        className="text-green-600 hover:text-green-800"
                                                        title="Reactivar insumo"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Paginación de Insumos */}
                        {categoriaSeleccionada && !loadingInsumos && insumosFiltrados.length > POR_PAGINA && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-[#0F6E56]/10 text-sm">
                                <button
                                    onClick={() => setPaginaInsumo(p => Math.max(1, p - 1))}
                                    disabled={paginaInsumo === 1}
                                    className="flex items-center gap-1 text-gray-600 hover:text-[#0F6E56] disabled:opacity-30 disabled:hover:text-gray-600"
                                >
                                    <ChevronLeft size={16} />
                                    Anterior
                                </button>
                                <span className="text-gray-500">
                                    Página {paginaInsumo} de {totalPaginasInsumo}
                                </span>
                                <button
                                    onClick={() => setPaginaInsumo(p => Math.min(totalPaginasInsumo, p + 1))}
                                    disabled={paginaInsumo === totalPaginasInsumo}
                                    className="flex items-center gap-1 text-gray-600 hover:text-[#0F6E56] disabled:opacity-30 disabled:hover:text-gray-600"
                                >
                                    Siguiente
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showCategoriaModal && (
                <SupplyCategoryModal
                    supplyCategory={categoriaEdit}
                    onClose={() => { setShowCategoriaModal(false); setCategoriaEdit(null); }}
                    onGuardado={cargarCategorias}
                />
            )}

            {showInsumoModal && (
                <SupplyModal
                    supply={insumoEdit}
                    onClose={() => { setShowInsumoModal(false); setInsumoEdit(null); }}
                    onGuardado={cargarInsumos}
                />
            )}
        </div>
    );
}