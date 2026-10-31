// InventoryMovementsPage.jsx
// 31/10/2026 — Movimientos y kárdex de inventario.
//   - Pestaña MOVIMIENTOS: historial con filtros (bodega, tipo, insumo, fechas) + buscador,
//     activos/anulados. Ver recibo; corregir o anular solo COORDINADOR_INVENTARIO y ADMIN
//     (el backend dice en bloqueo_edicion / bloqueo_anulacion por qué uno no se puede tocar aquí:
//     transferencias, despachos, devoluciones de cupo liquidado, etc.).
//   - Pestaña KÁRDEX: un insumo en una bodega, con saldo inicial, entradas, salidas y saldo.
// El BODEGUERO solo ve su bodega (lo fuerza el backend; aquí el selector queda bloqueado).
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Plus, Trash2, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
    getInventoryMovements, getInventoryMovement, updateInventoryMovement,
    deactivateInventoryMovement, getKardex,
} from '../../api/inventoryMovements';
import { getWarehouses } from '../../api/warehouses';
import { getSupplies } from '../../api/supplies';
import { getThirdParties } from '../../api/thirdParties';
import { getActiveMovementReasonsByType } from '../../api/movementReasons';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import ModalShell from '../../components/common/ModalShell';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import SelectBuscable from '../../components/common/SelectBuscable';

const ROLES_QUE_CORRIGEN = ['ADMIN', 'COORDINADOR_INVENTARIO'];

const COLOR_TIPO = {
    INGRESO: 'bg-green-100 text-green-700',
    EGRESO: 'bg-red-100 text-red-700',
    DEVOLUCION: 'bg-amber-100 text-amber-700',
};

const CAMPO = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
const ETIQUETA = 'block text-xs font-semibold text-gray-600 mb-1';

const num = (v, dec = 2) => Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: dec, maximumFractionDigits: dec });
// null = sin costo conocido (el insumo aún no tiene compras)
const dinero = (v, dec = 2) => (v == null ? '—' : '$' + num(v, dec));
const fechaCorta = (f) => (f ? String(f).slice(0, 10) : '');

// Semana ISO (lunes-domingo), la misma "semana bananera" del formulario de movimientos
function getISOWeek(fecha) {
    const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const diaSemana = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - diaSemana + 3);
    const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const diaSemanaPrimerJueves = (primerJueves.getUTCDay() + 6) % 7;
    primerJueves.setUTCDate(primerJueves.getUTCDate() - diaSemanaPrimerJueves + 3);
    return 1 + Math.round((d - primerJueves) / (7 * 24 * 3600 * 1000));
}

