// ShippingLinesPage.jsx
// Vista maestro-detalle: navieras a la izquierda, barcos de la naviera
// seleccionada a la derecha. Mismo patrón que SuppliesMasterDetailPage.
import { useState, useEffect } from 'react';
import { Plus, Pencil, Ban, Search, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { getShippingLines, deactivateShippingLine, reactivateShippingLine } from '../../api/shippingLines';
import { getVessels, deactivateVessel, reactivateVessel } from '../../api/vessels';
import ShippingLineModal from '../../components/ShippingLineModal';
import VesselModal from '../../components/VesselModal';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

const POR_PAGINA = 9;

export default function ShippingLinesPage() {
    // Navieras (columna izquierda)
    const [navieras, setNavieras] = useState([]);
    const [loadingNavieras, setLoadingNavieras] = useState(true);
    const [navieraSeleccionada, setNavieraSeleccionada] = useState(null);
    const [busquedaNaviera, setBusquedaNaviera] = useState('');
    const [filtroEstadoNaviera, setFiltroEstadoNaviera] = useState('ACTIVOS');
    const [paginaNaviera, setPaginaNaviera] = useState(1);
    const [showNavieraModal, setShowNavieraModal] = useState(false);
    const [navieraEdit, setNavieraEdit] = useState(null);

    // Barcos (columna derecha, filtrados por la naviera seleccionada)
    const [barcos, setBarcos] = useState([]);
    const [loadingBarcos, setLoadingBarcos] = useState(true);
    const [busquedaBarco, setBusquedaBarco] = useState('');
    const [filtroEstadoBarco, setFiltroEstadoBarco] = useState('ACTIVOS');
    const [paginaBarco, setPaginaBarco] = useState(1);
    const [showBarcoModal, setShowBarcoModal] = useState(false);
    const [barcoEdit, setBarcoEdit] = useState(null);
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);

    // confirmacion = null o { tipo: 'naviera'|'barco', item, accion: 'desactivar'|'reactivar' }
    const [confirmacion, setConfirmacion] = useState(null);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        cargarNavieras();
        cargarBarcos();
    }, []);

    useEffect(() => {
        setPaginaNaviera(1);
    }, [busquedaNaviera, filtroEstadoNaviera]);

    useEffect(() => {
        setPaginaBarco(1);
    }, [busquedaBarco, filtroEstadoBarco, navieraSeleccionada]);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2500);
        return () => clearTimeout(timer);
    }, [toast]);

    const cargarNavieras = async () => {
        try {
            setLoadingNavieras(true);
            const res = await getShippingLines();
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setNavieras(data);
            setNavieraSeleccionada(prev => {
                if (prev) return prev;
                const primeraActiva = data.find(n => n.status);
                return primeraActiva || data[0] || null;
            });
        } catch (error) {
            console.error('Error cargando navieras:', error);
        } finally {
            setLoadingNavieras(false);
        }
    };

    // Traemos TODOS los barcos una sola vez (catálogo chico) y filtramos por
    // naviera en el frontend, igual que hace Insumos con las categorías.
    const cargarBarcos = async () => {
        try {
            setLoadingBarcos(true);
            const res = await getVessels();
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setBarcos(data);
        } catch (error) {
            console.error('Error cargando barcos:', error);
        } finally {
            setLoadingBarcos(false);
        }
    };

    const pedirConfirmacion = (tipo, item, accion) => {
        setConfirmacion({ tipo, item, accion });
    };

    const ejecutarConfirmacion = async () => {
        if (!confirmacion) return;
        const { tipo, item, accion } = confirmacion;

        try {
            if (tipo === 'naviera') {
                accion === 'desactivar'
                    ? await deactivateShippingLine(item.id)
                    : await reactivateShippingLine(item.id);
                cargarNavieras();
            } else {
                accion === 'desactivar'
                    ? await deactivateVessel(item.id)
                    : await reactivateVessel(item.id);
                cargarBarcos();
            }
            setToast({ tipo: 'exito', mensaje: getMensajeExito(tipo, accion) });
        } catch (error) {
            console.error(`Error al ${accion} ${tipo}:`, error);
            setToast({ tipo: 'error', mensaje: getMensajeError(tipo, accion) });
        } finally {
            setConfirmacion(null);
        }
    };

    const handleNuevoBarco = () => {
        setBarcoEdit(null);
        setShowBarcoModal(true);
    };

    // --- Filtros de Naviera ---

    const navierasFiltradas = navieras
        .filter(n => n.name?.toLowerCase().includes(busquedaNaviera.toLowerCase()))
        .filter(n => {
            if (filtroEstadoNaviera === 'ACTIVOS') return n.status;
            if (filtroEstadoNaviera === 'INACTIVOS') return !n.status;
            return true;
        });

    const totalPaginasNaviera = Math.max(1, Math.ceil(navierasFiltradas.length / POR_PAGINA));
    const navierasPagina = navierasFiltradas.slice(
        (paginaNaviera - 1) * POR_PAGINA,
        paginaNaviera * POR_PAGINA
    );

    // --- Filtros de Barco (naviera + búsqueda + estado) ---

    const barcosDeNaviera = barcos.filter(v =>
        navieraSeleccionada && v.shipping_line_id === navieraSeleccionada.id
    );

    const barcosFiltrados = barcosDeNaviera
        .filter(v => v.name?.toLowerCase().includes(busquedaBarco.toLowerCase()))
        .filter(v => {
            if (filtroEstadoBarco === 'ACTIVOS') return v.status;
            if (filtroEstadoBarco === 'INACTIVOS') return !v.status;
            return true;
        });

    const totalPaginasBarco = Math.max(1, Math.ceil(barcosFiltrados.length / POR_PAGINA));
    const barcosPagina = barcosFiltrados.slice(
        (paginaBarco - 1) * POR_PAGINA,
        paginaBarco * POR_PAGINA
    );

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
                <h1 className="text-2xl font-bold text-gray-800">Navieras</h1>
                <p className="text-gray-500 text-sm">Seleccioná una naviera para ver y gestionar sus barcos</p>
            </div>

            <div className="grid grid-cols-3 gap-6">

                {/* Columna izquierda: Navieras */}
                <div className="col-span-1 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 bg-slate-400 rounded-full" />
                            <h2 className="font-semibold text-slate-700">Navieras</h2>
                        </div>
                        <button
                            onClick={() => { setNavieraEdit(null); setShowNavieraModal(true); }}
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
                            placeholder="Buscar naviera..."
                            className="outline-none w-full text-sm uppercase placeholder:normal-case"
                            value={busquedaNaviera}
                            onChange={(e) => setBusquedaNaviera(e.target.value.toUpperCase())}
                        />
                    </div>

                    <div className="flex gap-1 mb-3 bg-slate-200/60 rounded-lg p-1">
                        {['ACTIVOS', 'INACTIVOS', 'TODOS'].map((opcion) => (
                            <button
                                key={opcion}
                                onClick={() => setFiltroEstadoNaviera(opcion)}
                                className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${
                                    filtroEstadoNaviera === opcion
                                        ? 'bg-white text-slate-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {opcion === 'ACTIVOS' ? 'Activos' : opcion === 'INACTIVOS' ? 'Inactivos' : 'Todos'}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        {loadingNavieras ? (
                            <p className="text-center py-6 text-gray-400 text-sm">Cargando...</p>
                        ) : navierasPagina.length === 0 ? (
                            <p className="text-center py-6 text-gray-400 text-sm">Sin navieras</p>
                        ) : (
                            navierasPagina.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => setNavieraSeleccionada(n)}
                                    className={`flex items-center justify-between px-4 py-3 border-b last:border-0 cursor-pointer transition ${
                                        navieraSeleccionada?.id === n.id
                                            ? 'bg-green-50 border-l-4 border-l-[#3B5BDB]'
                                            : 'hover:bg-slate-50'
                                    }`}
                                >
                                    <div>
                                        <p className="font-medium text-sm text-gray-800">{n.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                            n.status ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {n.status ? 'Activo' : 'Inactivo'}
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setNavieraEdit(n); setShowNavieraModal(true); }}
                                            className="bg-green-600 hover:bg-green-700 text-white p-1 rounded-lg transition">
                                            <Pencil size={14} />
                                        </button>
                                        {n.status ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); pedirConfirmacion('naviera', n, 'desactivar'); }}
                                                className="bg-red-600 hover:bg-red-700 text-white p-1 rounded-lg transition">
                                                <Ban size={14} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); pedirConfirmacion('naviera', n, 'reactivar'); }}
                                                className="text-green-600 hover:text-green-800"
                                                title="Reactivar naviera"
                                            >
                                                <RotateCcw size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {!loadingNavieras && navierasFiltradas.length > POR_PAGINA && (
                        <div className="flex items-center justify-between mt-3 text-sm">
                            <button
                                onClick={() => setPaginaNaviera(p => Math.max(1, p - 1))}
                                disabled={paginaNaviera === 1}
                                className="flex items-center gap-1 text-slate-600 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-600"
                            >
                                <ChevronLeft size={16} />
                                Anterior
                            </button>
                            <span className="text-slate-500">
                                Página {paginaNaviera} de {totalPaginasNaviera}
                            </span>
                            <button
                                onClick={() => setPaginaNaviera(p => Math.min(totalPaginasNaviera, p + 1))}
                                disabled={paginaNaviera === totalPaginasNaviera}
                                className="flex items-center gap-1 text-slate-600 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-600"
                            >
                                Siguiente
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Columna derecha: Barcos */}
                <div className="col-span-2 bg-[#3B5BDB]/[0.03] border border-[#3B5BDB]/20 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 bg-[#3B5BDB] rounded-full" />
                            <h2 className="font-semibold text-gray-800">
                                {navieraSeleccionada
                                    ? `Barcos de ${navieraSeleccionada.name}`
                                    : 'Seleccioná una naviera'}
                            </h2>
                        </div>
                        <button
                            onClick={handleNuevoBarco}
                            disabled={!navieraSeleccionada}
                            className="flex items-center gap-2 bg-[#3B5BDB] text-white px-4 py-2 rounded-lg hover:bg-[#2F49B8] transition disabled:opacity-40"
                        >
                            <Plus size={18} />
                            Nuevo barco
                        </button>
                    </div>

                    <div className="flex items-center gap-3 mb-3 flex-nowrap">
                        <div className="flex items-center gap-2 bg-white border border-[#3B5BDB]/20 rounded-lg px-3 py-2 flex-1 min-w-0">
                            <Search size={16} className="text-gray-400 shrink-0" />
                            <input
                                type="text"
                                placeholder="Buscar barco..."
                                className="outline-none w-full text-sm uppercase placeholder:normal-case"
                                value={busquedaBarco}
                                onChange={(e) => setBusquedaBarco(e.target.value.toUpperCase())}
                            />
                        </div>

                        <div className="flex gap-1 bg-[#3B5BDB]/10 rounded-lg p-1 shrink-0">
                            {['ACTIVOS', 'INACTIVOS', 'TODOS'].map((opcion) => (
                                <button
                                    key={opcion}
                                    onClick={() => setFiltroEstadoBarco(opcion)}
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                                        filtroEstadoBarco === opcion
                                            ? 'bg-white text-[#3B5BDB] shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
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
                                    <th className="text-left px-4 py-3">Barco</th>
                                    <th className="text-left px-4 py-3">Estado</th>
                                    <th className="text-left px-4 py-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!navieraSeleccionada ? (
                                    <tr>
                                        <td colSpan="3" className="text-center py-8 text-gray-400">
                                            Elegí una naviera de la izquierda
                                        </td>
                                    </tr>
                                ) : loadingBarcos ? (
                                    <tr>
                                        <td colSpan="3" className="text-center py-8 text-gray-400">
                                            Cargando barcos...
                                        </td>
                                    </tr>
                                ) : barcosPagina.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="text-center py-8 text-gray-400">
                                            Esta naviera no tiene barcos {filtroEstadoBarco === 'TODOS' ? '' : filtroEstadoBarco.toLowerCase()} que coincidan
                                        </td>
                                    </tr>
                                ) : (
                                    barcosPagina.map((v, idx) => (
                                        <tr
                                            key={v.id}
                                            onClick={() => setFilaSeleccionada(v.id)}
                                            className={`cursor-pointer transition ${
                                                filaSeleccionada === v.id
                                                    ? 'bg-blue-50'
                                                    : idx % 2 === 0 ? 'bg-slate-50/60' : 'bg-white'
                                            } hover:bg-blue-50/60`}
                                        >
                                            <td className="px-4 py-3 font-medium">{v.name}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    v.status ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {v.status ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                {v.status ? (
                                                    <>
                                                        <button onClick={() => { setBarcoEdit(v); setShowBarcoModal(true); }} className="bg-green-600 hover:bg-green-700 text-white p-1 rounded-lg transition">
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => pedirConfirmacion('barco', v, 'desactivar')}
                                                            className="bg-red-600 hover:bg-red-700 text-white p-1 rounded-lg transition">
                                                            <Ban size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => pedirConfirmacion('barco', v, 'reactivar')}
                                                        className="text-green-600 hover:text-green-800"
                                                        title="Reactivar barco"
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

                        {navieraSeleccionada && !loadingBarcos && barcosFiltrados.length > POR_PAGINA && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-[#3B5BDB]/10 text-sm">
                                <button
                                    onClick={() => setPaginaBarco(p => Math.max(1, p - 1))}
                                    disabled={paginaBarco === 1}
                                    className="flex items-center gap-1 text-gray-600 hover:text-[#3B5BDB] disabled:opacity-30 disabled:hover:text-gray-600"
                                >
                                    <ChevronLeft size={16} />
                                    Anterior
                                </button>
                                <span className="text-gray-500">
                                    Página {paginaBarco} de {totalPaginasBarco}
                                </span>
                                <button
                                    onClick={() => setPaginaBarco(p => Math.min(totalPaginasBarco, p + 1))}
                                    disabled={paginaBarco === totalPaginasBarco}
                                    className="flex items-center gap-1 text-gray-600 hover:text-[#3B5BDB] disabled:opacity-30 disabled:hover:text-gray-600"
                                >
                                    Siguiente
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showNavieraModal && (
                <ShippingLineModal
                    isOpen={showNavieraModal}
                    shippingLine={navieraEdit}
                    onClose={() => { setShowNavieraModal(false); setNavieraEdit(null); }}
                    onGuardado={cargarNavieras}
                />
            )}

            {showBarcoModal && (
                <VesselModal
                    vessel={barcoEdit}
                    shippingLineId={navieraSeleccionada?.id}
                    onClose={() => { setShowBarcoModal(false); setBarcoEdit(null); }}
                    onGuardado={cargarBarcos}
                />
            )}

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
                                        ? `Desactivar ${confirmacion.tipo === 'naviera' ? 'naviera' : 'barco'}`
                                        : `Reactivar ${confirmacion.tipo === 'naviera' ? 'naviera' : 'barco'}`}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    ¿Estás seguro de {confirmacion.accion} <strong>{confirmacion.item.name}</strong>?
                                </p>
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
                                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg ${
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