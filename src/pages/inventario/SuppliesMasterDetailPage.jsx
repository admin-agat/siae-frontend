// SuppliesMasterDetailPage.jsx
// Vista maestro-detalle: categorías de insumo a la izquierda, insumos de la
// categoría seleccionada a la derecha. Reemplaza la navegación entre
// SupplyCategoriesPage y SuppliesPage por una sola pantalla.
import { useState, useEffect } from 'react';
import { Plus, Pencil, Ban, Search, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { getSupplyCategories, deactivateSupplyCategory, reactivateSupplyCategory } from '../../api/supplyCategories';
import { getSupplies, deactivateSupply, reactivateSupply, getSupplyUsage } from '../../api/supplies';
import SupplyCategoryModal from '../../components/SupplyCategoryModal';
import SupplyModal from '../../components/SupplyModal';
// Estándar centralizado de mensajes toast (crear/actualizar/desactivar/reactivar)
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

// Cantidad de filas por página, tanto en Categorías como en Insumos.
const POR_PAGINA = 9;
// 19/11/2026 (Peter): los insumos van de 10 en 10 como el resto de las tablas con formato SAP
const POR_PAGINA_INSUMOS = 10;

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
    // Fila de insumo resaltada al hacer click (mismo patrón visual que WarehousesPage)
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);

    // Modal de confirmación propio, reemplaza el confirm() nativo del navegador
    // (mismo motivo que en WarehousesPage: Chrome lo bloquea tras varios usos
    // seguidos y el botón parece no hacer nada).
    // confirmacion = null (cerrado) o { tipo: 'categoria'|'insumo', item, accion: 'desactivar'|'reactivar' }
    const [confirmacion, setConfirmacion] = useState(null);

    // Toast de éxito/error, mismo formato visual y mismo helper que en Bodegas
    // toast = null (oculto) o { tipo: 'exito'|'error', mensaje: string }
    const [toast, setToast] = useState(null);

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

    // Oculta el toast automáticamente después de un momento
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2500);
        return () => clearTimeout(timer);
    }, [toast]);

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

    // --- Confirmación + acciones de Desactivar/Reactivar (unificado para
    // categoría e insumo, igual que el patrón de WarehousesPage) ---

    const pedirConfirmacion = (tipo, item, accion) => {
        setConfirmacion({ tipo, item, accion });
        // 03/11/2026: antes de desactivar un insumo se muestra dónde se usa (recetas, stock, movimientos);
        // si está en una receta activa o tiene stock, no se puede desactivar
        if (tipo === 'insumo' && accion === 'desactivar') {
            setConfirmacion({ tipo, item, accion, cargandoUso: true });
            getSupplyUsage(item.id)
                .then((res) => setConfirmacion((c) => (c?.item.id === item.id ? { ...c, uso: res.data, cargandoUso: false } : c)))
                .catch(() => setConfirmacion((c) => (c?.item.id === item.id ? { ...c, cargandoUso: false } : c)));
        }
    };

    const ejecutarConfirmacion = async () => {
        if (!confirmacion) return;
        const { tipo, item, accion } = confirmacion;

        try {
            if (tipo === 'categoria') {
                accion === 'desactivar'
                    ? await deactivateSupplyCategory(item.id)
                    : await reactivateSupplyCategory(item.id);
                cargarCategorias();
            } else {
                accion === 'desactivar'
                    ? await deactivateSupply(item.id)
                    : await reactivateSupply(item.id);
                cargarInsumos();
            }
            setToast({ tipo: 'exito', mensaje: getMensajeExito(tipo, accion) });
        } catch (error) {
            console.error(`Error al ${accion} ${tipo}:`, error);
            setToast({ tipo: 'error', mensaje: error.response?.data?.message || getMensajeError(tipo, accion) });
        } finally {
            setConfirmacion(null);
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

    const totalPaginasInsumo = Math.max(1, Math.ceil(insumosFiltrados.length / POR_PAGINA_INSUMOS));
    const insumosPagina = insumosFiltrados.slice(
        (paginaInsumo - 1) * POR_PAGINA_INSUMOS,
        paginaInsumo * POR_PAGINA_INSUMOS
    );

    return (
        <div className="p-6">
            {/* Toast de éxito/error — mismo formato visual y helper que WarehousesPage */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-[70] ${
                    toast.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'
                }`}>
                    {toast.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {toast.mensaje}
                </div>
            )}

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Insumos por Categoría</h1>
                <p className="text-gray-500 text-sm">Selecciona una categoría para ver y gestionar sus insumos</p>
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
                            className="flex items-center gap-2 bg-primario text-white px-4 py-2 rounded-lg hover:bg-primario-hover transition disabled:opacity-40"
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
                    <div className="flex gap-1 mb-3 bg-white border rounded-lg p-1">
                        {['ACTIVOS', 'INACTIVOS', 'TODOS'].map((opcion) => (
                            <button
                                key={opcion}
                                onClick={() => setFiltroEstadoCategoria(opcion)}
                                className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${
                                    filtroEstadoCategoria === opcion
                                        ? 'bg-primario text-white'
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                {opcion}
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
                                            ? 'bg-primario-claro border-l-4 border-l-primario'
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
                                        {/* 18/11/2026 (Peter): botones de acciones con el estándar de color (p-1.5, Reactivar azul primario sólido) */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setCategoriaEdit(c); setShowCategoriaModal(true); }}
                                            title="Editar"
                                            aria-label="Editar"
                                            className="bg-green-600 hover:bg-green-700 text-white p-1.5 rounded-lg shadow-sm transition">
                                            <Pencil size={16} />
                                        </button>
                                        {c.status ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); pedirConfirmacion('categoria', c, 'desactivar'); }}
                                               title="Desactivar"
                                               aria-label="Desactivar"
                                               className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg shadow-sm transition">
                                            <Ban size={16} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); pedirConfirmacion('categoria', c, 'reactivar'); }}
                                                className="bg-primario hover:bg-primario-hover text-white p-1.5 rounded-lg shadow-sm transition"
                                                title="Reactivar categoría"
                                            >
                                                <RotateCcw size={16} />
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
                <div className="col-span-2 bg-primario/[0.03] border border-primario/20 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 bg-primario rounded-full" />
                            <h2 className="font-semibold text-gray-800">
                                {categoriaSeleccionada
                                    ? `Insumos de ${categoriaSeleccionada.name}`
                                    : 'Selecciona una categoría'}
                            </h2>
                        </div>
                        <button
                            onClick={handleNuevoInsumo}
                            disabled={!categoriaSeleccionada}
                            className="flex items-center gap-2 bg-primario text-white px-4 py-2 rounded-lg hover:bg-primario-hover transition disabled:opacity-40"
                        >
                            <Plus size={18} />
                            Nuevo insumo
                        </button>
                    </div>

                    <div className="flex items-center gap-3 mb-3 flex-nowrap">
                        <div className="flex items-center gap-2 bg-white border border-primario/20 rounded-lg px-3 py-2 flex-1 min-w-0">
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
                        <div className="flex gap-1 bg-white border rounded-lg p-1 shrink-0">
                            {['ACTIVOS', 'INACTIVOS', 'TODOS'].map((opcion) => (
                                <button
                                    key={opcion}
                                    onClick={() => setFiltroEstadoInsumo(opcion)}
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                                        filtroEstadoInsumo === opcion
                                            ? 'bg-primario text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {opcion}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-primario/15 shadow-sm overflow-hidden">
                        {/* 18/11/2026 (Peter): lista compacta como el Pedido semanal: columna #, filas bajas alternadas y fila elegida en verde */}
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-primario text-white">
                                <tr>
                                    <th className="text-center px-2 py-2 text-xs w-10">#</th>
                                    {/* 19/11/2026 (Peter): tabla con formato SAP (#, filas alternadas, paginación): títulos en MAYÚSCULAS */}
                                    <th className="text-left px-3 py-2 uppercase text-xs whitespace-nowrap">Código</th>
                                    <th className="text-left px-3 py-2 uppercase text-xs whitespace-nowrap">Insumo</th>
                                    <th className="text-left px-3 py-2 uppercase text-xs whitespace-nowrap">Unidad</th>
                                    <th className="text-left px-3 py-2 uppercase text-xs whitespace-nowrap">Costo promedio</th>
                                    <th className="text-left px-3 py-2 uppercase text-xs whitespace-nowrap">Estado</th>
                                    <th className="text-left px-3 py-2 uppercase text-xs whitespace-nowrap">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!categoriaSeleccionada ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-8 text-gray-400">
                                            Elige una categoría de la izquierda
                                        </td>
                                    </tr>
                                ) : loadingInsumos ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-8 text-gray-400">
                                            Cargando insumos...
                                        </td>
                                    </tr>
                                ) : insumosPagina.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-8 text-gray-400">
                                            Esta categoría no tiene insumos {filtroEstadoInsumo === 'TODOS' ? '' : filtroEstadoInsumo.toLowerCase()} que coincidan
                                        </td>
                                    </tr>
                                ) : (
                                    insumosPagina.map((i, idx) => (
                                        <tr
                                            key={i.id}
                                            onClick={() => setFilaSeleccionada(i.id)}
                                            className={`cursor-pointer ${filaSeleccionada === i.id ? 'fila-elegida bg-green-600 text-white' : (idx % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-violet-50 hover:bg-yellow-50')}`}
                                        >
                                            <td className="bg-gray-200 border border-gray-300 px-1 py-1.5 text-center text-sm font-bold text-gray-700">{(paginaInsumo - 1) * POR_PAGINA_INSUMOS + idx + 1}</td>
                                            <td className="px-3 py-1.5 border border-gray-200 text-gray-600">{i.code}</td>
                                            <td className="px-3 py-1.5 border border-gray-200 font-medium">{i.name}</td>
                                            <td className="px-3 py-1.5 border border-gray-200">{i.unit}</td>
                                            <td className="px-3 py-1.5 border border-gray-200" title={i.last_purchase_cost != null ? `Última compra: $${Number(i.last_purchase_cost)}` : "Sin compras: costo de referencia"}>${Number(i.cost).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                            <td className="px-3 py-1.5 border border-gray-200">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    i.status ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {i.status ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-1 border border-gray-200" onClick={(e) => e.stopPropagation()}>
                                                {/* 18/11/2026 (Peter): botones de acciones con el estándar de color (p-1.5, Reactivar azul primario sólido) */}
                                                <div className="flex gap-2">
                                                {i.status ? (
                                                    <>
                                                        <button onClick={() => { setInsumoEdit(i); setShowInsumoModal(true); }} className="bg-green-600 hover:bg-green-700 text-white p-1.5 rounded-lg shadow-sm transition" title="Editar" aria-label="Editar">
                                            <Pencil size={16} />

                                                        </button>
                                                        <button
                                                            onClick={() => pedirConfirmacion('insumo', i, 'desactivar')}
                                                            title="Desactivar"
                                                            aria-label="Desactivar"
                                                            className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg shadow-sm transition">
                                            <Ban size={16} />

                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => pedirConfirmacion('insumo', i, 'reactivar')}
                                                        className="bg-primario hover:bg-primario-hover text-white p-1.5 rounded-lg shadow-sm transition"
                                                        title="Reactivar insumo"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* 19/11/2026 (Peter): pie con formato SAP, siempre visible si hay registros */}
                        {categoriaSeleccionada && !loadingInsumos && insumosFiltrados.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                                <span className="text-xs text-gray-500">
                                    Mostrando {(paginaInsumo - 1) * POR_PAGINA_INSUMOS + 1}–{Math.min(paginaInsumo * POR_PAGINA_INSUMOS, insumosFiltrados.length)} de {insumosFiltrados.length} insumos
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPaginaInsumo(p => Math.max(1, p - 1))}
                                        disabled={paginaInsumo === 1}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                                    >
                                        <ChevronLeft size={16} />
                                        Anterior
                                    </button>
                                    <span className="text-sm text-gray-600 px-2">
                                        Página {paginaInsumo} de {totalPaginasInsumo}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setPaginaInsumo(p => Math.min(totalPaginasInsumo, p + 1))}
                                        disabled={paginaInsumo === totalPaginasInsumo}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                                    >
                                        Siguiente
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
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

            {/* Modal de confirmación propio — reemplaza confirm() nativo,
                sirve tanto para categorías como para insumos */}
            {confirmacion && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                confirmacion.accion === 'desactivar' ? 'bg-red-100' : 'bg-green-100'
                            }`}>
                                <AlertTriangle
                                    size={20}
                                    className={confirmacion.accion === 'desactivar' ? 'text-red-600' : 'text-green-600'}
                                />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">
                                    {confirmacion.accion === 'desactivar'
                                        ? `Desactivar ${confirmacion.tipo === 'categoria' ? 'categoría' : 'insumo'}`
                                        : `Reactivar ${confirmacion.tipo === 'categoria' ? 'categoría' : 'insumo'}`}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    ¿Estás seguro de {confirmacion.accion} <strong>{confirmacion.item.name}</strong>?
                                </p>
                                {confirmacion.cargandoUso && <p className="text-xs text-gray-400 mt-2">Revisando dónde se usa...</p>}
                                {confirmacion.uso && (
                                    <div className="text-xs mt-3 space-y-1">
                                        <p className="text-gray-600">
                                            Recetas: <strong>{confirmacion.uso.recetas.length ? confirmacion.uso.recetas.join(', ') : 'ninguna'}</strong>
                                        </p>
                                        <p className="text-gray-600">
                                            Stock: <strong>{confirmacion.uso.stock.length ? confirmacion.uso.stock.map((s) => `${s.bodega} ${Number(s.cantidad)}`).join(', ') : 'sin stock'}</strong>
                                        </p>
                                        <p className="text-gray-600">Movimientos registrados: <strong>{confirmacion.uso.movimientos}</strong></p>
                                        {confirmacion.uso.bloqueo ? (
                                            <p className="text-red-600 font-semibold pt-1">No se puede desactivar. {confirmacion.uso.bloqueo}</p>
                                        ) : confirmacion.uso.movimientos > 0 && (
                                            <p className="text-amber-700 pt-1">Tiene movimientos: su kárdex y costo promedio se conservan, pero ya no se podrá usar en compras, despachos ni recetas.</p>
                                        )}
                                    </div>
                                )}
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
                                disabled={confirmacion.cargandoUso || Boolean(confirmacion.uso?.bloqueo)}
                                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed ${
                                    confirmacion.accion === 'desactivar'
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