function TipoBadge({ tipo }) {
    return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${COLOR_TIPO[tipo] || 'bg-gray-100 text-gray-700'}`}>
            {tipo === 'DEVOLUCION' ? 'DEVOLUCIÓN' : tipo}
        </span>
    );
}

export default function InventoryMovementsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const esBodeguero = user?.role === 'BODEGUERO';
    const corrige = ROLES_QUE_CORRIGEN.includes(user?.role);

    const [pestana, setPestana] = useState('MOVIMIENTOS');
    const [bodegas, setBodegas] = useState([]);
    const [insumos, setInsumos] = useState([]);
    const [toast, setToast] = useState(null);

    // --- Movimientos ---
    const [filtros, setFiltros] = useState({ warehouse_id: '', type: '', supply_id: '', date_from: '', date_to: '' });
    const [movimientos, setMovimientos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [anular, setAnular] = useState(null);
    const [anulando, setAnulando] = useState(false);
    const [editarId, setEditarId] = useState(null);

    // --- Kárdex ---
    const [kFiltros, setKFiltros] = useState({ warehouse_id: '', supply_id: '', date_from: '', date_to: '' });
    const [kardex, setKardex] = useState(null);
    const [cargandoKardex, setCargandoKardex] = useState(false);
    const [errorKardex, setErrorKardex] = useState('');

    useEffect(() => {
        Promise.all([getWarehouses(), getSupplies()])
            .then(([resB, resI]) => {
                setBodegas(resB.data);
                setInsumos(resI.data);
                if (esBodeguero) {
                    const mia = resB.data.find((b) => b.responsible_user_id === user.id);
                    if (mia) setKFiltros((k) => ({ ...k, warehouse_id: String(mia.id) }));
                }
            })
            .catch((err) => console.error('ERROR AL CARGAR BODEGAS/INSUMOS:', err));
    }, [esBodeguero, user]);

    // Se recarga al cambiar un filtro o al subir "recarga" (después de corregir/anular).
    // "cargando" se prende en el evento que pide la recarga, no dentro del efecto.
    const [recarga, setRecarga] = useState(0);
    useEffect(() => {
        let vigente = true;
        const params = { estado: 'todos' };
        Object.entries(filtros).forEach(([k, v]) => { if (v) params[k] = v; });
        getInventoryMovements(params)
            .then((res) => { if (vigente) setMovimientos(res.data); })
            .catch((err) => {
                console.error('ERROR AL CARGAR MOVIMIENTOS:', err);
                if (vigente) setToast({ tipo: 'error', mensaje: err.response?.data?.message || 'NO SE PUDIERON CARGAR LOS MOVIMIENTOS' });
            })
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [filtros, recarga]);

    const buscar = () => { setCargando(true); setRecarga((r) => r + 1); };

    const cambiarFiltro = (campo, valor) => { setCargando(true); setFiltros((f) => ({ ...f, [campo]: valor })); };

    const verKardexDe = (m) => {
        setKFiltros((k) => ({ ...k, warehouse_id: String(m.warehouse_id) }));
        setKardex(null);
        setPestana('KARDEX');
    };

    const ejecutarAnulacion = async () => {
        setAnulando(true);
        try {
            await deactivateInventoryMovement(anular.id);
            setToast({ tipo: 'exito', mensaje: `Movimiento #${anular.id} anulado` });
            setAnular(null);
            buscar();
        } catch (err) {
            setToast({ tipo: 'error', mensaje: err.response?.data?.message || 'NO SE PUDO ANULAR' });
            setAnular(null);
        } finally {
            setAnulando(false);
        }
    };

    const consultarKardex = async () => {
        setErrorKardex('');
        if (!kFiltros.warehouse_id || !kFiltros.supply_id) {
            setErrorKardex('ELIGE LA BODEGA Y EL INSUMO');
            return;
        }
        setCargandoKardex(true);
        try {
            const params = {};
            Object.entries(kFiltros).forEach(([k, v]) => { if (v) params[k] = v; });
            const res = await getKardex(params);
            setKardex(res.data);
        } catch (err) {
            setErrorKardex(err.response?.data?.message || 'NO SE PUDO CONSULTAR EL KÁRDEX');
        } finally {
            setCargandoKardex(false);
        }
    };

    const insumoKardex = insumos.find((i) => String(i.id) === String(kFiltros.supply_id));

    const bodegaDe = (m) => (
        m.destination_warehouse
            ? <>{m.warehouse?.name} <span className="text-gray-400">→</span> {m.destination_warehouse.name}</>
            : m.warehouse?.name
    );

    const columnas = [
        { titulo: '#', render: (m) => m.id, className: 'font-mono text-gray-500' },
        { titulo: 'Fecha', render: (m) => fechaCorta(m.date), className: 'whitespace-nowrap' },
        { titulo: 'Tipo', render: (m) => <TipoBadge tipo={m.type} /> },
        { titulo: 'Motivo', render: (m) => m.reason?.name, className: 'text-xs' },
        { titulo: 'Bodega', render: bodegaDe },
        {
            titulo: 'Tercero / referencia',
            render: (m) => (
                <div className="text-xs">
                    <div className="font-medium text-gray-700">{m.third_party?.name || '—'}</div>
                    {(m.purchase_order?.code || m.reference || m.delivery_note) && (
                        <div className="text-gray-400">
                            {[m.purchase_order?.code, m.delivery_note && `GUÍA ${m.delivery_note}`, m.reference].filter(Boolean).join(' · ')}
                        </div>
                    )}
                </div>
            ),
        },
        ...(esBodeguero ? [] : [{ titulo: 'Total', render: (m) => `$${num(m.total)}`, className: 'text-right' }]),
        { titulo: 'Registró', render: (m) => m.created_by?.name, className: 'text-xs' },
        { titulo: 'Estado', render: (m) => <EstadoBadge activo={m.status} textoInactivo="ANULADO" /> },
        {
            titulo: 'Acciones',
            render: (m) => (
                <div className="flex items-center gap-2">
                    <AccionesFila
                        activo={m.status}
                        onVer={() => navigate(`/inventory-movements/${m.id}/recibo`, { state: { volver: '/movimientos' } })}
                        onEditar={corrige && !m.bloqueo_edicion ? () => setEditarId(m.id) : undefined}
                        onDesactivar={corrige && !m.bloqueo_anulacion ? () => setAnular(m) : undefined}
                    />
                    {m.status && corrige && m.bloqueo_edicion && (
                        <span title={m.bloqueo_edicion} className="text-gray-400"><Lock size={15} /></span>
                    )}
                    {m.status && (
                        <button type="button" onClick={() => verKardexDe(m)} className="text-xs font-semibold text-primario hover:underline">
                            Kárdex
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="max-w-full mx-auto p-6">
            <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />
            <EncabezadoPagina
                titulo="Movimientos y kárdex"
                subtitulo={esBodeguero
                    ? 'Lo que entró y salió de tu bodega'
                    : 'Historial de ingresos, egresos y devoluciones; corregir o anular un movimiento'}
            />

            <div className="flex gap-2 mb-4">
                {[['MOVIMIENTOS', 'Movimientos'], ['KARDEX', 'Kárdex por insumo']].map(([clave, texto]) => (
                    <button
                        key={clave}
                        type="button"
                        onClick={() => setPestana(clave)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold ${pestana === clave ? 'bg-primario text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                    >
                        {texto}
                    </button>
                ))}
            </div>

            {pestana === 'MOVIMIENTOS' && (
                <>
                    <div className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                        {!esBodeguero && (
                            <div>
                                <label className={ETIQUETA}>Bodega</label>
                                <SelectBuscable value={filtros.warehouse_id} onChange={(e) => cambiarFiltro('warehouse_id', e.target.value)} className={CAMPO}>
                                    <option value="">TODAS</option>
                                    {bodegas.map((b) => <option key={b.id} value={b.id}>{b.name}{b.status ? '' : ' (INACTIVA)'}</option>)}
                                </SelectBuscable>
                            </div>
                        )}
                        <div>
                            <label className={ETIQUETA}>Tipo</label>
                            <SelectBuscable value={filtros.type} onChange={(e) => cambiarFiltro('type', e.target.value)} className={CAMPO}>
                                <option value="">TODOS</option>
                                <option value="INGRESO">INGRESO</option>
                                <option value="EGRESO">EGRESO</option>
                                <option value="DEVOLUCION">DEVOLUCIÓN</option>
                            </SelectBuscable>
                        </div>
                        <div>
                            <label className={ETIQUETA}>Insumo</label>
                            <SelectBuscable value={filtros.supply_id} onChange={(e) => cambiarFiltro('supply_id', e.target.value)} className={CAMPO}>
                                <option value="">TODOS</option>
                                {insumos.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}
                            </SelectBuscable>
                        </div>
                        <div>
                            <label className={ETIQUETA}>Desde</label>
                            <input type="date" value={filtros.date_from} onChange={(e) => cambiarFiltro('date_from', e.target.value)} className={CAMPO} />
                        </div>
                        <div>
                            <label className={ETIQUETA}>Hasta</label>
                            <input type="date" value={filtros.date_to} onChange={(e) => cambiarFiltro('date_to', e.target.value)} className={CAMPO} />
                        </div>
                    </div>

                    <TablaEstandar
                        datos={movimientos}
                        cargando={cargando}
                        columnas={columnas}
                        nombreRegistros="movimientos"
                        placeholderBusqueda="Buscar por #, tercero, OC, guía o referencia..."
                        textosBusqueda={(m) => [String(m.id), m.third_party?.name, m.purchase_order?.code, m.delivery_note, m.reference, m.reason?.name, m.warehouse?.name]}
                        porPagina={15}
                    />
                    {movimientos.length >= 1000 && (
                        <p className="text-xs text-amber-700 mt-2">Se muestran los 1000 más recientes: usa las fechas para acotar.</p>
                    )}
                </>
            )}

            {pestana === 'KARDEX' && (
                <>
                    <div className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                        <div>
                            <label className={ETIQUETA}>Bodega * {esBodeguero && <Lock size={11} className="inline text-gray-400" />}</label>
                            <SelectBuscable
                                value={kFiltros.warehouse_id}
                                onChange={(e) => setKFiltros({ ...kFiltros, warehouse_id: e.target.value })}
                                disabled={esBodeguero}
                                className={CAMPO}
                            >
                                <option value="">SELECCIONAR...</option>
                                {bodegas.map((b) => <option key={b.id} value={b.id}>{b.name}{b.status ? '' : ' (INACTIVA)'}</option>)}
                            </SelectBuscable>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <label className={ETIQUETA}>Insumo *</label>
                            <SelectBuscable value={kFiltros.supply_id} onChange={(e) => setKFiltros({ ...kFiltros, supply_id: e.target.value })} className={CAMPO}>
                                <option value="">SELECCIONAR...</option>
                                {insumos.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}
                            </SelectBuscable>
                        </div>
                        <div>
                            <label className={ETIQUETA}>Desde</label>
                            <input type="date" value={kFiltros.date_from} onChange={(e) => setKFiltros({ ...kFiltros, date_from: e.target.value })} className={CAMPO} />
                        </div>
                        <div>
                            <label className={ETIQUETA}>Hasta</label>
                            <input type="date" value={kFiltros.date_to} onChange={(e) => setKFiltros({ ...kFiltros, date_to: e.target.value })} className={CAMPO} />
                        </div>
                        <button
                            type="button"
                            onClick={consultarKardex}
                            disabled={cargandoKardex}
                            className="flex items-center justify-center gap-2 bg-primario hover:bg-primario-hover text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                        >
                            <Search size={16} />
                            {cargandoKardex ? 'Consultando...' : 'Consultar'}
                        </button>
                    </div>

                    {errorKardex && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-4">{errorKardex}</div>}

                    {kardex && (
                        <div className="bg-white rounded-xl shadow overflow-x-auto">
                            <div className="px-5 py-3 border-b text-sm text-gray-700">
                                <strong>{insumoKardex?.name}</strong>
                                {insumoKardex?.unit && <span className="text-gray-400"> ({insumoKardex.unit})</span>}
                                {' · '}{bodegas.find((b) => String(b.id) === String(kFiltros.warehouse_id))?.name}
                                {!esBodeguero && kardex.costo_promedio_actual != null && (
                                    <span className="float-right text-gray-500">
                                        Costo promedio actual: <strong className="text-gray-800">{dinero(kardex.costo_promedio_actual, 4)}</strong>
                                        {kardex.ultima_compra != null && <> · Última compra: {dinero(kardex.ultima_compra, 4)}</>}
                                    </span>
                                )}
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-primario text-white text-xs uppercase">
                                    <tr>
                                        <th className="text-left px-4 py-2">Fecha</th>
                                        <th className="text-left px-4 py-2">#</th>
                                        <th className="text-left px-4 py-2">Tipo / motivo</th>
                                        <th className="text-left px-4 py-2">Tercero / referencia</th>
                                        <th className="text-right px-4 py-2">Entrada</th>
                                        <th className="text-right px-4 py-2">Salida</th>
                                        <th className="text-right px-4 py-2">Saldo</th>
                                        {!esBodeguero && (
                                            <>
                                                <th className="text-right px-4 py-2">Costo mov.</th>
                                                <th className="text-right px-4 py-2" title="Costo promedio de la empresa después de este movimiento">Costo prom.</th>
                                                <th className="text-right px-4 py-2">Valor saldo</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="bg-gray-100 font-semibold">
                                        <td className="px-4 py-2" colSpan={6}>SALDO INICIAL{kFiltros.date_from ? ` al ${kFiltros.date_from}` : ''}</td>
                                        <td className="px-4 py-2 text-right">{num(kardex.saldo_inicial)}</td>
                                        {!esBodeguero && (
                                            <>
                                                <td />
                                                <td className="px-4 py-2 text-right">{dinero(kardex.costo_inicial, 4)}</td>
                                                <td className="px-4 py-2 text-right">{dinero(kardex.valor_inicial)}</td>
                                            </>
                                        )}
                                    </tr>
                                    {kardex.filas.length === 0 && (
                                        <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-400">Sin movimientos en ese período</td></tr>
                                    )}
                                    {kardex.filas.map((f, i) => (
                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-2 whitespace-nowrap">{fechaCorta(f.date)}</td>
                                            <td className="px-4 py-2">
                                                <button type="button" onClick={() => navigate(`/inventory-movements/${f.movement_id}/recibo`, { state: { volver: '/movimientos' } })} className="font-mono text-primario hover:underline">
                                                    {f.movement_id}
                                                </button>
                                            </td>
                                            <td className="px-4 py-2 text-xs"><TipoBadge tipo={f.type} /> <span className="ml-1">{f.motivo}</span></td>
                                            <td className="px-4 py-2 text-xs">
                                                {f.tercero || '—'}
                                                {(f.reference || f.reception_note) && <div className="text-gray-400">{[f.reference, f.reception_note].filter(Boolean).join(' · ')}</div>}
                                            </td>
                                            <td className="px-4 py-2 text-right text-green-700">{f.entrada ? num(f.entrada) : ''}</td>
                                            <td className="px-4 py-2 text-right text-red-700">{f.salida ? num(f.salida) : ''}</td>
                                            <td className={`px-4 py-2 text-right font-semibold ${f.saldo < 0 ? 'text-red-600' : ''}`}>{num(f.saldo)}</td>
                                            {!esBodeguero && (
                                                <>
                                                    <td className="px-4 py-2 text-right text-gray-500">{dinero(f.unit_cost, 4)}</td>
                                                    <td className="px-4 py-2 text-right">{dinero(f.costo_promedio, 4)}</td>
                                                    <td className="px-4 py-2 text-right">{dinero(f.valor_saldo)}</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 font-bold border-t">
                                        <td className="px-4 py-2" colSpan={4}>TOTALES / SALDO FINAL</td>
                                        <td className="px-4 py-2 text-right text-green-700">{num(kardex.total_entradas)}</td>
                                        <td className="px-4 py-2 text-right text-red-700">{num(kardex.total_salidas)}</td>
                                        <td className="px-4 py-2 text-right text-primario">{num(kardex.saldo_final)}</td>
                                        {!esBodeguero && (
                                            <>
                                                <td />
                                                <td />
                                                <td className="px-4 py-2 text-right text-primario">{dinero(kardex.valor_final)}</td>
                                            </>
                                        )}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </>
            )}

            {anular && (
                <DialogoConfirmacion
                    titulo={`Anular movimiento #${anular.id}`}
                    textoAceptar="Anular"
                    procesando={anulando}
                    onCancelar={() => setAnular(null)}
                    onAceptar={ejecutarAnulacion}
                >
                    {anular.type} de <strong>{anular.warehouse?.name}</strong> del {fechaCorta(anular.date)} ({anular.reason?.name}).
                    {' '}Su efecto en el stock se revierte{anular.purchase_order ? ` y lo recibido vuelve a quedar pendiente en la ${anular.purchase_order.code}` : ''}.
                </DialogoConfirmacion>
            )}

            {editarId && (
                <EditarMovimientoModal
                    id={editarId}
                    insumos={insumos}
                    onClose={() => setEditarId(null)}
                    onGuardado={(mensaje) => { setEditarId(null); setToast({ tipo: 'exito', mensaje }); buscar(); }}
                />
            )}
        </div>
    );
}

// Corrige un movimiento ya registrado. Tipo, bodega y OC no cambian (para eso: anular y
// registrarlo de nuevo); si viene de una OC, los insumos quedan fijos y solo se ajustan cantidades/costos.
function EditarMovimientoModal({ id, insumos, onClose, onGuardado }) {
    const [mov, setMov] = useState(null);
    const [motivos, setMotivos] = useState([]);
    const [terceros, setTerceros] = useState([]);
    const [form, setForm] = useState(null);
    const [lineas, setLineas] = useState([]);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        getInventoryMovement(id)
            .then(async ({ data }) => {
                const [resM, resT] = await Promise.all([getActiveMovementReasonsByType(data.type), getThirdParties()]);
                setMov(data);
                setMotivos(resM.data);
                setTerceros(resT.data);
                setForm({
                    date: fechaCorta(data.date),
                    movement_reason_id: String(data.movement_reason_id),
                    third_party_id: data.third_party_id ? String(data.third_party_id) : '',
                    delivery_note: data.delivery_note || '',
                    reference: data.reference || '',
                });
                setLineas(data.lines.map((l) => ({
                    supply_id: String(l.supply_id),
                    quantity: String(Number(l.quantity)),
                    unit_cost: String(Number(l.unit_cost || 0)),
                    discount: String(Number(l.discount || 0)),
                    reception_note: l.reception_note || '',
                })));
            })
            .catch((err) => setError(err.response?.data?.message || 'NO SE PUDO CARGAR EL MOVIMIENTO'));
    }, [id]);

    const conOC = Boolean(mov?.purchase_order_id);
    const cambiarLinea = (i, campo, valor) => setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
    const totalLinea = (l) => (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0) - (parseFloat(l.discount) || 0);

    // Motivos del mismo tipo, sin las transferencias (tienen su propio flujo)
    const motivosEditables = motivos.filter((m) => !['TRANSFERENCIA A OTRA BODEGA', 'TRANSFERENCIA DE OTRA BODEGA'].includes(m.name)
        || String(m.id) === form?.movement_reason_id);
    const tercerosDelTipo = terceros.filter((t) => (mov?.type === 'INGRESO'
        ? t.type === 'PROVEEDOR'
        : ['PRODUCTOR', 'COMERCIALIZADORA'].includes(t.type)) || String(t.id) === form?.third_party_id);

    const guardar = async (e) => {
        e.preventDefault();
        setError('');
        const validas = lineas.filter((l) => l.supply_id && parseFloat(l.quantity) > 0);
        if (validas.length === 0) { setError('DEJA AL MENOS UN INSUMO CON CANTIDAD'); return; }
        if (!form.date || !form.movement_reason_id) { setError('FECHA Y MOTIVO SON OBLIGATORIOS'); return; }
        const fecha = new Date(form.date + 'T00:00:00');
        setGuardando(true);
        try {
            await updateInventoryMovement(id, {
                warehouse_id: mov.warehouse_id,
                type: mov.type,
                purchase_order_id: mov.purchase_order_id || null,
                vapor: mov.vapor || null,
                date: form.date,
                week: getISOWeek(fecha),
                year: fecha.getFullYear(),
                movement_reason_id: form.movement_reason_id,
                third_party_id: form.third_party_id || null,
                delivery_note: form.delivery_note || null,
                reference: form.reference || null,
                lines: validas.map((l) => ({
                    supply_id: l.supply_id,
                    quantity: l.quantity,
                    unit_cost: l.unit_cost || 0,
                    discount: l.discount || 0,
                    reception_note: l.reception_note?.trim() || null,
                })),
            });
            onGuardado(`Movimiento #${id} corregido`);
        } catch (err) {
            setError(err.response?.data?.message || 'NO SE PUDO GUARDAR');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ModalShell title={`Corregir movimiento #${id}`} onClose={onClose} onSubmit={guardar} esEdicion guardando={guardando} deshabilitado={!form} error={error} size="lg">
            {!form ? (
                !error && <p className="text-sm text-gray-400">Cargando...</p>
            ) : (
                <>
                    <div className="bg-gray-50 rounded-lg px-4 py-2 text-sm text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
                        <span><TipoBadge tipo={mov.type} /></span>
                        <span>Bodega: <strong>{mov.warehouse?.name}</strong></span>
                        {conOC && <span>OC: <strong>{mov.purchase_order?.code}</strong></span>}
                        <span className="text-xs text-gray-400 w-full">Tipo, bodega y OC no se cambian: si están mal, anula el movimiento y regístralo de nuevo.</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <label className={ETIQUETA}>Fecha *</label>
                            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={CAMPO} />
                        </div>
                        <div>
                            <label className={ETIQUETA}>Motivo *</label>
                            <SelectBuscable value={form.movement_reason_id} onChange={(e) => setForm({ ...form, movement_reason_id: e.target.value })} className={CAMPO}>
                                {motivosEditables.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </SelectBuscable>
                        </div>
                        <div className="col-span-2">
                            <label className={ETIQUETA}>Proveedor / productor {conOC && <Lock size={11} className="inline text-gray-400" />}</label>
                            <SelectBuscable value={form.third_party_id} onChange={(e) => setForm({ ...form, third_party_id: e.target.value })} disabled={conOC} className={CAMPO}>
                                <option value="">SIN TERCERO (MOVIMIENTO INTERNO)</option>
                                {tercerosDelTipo.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.type}</option>)}
                            </SelectBuscable>
                        </div>
                        <div>
                            <label className={ETIQUETA}>Guía de remisión</label>
                            <input value={form.delivery_note} onChange={(e) => setForm({ ...form, delivery_note: e.target.value.toUpperCase() })} className={CAMPO} />
                        </div>
                        <div className="col-span-2 md:col-span-3">
                            <label className={ETIQUETA}>Referencia / observación</label>
                            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={CAMPO} />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-primario text-white text-xs uppercase">
                                <tr>
                                    <th className="text-left px-3 py-2">Insumo</th>
                                    <th className="text-right px-3 py-2 w-28">Cantidad</th>
                                    <th className="text-right px-3 py-2 w-28">Costo unit.</th>
                                    <th className="text-right px-3 py-2 w-24">Descuento</th>
                                    <th className="text-right px-3 py-2 w-28">Total</th>
                                    <th className="w-10" />
                                </tr>
                            </thead>
                            <tbody>
                                {lineas.map((l, i) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                        <td className="px-3 py-1.5">
                                            <SelectBuscable value={l.supply_id} onChange={(e) => cambiarLinea(i, 'supply_id', e.target.value)} disabled={conOC} className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none">
                                                <option value="">SELECCIONAR...</option>
                                                {insumos.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                                            </SelectBuscable>
                                        </td>
                                        {['quantity', 'unit_cost', 'discount'].map((campo) => (
                                            <td key={campo} className="px-3 py-1.5">
                                                <input
                                                    type="number" min="0" step={campo === 'unit_cost' ? '0.0001' : '0.01'}
                                                    value={l[campo]}
                                                    onChange={(e) => cambiarLinea(i, campo, e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-primario"
                                                />
                                            </td>
                                        ))}
                                        <td className="px-3 py-1.5 text-right font-medium">${num(totalLinea(l))}</td>
                                        <td className="px-2 text-center">
                                            {!conOC && lineas.length > 1 && (
                                                <button type="button" onClick={() => setLineas(lineas.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700">
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t">
                                    <td className="px-3 py-2">
                                        {!conOC && (
                                            <button type="button" onClick={() => setLineas([...lineas, { supply_id: '', quantity: '', unit_cost: '', discount: '0', reception_note: '' }])} className="flex items-center gap-1 text-sm font-semibold text-primario hover:text-primario-hover">
                                                <Plus size={15} /> Agregar insumo
                                            </button>
                                        )}
                                    </td>
                                    <td colSpan={3} className="px-3 py-2 text-right font-semibold text-gray-700">Total</td>
                                    <td className="px-3 py-2 text-right font-bold text-primario">${num(lineas.reduce((a, l) => a + totalLinea(l), 0))}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <p className="text-xs text-gray-500">
                        Si la corrección deja alguna bodega con stock negativo (porque ese material ya salió), el sistema no la guarda.
                    </p>
                </>
            )}
        </ModalShell>
    );
}
