// ProducerContractsPage.jsx — 06/11/2026: contratos y régimen de retención de productores y
// comercializadoras (hoja "Base Productores" del Excel de liquidaciones).
// Por cada vendedor: régimen de retención (NORMAL / BPA / NO RETENER), nombre corto para la referencia
// de pago al banco y sus contratos: N°, cupo semanal, precio y si se le cobra transferencia,
// evaluadores, materiales y transporte (si dice NO, ese descuento no se aplica al liquidar).
// 12/11/2026: la misma pantalla sirve a dos departamentos (prop "modo"):
//   modo="legal"     → LEGAL → Contratos de productores: edita contratos y cajas MAG (no la retención)
//   modo="retencion" → LIQUIDACIÓN → Retención de productores: edita régimen y referencia de pago; ve los contratos
import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { getContratosProductores, guardarContratosProductor, guardarRetencionProductor } from '../../api/liquidacionBase';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import ModalShell from '../../components/common/ModalShell';
import ToastFlotante from '../../components/common/ToastFlotante';
import CampoNumero from '../../components/common/CampoNumero';
import { dinero } from '../../utils/formato';
import { hoyISO } from '../../utils/fecha';
import { REGIMENES } from '../../utils/retencion';

const label = 'block text-sm font-semibold text-gray-700 mb-1.5';
const input = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
const mensajeError = (err, texto) => {
    const errores = err.response?.data?.errors;
    return errores ? Object.values(errores).flat().join(' ') : (err.response?.data?.message || texto);
};
const COBROS = [
    ['charge_transfer', 'Transferencia'],
    ['charge_evaluators', 'Evaluadores'],
    ['charge_materials', 'Materiales'],
    ['charge_transport', 'Transporte'],
];
const CONDICIONES = { CON_DESCUENTO: 'CON DESCUENTO', SIN_DESCUENTO: 'SIN DESCUENTO' };
const colorRegimen = { NORMAL: 'bg-gray-100 text-gray-700', BPA: 'bg-blue-100 text-blue-700', NO_RETENER: 'bg-amber-100 text-amber-800' };

// 11/11/2026: un contrato nuevo vale desde hoy hasta el 31/12 de este año (se puede cambiar)
const contratoVacio = (numero) => ({
    id: null, number: String(numero), weekly_boxes: '', price: '', discount_condition: '',
    charge_transfer: true, charge_evaluators: true, charge_materials: true, charge_transport: true,
    start_date: hoyISO(), end_date: `${new Date().getFullYear()}-12-31`, magap_contract_number: '', notes: '', status: true, cajas_semana: 0,
    banana_code: '', farm_name: '',
});

// 11/11/2026: vigencia del contrato hoy: VENCIDO, VENCE PRONTO (30 días) o vigente
const estadoVigencia = (c) => {
    if (!c.end_date) return null;
    const hoy = hoyISO();
    if (c.end_date < hoy) return { texto: 'VENCIDO', clase: 'text-red-600' };
    const dias = (new Date(`${c.end_date}T00:00:00`) - new Date(`${hoy}T00:00:00`)) / 86400000;
    return dias <= 30 ? { texto: `VENCE ${c.end_date.split('-').reverse().join('/')}`, clase: 'text-amber-600' } : null;
};

