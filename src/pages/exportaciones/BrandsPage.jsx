// BrandsPage.jsx
// Vista maestro-detalle: Marcas a la izquierda (GLOBAL VILLAGE, PALMS BANANAS,
// PALMS CON BANDA, DOÑA ELENA...) y sus Recetas de Materiales (BOM) a la
// derecha, igual que Categorías+Insumos en SuppliesMasterDetailPage.
// Cada marca tiene su receta completa: no hay recetas compartidas.
import { useState, useEffect } from 'react';
import { Plus, Pencil, Ban, Search, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { getBrands, deactivateBrand, reactivateBrand } from '../../api/brands';
import { getMaterialRecipes, deactivateMaterialRecipe, reactivateMaterialRecipe } from '../../api/materialRecipes';
import BrandModal from '../../components/BrandModal';
import MaterialRecipeModal from '../../components/MaterialRecipeModal';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

const POR_PAGINA = 9;

export default function BrandsPage() {
    // --- Marcas (columna izquierda) ---
    const [marcas, setMarcas] = useState([]);
    const [loadingMarcas, setLoadingMarcas] = useState(true);
    const [marcaSeleccionada, setMarcaSeleccionada] = useState(null);
    const [busquedaMarca, setBusquedaMarca] = useState('');
    const [filtroEstadoMarca, setFiltroEstadoMarca] = useState('ACTIVOS');
    const [paginaMarca, setPaginaMarca] = useState(1);
    const [showMarcaModal, setShowMarcaModal] = useState(false);
    const [marcaEdit, setMarcaEdit] = useState(null);

    // --- Recetas (columna derecha, filtradas por la marca seleccionada) ---
    const [recetas, setRecetas] = useState([]);
    const [loadingRecetas, setLoadingRecetas] = useState(true);
    const [busquedaReceta, setBusquedaReceta] = useState('');
    const [filtroEstadoReceta, setFiltroEstadoReceta] = useState('ACTIVOS');
    const [paginaReceta, setPaginaReceta] = useState(1);
    const [showRecetaModal, setShowRecetaModal] = useState(false);
    const [recetaEdit, setRecetaEdit] = useState(null);
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);

    // confirmacion = null o { tipo: 'marca'|'receta', item, accion: 'desactivar'|'reactivar' }
    const [confirmacion, setConfirmacion] = useState(null);
    // toast = null o { tipo: 'exito'|'error', mensaje: string }
    const [toast, setToast] = useState(null);

    useEffect(() => {
        cargarMarcas();
        cargarRecetas();
    }, []);

    useEffect(() => {
        setPaginaMarca(1);
    }, [busquedaMarca, filtroEstadoMarca]);

    useEffect(() => {
        setPaginaReceta(1);
    }, [busquedaReceta, filtroEstadoReceta, marcaSeleccionada]);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2500);
        return () => clearTimeout(timer);
    }, [toast]);

    const cargarMarcas = async () => {
        try {
            setLoadingMarcas(true);
            const res = await getBrands();
            // Protección: la pantalla solo trabaja con arreglos
            const lista = Array.isArray(res?.data) ? res.data : [];
            setMarcas(lista);
            // CAMBIO: si ya había una marca seleccionada, se toma su versión
            // NUEVA de la lista (por id). Antes se conservaba el objeto viejo,
            // y tras editar/desactivar el encabezado y el filtro de recetas
            // seguían usando el nombre/código/estado anteriores.
            setMarcaSeleccionada(prev =>
                (prev && lista.find(m => m.id === prev.id)) ||
                lista.find(m => m.status) ||
                lista[0] ||
                null
            );
        } catch (error) {
            console.error('Error cargando marcas:', error);
            setMarcas([]);
        } finally {
            setLoadingMarcas(false);
        }
    };

    const cargarRecetas = async () => {
        try {
            setLoadingRecetas(true);
            const res = await getMaterialRecipes(); // trae todas, filtramos en frontend
            // Protección: si el backend no devuelve una lista, no se rompe la pantalla
            const lista = Array.isArray(res?.data) ? res.data : [];
            if (!Array.isArray(res?.data)) {
                console.error('RECETAS → el backend no devolvió una lista:', res?.data);
            }
            setRecetas(lista);
        } catch (error) {
            console.error('Error cargando recetas de materiales:', error);
            setRecetas([]);
        } finally {
            setLoadingRecetas(false);
        }
    };

    // CAMBIO: al guardar una marca se recargan también las recetas, porque si
    // cambió el code, el backend renombró material_recipes.brand.
    const alGuardarMarca = () => {
        cargarMarcas();
        cargarRecetas();
    };

    const pedirConfirmacion = (tipo, item, accion) => {
        setConfirmacion({ tipo, item, accion });
    };

    const ejecutarConfirmacion = async () => {
        if (!confirmacion) return;
        const { tipo, item, accion } = confirmacion;

        try {
            if (tipo === 'marca') {
                accion === 'desactivar' ? await deactivateBrand(item.id) : await reactivateBrand(item.id);
                cargarMarcas();
            } else {
                accion === 'desactivar' ? await deactivateMaterialRecipe(item.id) : await reactivateMaterialRecipe(item.id);
                cargarRecetas();
            }
            setToast({ tipo: 'exito', mensaje: getMensajeExito(tipo, accion) });
        } catch (error) {
            console.error(`Error al ${accion} ${tipo}:`, error);
            setToast({ tipo: 'error', mensaje: getMensajeError(tipo, accion) });
        } finally {
            setConfirmacion(null);
        }
    };

    // --- Filtros de Marca ---
    const marcasFiltradas = marcas
        .filter(m => `${m.name} ${m.code}`.toLowerCase().includes(busquedaMarca.toLowerCase()))
        .filter(m => {
            if (filtroEstadoMarca === 'ACTIVOS') return m.status;
            if (filtroEstadoMarca === 'INACTIVOS') return !m.status;
            return true;
        });

    const totalPaginasMarca = Math.max(1, Math.ceil(marcasFiltradas.length / POR_PAGINA));
    const marcasPagina = marcasFiltradas.slice((paginaMarca - 1) * POR_PAGINA, paginaMarca * POR_PAGINA);

    // --- Filtros de Receta (marca seleccionada + búsqueda + estado) ---
    // material_recipes.brand guarda el CODE de la marca, no su id
    const recetasDeMarca = recetas.filter(r =>
        marcaSeleccionada && r.brand === marcaSeleccionada.code
    );

    const recetasFiltradas = recetasDeMarca
        .filter(r => (r.supply?.name || '').toLowerCase().includes(busquedaReceta.toLowerCase()))
        .filter(r => {
            if (filtroEstadoReceta === 'ACTIVOS') return r.status;
            if (filtroEstadoReceta === 'INACTIVOS') return !r.status;
            return true;
        });

    const totalPaginasReceta = Math.max(1, Math.ceil(recetasFiltradas.length / POR_PAGINA));
    const recetasPagina = recetasFiltradas.slice((paginaReceta - 1) * POR_PAGINA, paginaReceta * POR_PAGINA);

    // Conteo de recetas activas por marca, para el badge de la izquierda
    const contarRecetas = (codigoMarca) => recetas.filter(r => r.brand === codigoMarca && r.status).length;

    // CAMBIO: no se agregan recetas a una marca inactiva
    const puedeAgregarReceta = Boolean(marcaSeleccionada?.status);

    return (
        <div className="p-6">
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-[70] ${
                    toast.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'
                }`}>
                    {toast.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {toast.mensaje}
                </div>
            )}

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Marcas y Recetas de Materiales</h1>
                {/* CAMBIO: tuteo en lugar de voseo */}
                <p className="text-gray-500 text-sm">Selecciona una marca para ver y gestionar su fórmula de despacho (BOM)</p>
            </div>

            <div className="grid grid-cols-3 gap-6">

                {/* Columna izquierda: Marcas */}
                <div className="col-span-1 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 bg-slate-400 rounded-full" />
                            <h2 className="font-semibold text-slate-700">Marcas</h2>
                        </div>
                        <button
                            onClick={() => { setMarcaEdit(null); setShowMarcaModal(true); }}
                            className="flex items-center gap-2 bg-[#3B5BDB] text-white px-4 py-2 rounded-lg hover:bg-[#2F49B8] transition"
                        >
                            <Plus size={16} />
                            Nueva
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 mb-3">
                        <Search size={16} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar marca..."
                            className="outline-none w-full text-sm uppercase placeholder:normal-case"
                            value={busquedaMarca}
                            onChange={(e) => setBusquedaMarca(e.target.value.toUpperCase())}
                        />
                    </div>

                    <div className="flex gap-1 mb-3 bg-slate-200/60 rounded-lg p-1">
                        {['ACTIVOS', 'INACTIVOS', 'TODOS'].map((opcion) => (
                            <button
                                key={opcion}
                                onClick={() => setFiltroEstadoMarca(opcion)}
                                className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${
                                    filtroEstadoMarca === opcion ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {opcion === 'ACTIVOS' ? 'Activos' : opcion === 'INACTIVOS' ? 'Inactivos' : 'Todos'}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        {loadingMarcas ? (
                            <p className="text-center py-6 text-gray-400 text-sm">Cargando...</p>
                        ) : marcasPagina.length === 0 ? (
                            <p className="text-center py-6 text-gray-400 text-sm">Sin marcas</p>
                        ) : (
                            marcasPagina.map((m) => (
                                <div
                                    key={m.id}
                                    onClick={() => setMarcaSeleccionada(m)}
                                    className={`flex items-center justify-between px-4 py-3 border-b last:border-0 cursor-pointer transition ${
                                        marcaSeleccionada?.id === m.id ? 'bg-green-50 border-l-4 border-l-[#3B5BDB]' : 'hover:bg-slate-50'
                                    }`}
                                >
                                    <div>
                                        <p className="font-medium text-sm text-gray-800">{m.name}</p>
                                        <p className="text-xs text-gray-500">{m.code}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                                            {contarRecetas(m.code)}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                            m.status ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {m.status ? 'Activo' : 'Inactivo'}
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setMarcaEdit(m); setShowMarcaModal(true); }}
                                            className="bg-green-600 hover:bg-green-700 text-white p-1 rounded-lg transition">
                                            <Pencil size={14} />
                                        </button>
                                        {m.status ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); pedirConfirmacion('marca', m, 'desactivar'); }}
                                                className="bg-red-600 hover:bg-red-700 text-white p-1 rounded-lg transition">
                                                <Ban size={14} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); pedirConfirmacion('marca', m, 'reactivar'); }}
                                                className="text-green-600 hover:text-green-800"
                                                title="Reactivar marca"
                                            >
                                                <RotateCcw size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {!loadingMarcas && marcasFiltradas.length > POR_PAGINA && (
                        <div className="flex items-center justify-between mt-3 text-sm">
                            <button onClick={() => setPaginaMarca(p => Math.max(1, p - 1))} disabled={paginaMarca === 1}
                                className="flex items-center gap-1 text-slate-600 hover:text-slate-800 disabled:opacity-30">
                                <ChevronLeft size={16} /> Anterior
                            </button>
                            <span className="text-slate-500">Página {paginaMarca} de {totalPaginasMarca}</span>
                            <button onClick={() => setPaginaMarca(p => Math.min(totalPaginasMarca, p + 1))} disabled={paginaMarca === totalPaginasMarca}
                                className="flex items-center gap-1 text-slate-600 hover:text-slate-800 disabled:opacity-30">
                                Siguiente <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Columna derecha: Recetas de la marca seleccionada */}
                <div className="col-span-2 bg-[#3B5BDB]/[0.03] border border-[#3B5BDB]/20 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 bg-[#3B5BDB] rounded-full" />
                            <h2 className="font-semibold text-gray-800">
                                {marcaSeleccionada ? `Recetas de ${marcaSeleccionada.name}` : 'Selecciona una marca'}
                            </h2>
                        </div>
                        <button
                            onClick={() => { setRecetaEdit(null); setShowRecetaModal(true); }}
                            disabled={!puedeAgregarReceta}
                            title={marcaSeleccionada && !marcaSeleccionada.status ? 'Reactiva la marca para agregar recetas' : undefined}
                            className="flex items-center gap-2 bg-[#3B5BDB] text-white px-4 py-2 rounded-lg hover:bg-[#2F49B8] transition disabled:opacity-40"
                        >
                            <Plus size={18} />
                            Nueva receta
                        </button>
                    </div>

                    <div className="flex items-center gap-3 mb-3 flex-nowrap">
                        <div className="flex items-center gap-2 bg-white border border-[#3B5BDB]/20 rounded-lg px-3 py-2 flex-1 min-w-0">
                            <Search size={16} className="text-gray-400 shrink-0" />
                            <input
                                type="text"
                                placeholder="Buscar por insumo..."
                                className="outline-none w-full text-sm uppercase placeholder:normal-case"
                                value={busquedaReceta}
                                onChange={(e) => setBusquedaReceta(e.target.value.toUpperCase())}
                            />
                        </div>
                        <div className="flex gap-1 bg-[#3B5BDB]/10 rounded-lg p-1 shrink-0">
                            {['ACTIVOS', 'INACTIVOS', 'TODOS'].map((opcion) => (
                                <button
                                    key={opcion}
                                    onClick={() => setFiltroEstadoReceta(opcion)}
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                                        filtroEstadoReceta === opcion ? 'bg-white text-[#3B5BDB] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {opcion === 'ACTIVOS' ? 'Activos' : opcion === 'INACTIVOS' ? 'Inactivos' : 'Todos'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-[#3B5BDB]/15 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-[#3B5BDB] text-white">
                                <tr>
                                    <th className="text-left px-4 py-3">Insumo</th>
                                    <th className="text-left px-4 py-3">Categoría</th>
                                    <th className="text-left px-4 py-3">Ratio x caja</th>
                                    <th className="text-left px-4 py-3">Unidad</th>
                                    <th className="text-left px-4 py-3">Estado</th>
                                    <th className="text-left px-4 py-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!marcaSeleccionada ? (
                                    <tr><td colSpan="6" className="text-center py-8 text-gray-400">Elige una marca de la izquierda</td></tr>
                                ) : loadingRecetas ? (
                                    <tr><td colSpan="6" className="text-center py-8 text-gray-400">Cargando recetas...</td></tr>
                                ) : recetasPagina.length === 0 ? (
                                    <tr><td colSpan="6" className="text-center py-8 text-gray-400">Esta marca todavía no tiene recetas {filtroEstadoReceta === 'TODOS' ? '' : filtroEstadoReceta.toLowerCase()} que coincidan</td></tr>
                                ) : (
                                    recetasPagina.map((r, idx) => (
                                        <tr
                                            key={r.id}
                                            onClick={() => setFilaSeleccionada(r.id)}
                                            className={`cursor-pointer transition ${
                                                filaSeleccionada === r.id ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-slate-50/60' : 'bg-white'
                                            } hover:bg-blue-50/60`}
                                        >
                                            <td className="px-4 py-3 font-medium">{r.supply?.name}</td>
                                            <td className="px-4 py-3 text-gray-600">{r.supply?.category?.name || '—'}</td>
                                            <td className="px-4 py-3">{Number(r.ratio_per_box).toFixed(6)}</td>
                                            <td className="px-4 py-3">{r.unit}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    r.status ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {r.status ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                {r.status ? (
                                                    <>
                                                        <button onClick={() => { setRecetaEdit(r); setShowRecetaModal(true); }} className="bg-green-600 hover:bg-green-700 text-white p-1 rounded-lg transition">
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button onClick={() => pedirConfirmacion('receta', r, 'desactivar')} className="bg-red-600 hover:bg-red-700 text-white p-1 rounded-lg transition">
                                                            <Ban size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => pedirConfirmacion('receta', r, 'reactivar')} className="text-green-600 hover:text-green-800" title="Reactivar receta">
                                                        <RotateCcw size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {marcaSeleccionada && !loadingRecetas && recetasFiltradas.length > POR_PAGINA && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-[#3B5BDB]/10 text-sm">
                                <button onClick={() => setPaginaReceta(p => Math.max(1, p - 1))} disabled={paginaReceta === 1}
                                    className="flex items-center gap-1 text-gray-600 hover:text-[#3B5BDB] disabled:opacity-30">
                                    <ChevronLeft size={16} /> Anterior
                                </button>
                                <span className="text-gray-500">Página {paginaReceta} de {totalPaginasReceta}</span>
                                <button onClick={() => setPaginaReceta(p => Math.min(totalPaginasReceta, p + 1))} disabled={paginaReceta === totalPaginasReceta}
                                    className="flex items-center gap-1 text-gray-600 hover:text-[#3B5BDB] disabled:opacity-30">
                                    Siguiente <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showMarcaModal && (
                <BrandModal
                    brand={marcaEdit}
                    onClose={() => { setShowMarcaModal(false); setMarcaEdit(null); }}
                    onGuardado={alGuardarMarca}
                />
            )}

            {showRecetaModal && (
                <MaterialRecipeModal
                    recipe={recetaEdit}
                    marcaFiltro={marcaSeleccionada?.code}
                    onClose={() => { setShowRecetaModal(false); setRecetaEdit(null); }}
                    onGuardado={cargarRecetas}
                />
            )}

            {confirmacion && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                confirmacion.accion === 'desactivar' ? 'bg-red-100' : 'bg-green-100'
                            }`}>
                                <AlertTriangle size={20} className={confirmacion.accion === 'desactivar' ? 'text-red-600' : 'text-green-600'} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">
                                    {confirmacion.accion === 'desactivar'
                                        ? `Desactivar ${confirmacion.tipo === 'marca' ? 'marca' : 'receta'}`
                                        : `Reactivar ${confirmacion.tipo === 'marca' ? 'marca' : 'receta'}`}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    ¿Estás seguro de {confirmacion.accion}{' '}
                                    <strong>{confirmacion.tipo === 'marca' ? confirmacion.item.name : confirmacion.item.supply?.name}</strong>?
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setConfirmacion(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                                Cancelar
                            </button>
                            <button
                                onClick={ejecutarConfirmacion}
                                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg ${
                                    confirmacion.accion === 'desactivar' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
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