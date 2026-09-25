// MaterialDispatchHistoryPage.jsx
// Historial de Despachos de Materiales: quién retiró, qué, cuándo, desde qué
// bodega y cuánto se le descontará al productor. Permite reimprimir la guía
// y anular un despacho mal hecho (el stock regresa a la bodega).
// El backend filtra solo despachos por cupo (producer_quota_id no nulo) y,
// si el usuario es BODEGUERO, solo los de su propia bodega.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Ban, AlertTriangle, CheckCircle, X, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDespachos, anularDespacho } from '../../api/materialDispatch';
import { getWarehouses } from '../../api/warehouses';
import { getThirdParties } from '../../api/thirdParties';

// Estilo estándar de inputs del sistema
const INPUT = 'w-full bg-gray-100 rounded-2xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500';
const LABEL = 'block text-sm font-semibold text-gray-700 mb-1.5';

const dinero = (v) =>
    Number(v || 0).toLocaleString('es-EC', { style: 'currency', currency: 'USD' });

// Fecha 'YYYY-MM-DD' → 'DD/MM/YYYY' (el T00:00:00 evita el desfase de zona horaria)
const fechaCorta = (f) =>
    f ? new Date(String(f).substring(0, 10) + 'T00:00:00').toLocaleDateString('es-EC') : '—';

const comoLista = (res) => (Array.isArray(res?.data) ? res.data : []);

export default function MaterialDispatchHistoryPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Mismo criterio que el backend (MaterialDispatchController::ROLES_ANULAN)
    const puedeAnular = ['COORDINADOR_INVENTARIO', 'ADMIN'].includes(user?.role);
    // Al BODEGUERO el backend ya le fuerza su bodega: el filtro no le sirve
    const esBodeguero = user?.role === 'BODEGUERO';

    // Filtros: año actual por defecto para no traer todo el histórico de golpe
    const [filtros, setFiltros] = useState({
        warehouse_id: '',
        third_party_id: '',
        week: '',
        year: String(new Date().getFullYear()),
    });

    const [despachos, setDespachos] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [terceros, setTerceros] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [toast, setToast] = useState(null); // { tipo, mensaje }
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);

    // Despacho que se va a anular (abre el modal de confirmación)
    const [confirmarAnular, setConfirmarAnular] = useState(null);
    const [anulando, setAnulando] = useState(false);

    useEffect(() => {
        cargarCatalogos();
        buscar();
    }, []);

    const mostrarToast = (tipo, mensaje, ms = 2500) => {
        setToast({ tipo, mensaje });
        setTimeout(() => setToast(null), ms);
    };

    const cargarCatalogos = async () => {
        try {
            const [resBodegas, resTerceros] = await Promise.all([getWarehouses(), getThirdParties()]);
            setBodegas(comoLista(resBodegas));
            setTerceros(comoLista(resTerceros).filter((t) => ['PRODUCTOR', 'COMERCIALIZADORA'].includes(t.type)));
        } catch (err) {
            console.error('ERROR AL CARGAR CATÁLOGOS:', err);
        }
    };

    // Trae el historial con los filtros que tengan valor (los vacíos no se envían)
    const buscar = async () => {
        setCargando(true);
        try {
            const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== ''));
            const data = await getDespachos(params);
            setDespachos(Array.isArray(data) ? data : []);
            setFilaSeleccionada(null);
        } catch (err) {
            console.error('ERROR AL CARGAR EL HISTORIAL:', err);
            mostrarToast('error', 'NO SE PUDO CARGAR EL HISTORIAL DE DESPACHOS');
        } finally {
            setCargando(false);
        }
    };

    const handleFiltro = (campo, valor) => {
        // Semana y año: solo dígitos
        const limpio = ['week', 'year'].includes(campo) ? valor.replace(/[^0-9]/g, '') : valor;
        setFiltros((prev) => ({ ...prev, [campo]: limpio }));
    };

    const handleAnular = async () => {
        setAnulando(true);
        try {
            const res = await anularDespacho(confirmarAnular.id);
            mostrarToast('exito', (res?.message || 'DESPACHO ANULADO').toUpperCase());
            setConfirmarAnular(null);
            buscar(); // recarga: el anulado desaparece (el backend solo lista activos)
        } catch (err) {
            console.error('ERROR AL ANULAR:', err);
            setConfirmarAnular(null);
            mostrarToast('error', (err.response?.data?.message || 'NO SE PUDO ANULAR EL DESPACHO').toUpperCase(), 4000);
        } finally {
            setAnulando(false);
        }
    };

    // Suma del valor de lo filtrado (ej. un productor + una semana = su descuento total)
    const valorTotal = despachos.reduce((suma, d) => suma + Number(d.valor_total || 0), 0);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">HISTORIAL DE DESPACHOS</h1>
                    <p className="text-gray-500 text-sm">Materiales entregados a productores, quién retiró y valor a descontar</p>
                </div>
                <button
                    onClick={() => navigate('/despacho-materiales')}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-2xl font-semibold text-sm"
                >
                    <Plus size={18} />
                    Nuevo despacho
                </button>
            </div>

            {toast && (
                <div
                    className={`fixed top-4 right-4 max-w-md flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg z-50 text-sm font-semibold ${
                        toast.tipo === 'exito' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                >
                    {toast.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {toast.mensaje}
                </div>
            )}

            {/* ===== Filtros ===== */}
            <div className="bg-white rounded-2xl shadow p-6">
                <div className={`grid grid-cols-1 gap-4 items-end ${esBodeguero ? 'md:grid-cols-4' : 'md:grid-cols-5'}`}>
                    {!esBodeguero && (
                        <div>
                            <label className={LABEL}>Bodega</label>
                            <select value={filtros.warehouse_id} onChange={(e) => handleFiltro('warehouse_id', e.target.value)} className={INPUT}>
                                <option value="">TODAS</option>
                                {bodegas.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className={LABEL}>Productor</label>
                        <select value={filtros.third_party_id} onChange={(e) => handleFiltro('third_party_id', e.target.value)} className={INPUT}>
                            <option value="">TODOS</option>
                            {terceros.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={LABEL}>Semana</label>
                        <input value={filtros.week} onChange={(e) => handleFiltro('week', e.target.value)} maxLength={2} placeholder="TODAS" className={INPUT} />
                    </div>
                    <div>
                        <label className={LABEL}>Año</label>
                        <input value={filtros.year} onChange={(e) => handleFiltro('year', e.target.value)} maxLength={4} className={INPUT} />
                    </div>
                    <button
                        onClick={buscar}
                        disabled={cargando}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-2xl font-semibold text-sm disabled:opacity-50"
                    >
                        <Search size={18} />
                        {cargando ? 'BUSCANDO...' : 'BUSCAR'}
                    </button>
                </div>
            </div>

            {/* ===== Tabla ===== */}
            <div className="bg-white rounded-2xl shadow p-6">
                {despachos.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                        {cargando ? 'Cargando...' : 'NO HAY DESPACHOS CON ESTOS FILTROS'}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b text-gray-600">
                                    <th className="py-2 pr-3">N°</th>
                                    <th className="py-2 pr-3">FECHA</th>
                                    <th className="py-2 pr-3">SEM</th>
                                    <th className="py-2 pr-3">BODEGA</th>
                                    <th className="py-2 pr-3">PRODUCTOR</th>
                                    <th className="py-2 pr-3">RETIRÓ</th>
                                    <th className="py-2 pr-3">REGISTRÓ</th>
                                    <th className="py-2 pr-3 text-right">VALOR</th>
                                    <th className="py-2 text-center">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {despachos.map((d) => {
                                    const liquidado = d.producer_quota?.status === 'LIQUIDADO';
                                    return (
                                        <tr
                                            key={d.id}
                                            onClick={() => setFilaSeleccionada(d.id)}
                                            className={`border-b last:border-0 cursor-pointer ${filaSeleccionada === d.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="py-2 pr-3 text-gray-500">{d.id}</td>
                                            <td className="py-2 pr-3">{fechaCorta(d.date)}</td>
                                            <td className="py-2 pr-3">{d.week ?? '—'}</td>
                                            <td className="py-2 pr-3">{d.warehouse?.name ?? '—'}</td>
                                            <td className="py-2 pr-3">{d.third_party?.name ?? '—'}</td>
                                            <td className="py-2 pr-3">
                                                <p>{d.received_by_name ?? '—'}</p>
                                                <p className="text-xs text-gray-400">C.I. {d.received_by_document ?? '—'}</p>
                                            </td>
                                            <td className="py-2 pr-3 text-gray-500">{d.created_by?.name ?? '—'}</td>
                                            <td className="py-2 pr-3 text-right font-semibold">{dinero(d.valor_total)}</td>
                                            {/* stopPropagation: los botones no disparan la selección de fila */}
                                            <td className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        title="Ver / imprimir guía"
                                                        onClick={() => navigate(`/inventory-movements/${d.id}/recibo`)}
                                                        className="p-1.5 rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50"
                                                    >
                                                        <FileText size={16} />
                                                    </button>
                                                    {/* Anular: solo COORDINADOR_INVENTARIO / ADMIN */}
                                                    {puedeAnular && (
                                                        <button
                                                            title={liquidado ? 'Cupo liquidado: no se puede anular' : 'Anular despacho'}
                                                            onClick={() => setConfirmarAnular(d)}
                                                            disabled={liquidado}
                                                            className="p-1.5 rounded-lg border border-gray-200 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            <Ban size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {despachos.length > 0 && (
                    <div className="flex justify-between items-center pt-4 mt-2 border-t text-sm text-gray-600">
                        <span>{despachos.length} DESPACHO(S)</span>
                        <span>
                            TOTAL A DESCONTAR: <span className="text-lg font-bold text-gray-800">{dinero(valorTotal)}</span>
                        </span>
                    </div>
                )}
            </div>

            {/* ===== Modal de anulación (nunca confirm() nativo) ===== */}
            {confirmarAnular && (
                <div className="fixed inset-0 flex items-center justify-center z-[60]" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm px-6 py-6">
                        <h3 className="text-base font-bold text-gray-800 mb-2">¿Anular el despacho N° {confirmarAnular.id}?</h3>
                        <p className="text-sm text-gray-500 mb-1">
                            {confirmarAnular.third_party?.name} — {dinero(confirmarAnular.valor_total)}
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                            El material regresará al stock de {confirmarAnular.warehouse?.name} y ya no se descontará al productor.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmarAnular(null)}
                                disabled={anulando}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 rounded-lg"
                            >
                                <X size={16} />
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleAnular}
                                disabled={anulando}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                <Ban size={16} />
                                {anulando ? 'Anulando...' : 'Anular'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}