function ProductorModal({ tercero, semana, modo, onClose, onGuardado }) {
    const esLegal = modo === 'legal';
    const [form, setForm] = useState({
        retention_regime: tercero.retention_regime || 'NORMAL', payment_short_name: tercero.payment_short_name || '',
        magap_registered_boxes: tercero.magap_registered_boxes == null ? '' : String(tercero.magap_registered_boxes),
    });
    const [contratos, setContratos] = useState(tercero.contracts.map((c) => ({
        ...c, number: String(c.number), weekly_boxes: String(c.weekly_boxes ?? ''), price: c.price === null ? '' : String(c.price),
        discount_condition: c.discount_condition || '', start_date: c.start_date || '', end_date: c.end_date || '',
        magap_contract_number: c.magap_contract_number || '', notes: c.notes || '',
        banana_code: c.banana_code || '', farm_name: c.farm_name || '',
    })));
    // 11/11/2026: cupo semanal de los contratos activos frente a lo registrado en el MAG
    const cupoContratos = contratos.filter((c) => c.status).reduce((s, c) => s + (Number(c.weekly_boxes) || 0), 0);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const cambiar = (i, campo, valor) => setContratos((cs) => cs.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));
    const siguienteNumero = () => Math.max(0, ...contratos.filter((c) => c.status).map((c) => Number(c.number) || 0)) + 1;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        // 12/11/2026: Liquidaciones guarda solo la retención (los contratos los registra LEGAL)
        if (!esLegal) {
            setGuardando(true);
            try {
                await guardarRetencionProductor(tercero.id, {
                    retention_regime: form.retention_regime,
                    payment_short_name: form.payment_short_name.trim() || null,
                });
                onGuardado();
                onClose();
            } catch (err) {
                setError(mensajeError(err, 'No se pudo guardar.'));
            } finally {
                setGuardando(false);
            }
            return;
        }
        const falta = contratos.findIndex((c) => !c.number || c.weekly_boxes === '' || !c.price);
        if (falta >= 0) return setError(`Contrato ${falta + 1}: completa número, cupo semanal y precio.`);
        setGuardando(true);
        try {
            await guardarContratosProductor(tercero.id, {
                magap_registered_boxes: form.magap_registered_boxes === '' ? null : Number(form.magap_registered_boxes),
                contracts: contratos.map((c) => ({
                    id: c.id, number: Number(c.number), weekly_boxes: Number(c.weekly_boxes), price: Number(c.price),
                    discount_condition: c.discount_condition || null,
                    charge_transfer: c.charge_transfer, charge_evaluators: c.charge_evaluators, charge_materials: c.charge_materials, charge_transport: c.charge_transport,
                    start_date: c.start_date || null, end_date: c.end_date || null,
                    magap_contract_number: c.magap_contract_number.trim() || null, notes: c.notes.trim() || null, status: c.status,
                    banana_code: c.banana_code.trim() || null, farm_name: c.farm_name.trim() || null,
                })),
            });
            onGuardado();
            onClose();
        } catch (err) {
            setError(mensajeError(err, 'No se pudo guardar.'));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ModalShell title={tercero.name} onClose={onClose} onSubmit={handleSubmit} esEdicion guardando={guardando} error={error} size="lg">
            <p className="text-sm text-gray-500 -mt-2">{tercero.type} · {tercero.identification || 'SIN RUC / CÉDULA'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 12/11/2026: la retención la edita Liquidaciones; LEGAL no la ve aquí */}
                {!esLegal && <>
                <div>
                    <label className={label} htmlFor="prod-regimen">Régimen de retención *</label>
                    <select id="prod-regimen" value={form.retention_regime} onChange={(e) => setForm((f) => ({ ...f, retention_regime: e.target.value }))} className={input}>
                        {Object.entries(REGIMENES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Asociaciones y cooperativas: NO RETENER. BPA: tasa fija de los parámetros de la semana.</p>
                </div>
                <div>
                    <label className={label} htmlFor="prod-corto">Nombre para la referencia de pago</label>
                    <input id="prod-corto" value={form.payment_short_name} onChange={(e) => setForm((f) => ({ ...f, payment_short_name: e.target.value.toUpperCase() }))} maxLength={40}
                        placeholder="EJ. JEHOVA JIREH" className={input} />
                    <p className="text-xs text-gray-400 mt-1">Opcional. Sale en la transferencia: "NOMBRE LIQ 4761 GLOBAL WK43 ROSEHIP".</p>
                </div>
                </>}
                <div>
                    <label className={label} htmlFor="prod-mag">Cajas registradas en el MAG (por semana)</label>
                    <CampoNumero id="prod-mag" value={form.magap_registered_boxes} onChange={(e) => setForm((f) => ({ ...f, magap_registered_boxes: e.target.value }))} decimales={0} disabled={!esLegal} className={input} />
                    <p className={`text-xs mt-1 ${form.magap_registered_boxes !== '' && Number(form.magap_registered_boxes) !== cupoContratos ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                        Cupo de los contratos activos: {dinero(cupoContratos, 0)} cajas{form.magap_registered_boxes !== '' && Number(form.magap_registered_boxes) !== cupoContratos ? ' · NO COINCIDE CON EL MAG' : ''}
                    </p>
                </div>
            </div>

            {/* 12/11/2026: fuera de LEGAL los contratos se ven sin poder cambiarlos (el backend también lo exige) */}
            <fieldset disabled={!esLegal} className="space-y-3 min-w-0">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">Contratos</h3>
                    {esLegal ? (
                        <button type="button" onClick={() => setContratos((cs) => [...cs, contratoVacio(siguienteNumero())])}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-primario hover:bg-primario-claro">
                            <Plus size={16} /> Agregar contrato
                        </button>
                    ) : (
                        <span className="text-xs font-semibold text-gray-500">LOS CONTRATOS LOS REGISTRA LEGAL</span>
                    )}
                </div>
                {contratos.length === 0 && <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">Sin contratos: todo lo que se le compre irá como SPOT.</p>}
                {contratos.map((c, i) => (
                    <div key={c.id ?? `n${i}`} className={`border rounded-xl p-4 space-y-3 ${c.status ? '' : 'bg-gray-50 opacity-75'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-gray-800">
                                CONTRATO {c.number || '?'} {!c.status && <span className="ml-2 text-xs font-semibold text-gray-500">DESACTIVADO</span>}
                                {c.status && estadoVigencia(c) && <span className={`ml-2 text-xs font-semibold ${estadoVigencia(c).clase}`}>{estadoVigencia(c).texto}</span>}
                            </p>
                            <div className="flex items-center gap-3">
                                {c.id && (
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input type="checkbox" checked={c.status} onChange={(e) => cambiar(i, 'status', e.target.checked)} /> Activo
                                    </label>
                                )}
                                {!c.id && (
                                    <button type="button" onClick={() => setContratos((cs) => cs.filter((_, j) => j !== i))} title="Quitar contrato" aria-label="Quitar contrato"
                                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-600">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className={label} htmlFor={`c${i}-numero`}>N° *</label>
                                <CampoNumero id={`c${i}-numero`} value={c.number} onChange={(e) => cambiar(i, 'number', e.target.value)} decimales={0} max={20} className={input} />
                            </div>
                            <div>
                                <label className={label} htmlFor={`c${i}-cupo`}>Cupo semanal (cajas) *</label>
                                <CampoNumero id={`c${i}-cupo`} value={c.weekly_boxes} onChange={(e) => cambiar(i, 'weekly_boxes', e.target.value)} decimales={0} className={input} />
                            </div>
                            <div>
                                <label className={label} htmlFor={`c${i}-precio`}>Precio por caja *</label>
                                <CampoNumero id={`c${i}-precio`} value={c.price} onChange={(e) => cambiar(i, 'price', e.target.value)} max={99} className={input} />
                            </div>
                            <div>
                                <label className={label} htmlFor={`c${i}-condicion`}>Condición</label>
                                <select id={`c${i}-condicion`} value={c.discount_condition} onChange={(e) => cambiar(i, 'discount_condition', e.target.value)} className={input}>
                                    <option value="">—</option>
                                    {Object.entries(CONDICIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <p className={label}>Se le cobra</p>
                            <div className="flex flex-wrap gap-x-5 gap-y-2">
                                {COBROS.map(([campo, texto]) => (
                                    <label key={campo} className="flex items-center gap-2 text-sm text-gray-700">
                                        <input type="checkbox" checked={c[campo]} onChange={(e) => cambiar(i, campo, e.target.checked)} /> {texto}
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Lo que quede sin marcar no se le descuenta en las compras de este contrato.</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className={label} htmlFor={`c${i}-desde`}>Vigente desde</label>
                                <input id={`c${i}-desde`} type="date" value={c.start_date} onChange={(e) => cambiar(i, 'start_date', e.target.value)} className={input} />
                            </div>
                            <div>
                                <label className={label} htmlFor={`c${i}-hasta`}>Hasta</label>
                                <input id={`c${i}-hasta`} type="date" value={c.end_date} onChange={(e) => cambiar(i, 'end_date', e.target.value)} className={input} />
                            </div>
                            <div>
                                <label className={label} htmlFor={`c${i}-codigo`}>Código único bananero</label>
                                <input id={`c${i}-codigo`} value={c.banana_code} onChange={(e) => cambiar(i, 'banana_code', e.target.value.toUpperCase())} maxLength={60} placeholder="EJ. C0157" className={input} />
                            </div>
                            <div>
                                <label className={label} htmlFor={`c${i}-finca`}>Finca</label>
                                <input id={`c${i}-finca`} value={c.farm_name} onChange={(e) => cambiar(i, 'farm_name', e.target.value.toUpperCase())} maxLength={120} placeholder="S/N" className={input} />
                            </div>
                            <div>
                                <label className={label} htmlFor={`c${i}-magap`}>N° contrato MAGAP</label>
                                <input id={`c${i}-magap`} value={c.magap_contract_number} onChange={(e) => cambiar(i, 'magap_contract_number', e.target.value.toUpperCase())} maxLength={40} className={input} />
                            </div>
                            <div>
                                <label className={label} htmlFor={`c${i}-notas`}>Observación</label>
                                <input id={`c${i}-notas`} value={c.notes} onChange={(e) => cambiar(i, 'notes', e.target.value.toUpperCase())} maxLength={255} className={input} />
                            </div>
                        </div>
                        {c.id && c.status && (
                            <p className="text-xs text-gray-500">
                                Comprado en WK{semana.week}: <strong>{dinero(c.cajas_semana || 0, 0)}</strong> de {dinero(c.weekly_boxes || 0, 0)} cajas
                                {Number(c.cajas_semana) > Number(c.weekly_boxes) && <span className="ml-2 font-semibold text-red-600">EXCEDE CUPO</span>}
                            </p>
                        )}
                    </div>
                ))}
            </fieldset>
        </ModalShell>
    );
}

export default function ProducerContractsPage({ modo = 'retencion' }) {
    const esLegal = modo === 'legal';
    const [terceros, setTerceros] = useState([]);
    const [semana, setSemana] = useState({ week: '', year: '' });
    const [cargando, setCargando] = useState(true);
    const [filtro, setFiltro] = useState('TODOS');
    const [modal, setModal] = useState(null);
    const [toast, setToast] = useState(null);

    const pedir = () =>
        getContratosProductores()
            .then((d) => {
                setTerceros(Array.isArray(d?.terceros) ? d.terceros : []);
                setSemana(d?.semana || { week: '', year: '' });
            })
            .catch(() => setToast({ tipo: 'error', mensaje: 'No se pudo cargar la información.' }))
            .finally(() => setCargando(false));

    useEffect(() => {
        pedir();
    }, []);

    const activos = (t) => t.contracts.filter((c) => c.status);
    const excede = (t) => activos(t).some((c) => Number(c.cajas_semana) > Number(c.weekly_boxes));
    const filtros = {
        TODOS: () => true,
        CON: (t) => activos(t).length > 0,
        SIN: (t) => activos(t).length === 0,
        NO_RETENER: (t) => t.retention_regime === 'NO_RETENER',
        EXCEDE: excede,
    };
    const visibles = terceros.filter(filtros[filtro]);
    const pestanaBoton = (activa) => `px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${activa ? 'bg-primario text-white' : 'text-gray-600 hover:bg-gray-100'}`;

    return (
        <div className="p-6 space-y-6">
            <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />
            {esLegal
                ? <EncabezadoPagina titulo="Contratos de productores" subtitulo="Contratos de cada productor o comercializadora: cupo semanal, precio, vigencia, código bananero y cajas registradas en el MAG" />
                : <EncabezadoPagina titulo="Retención de productores" subtitulo="Régimen de retención IR único banano y referencia de pago de cada vendedor. Los contratos los registra LEGAL" />}

            <div className="flex gap-1 bg-white border rounded-lg p-1 w-fit max-w-full overflow-x-auto">
                {[['TODOS', `TODOS (${terceros.length})`], ['CON', 'CON CONTRATO'], ['SIN', 'SIN CONTRATO'], ['NO_RETENER', 'NO RETENER'], ['EXCEDE', 'EXCEDE CUPO']].map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setFiltro(k)} className={pestanaBoton(filtro === k)}>{v}</button>
                ))}
            </div>

            <TablaEstandar key={filtro} datos={visibles} cargando={cargando} nombreRegistros="vendedores" mostrarPestanas={false} porPagina={15}
                placeholderBusqueda="Buscar por nombre o RUC..."
                textosBusqueda={(t) => [t.name, t.identification, t.payment_short_name]}
                columnas={[
                    { titulo: 'Productor / comercializadora', render: (t) => <div><p className="font-medium">{t.name}</p><p className="text-xs text-gray-500">{t.type}{!t.status && ' · INACTIVO'}</p></div> },
                    { titulo: 'RUC / Cédula', render: (t) => t.identification || '—' },
                    { titulo: 'Retención', render: (t) => <span className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${colorRegimen[t.retention_regime]}`}>{t.retention_regime === 'NO_RETENER' ? 'NO RETENER' : t.retention_regime}</span> },
                    {
                        titulo: 'Contratos',
                        render: (t) => (activos(t).length === 0 ? <span className="text-xs text-gray-400">SOLO SPOT</span> : (
                            <div className="space-y-0.5">
                                {activos(t).map((c) => (
                                    <p key={c.id} className="text-xs whitespace-nowrap">
                                        <strong>{c.number}</strong> · $ {dinero(c.price)} · {dinero(c.weekly_boxes, 0)} cajas/sem
                                        {Number(c.cajas_semana) > Number(c.weekly_boxes) && <span className="ml-1 font-semibold text-red-600">EXCEDE</span>}
                                        {estadoVigencia(c) && <span className={`ml-1 font-semibold ${estadoVigencia(c).clase}`}>{estadoVigencia(c).texto}</span>}
                                    </p>
                                ))}
                            </div>
                        )),
                    },
                    {
                        titulo: 'Acciones',
                        render: (t) => (
                            <button type="button" onClick={() => setModal(t)} title={esLegal ? 'Editar contratos' : 'Editar retención'} aria-label={esLegal ? 'Editar contratos' : 'Editar retención'} className="p-1.5 rounded-lg hover:bg-gray-100 text-primario">
                                <Pencil size={16} />
                            </button>
                        ),
                    },
                ]}
            />

            {modal && <ProductorModal tercero={modal} semana={semana} modo={modo} onClose={() => setModal(null)} onGuardado={() => { pedir(); setToast({ tipo: 'exito', mensaje: 'Guardado.' }); }} />}
        </div>
    );
}
