// SettlementParametersPage.jsx — 06/11/2026: parámetros de liquidación de cada semana (hoja PARAMETROS
// del Excel de liquidaciones) y tabla de tramos de la retención IR único banano (hoja CALCULADORA
// BANANERA), con un simulador para comprobar la tasa.
import { useEffect, useState } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { getParametros, getPropuestaParametros, crearParametros, actualizarParametros, getTramos, guardarTramos, simularRetencion } from '../../api/liquidacionBase';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import ModalShell from '../../components/common/ModalShell';
import ToastFlotante from '../../components/common/ToastFlotante';
import CampoNumero from '../../components/common/CampoNumero';
import { dinero } from '../../utils/formato';
import { REGIMENES } from '../../utils/retencion';

const label = 'block text-sm font-semibold text-gray-700 mb-1.5';
const input = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
const mensajeError = (err, texto) => {
    const errores = err.response?.data?.errors;
    return errores ? Object.values(errores).flat().join(' ') : (err.response?.data?.message || texto);
};
// Las tasas se guardan como fracción (0,0125) y se muestran en porcentaje (1,25 %)
const aPorcentaje = (v) => (v === null || v === undefined || v === '' ? '' : String(Math.round(Number(v) * 10000) / 100));
const porcentaje = (v) => `${dinero(Number(v) * 100, 2)} %`;

function ParametrosModal({ fila, propuesta, onClose, onGuardado }) {
    const base = fila || propuesta;
    const [form, setForm] = useState({
        year: String(base.year), week: String(base.week), minimum_price: String(base.minimum_price), box_type: base.box_type,
        bpa_rate: aPorcentaje(base.bpa_rate), pto_bolivar_bonus: String(base.pto_bolivar_bonus), notes: fila?.notes || '',
    });
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.year || !form.week || !form.minimum_price) return setError('Completa año, semana y precio mínimo oficial.');
        setGuardando(true);
        try {
            const data = {
                ...form, year: Number(form.year), week: Number(form.week), minimum_price: Number(form.minimum_price),
                bpa_rate: Number(form.bpa_rate || 0) / 100, pto_bolivar_bonus: Number(form.pto_bolivar_bonus || 0), notes: form.notes.trim() || null,
            };
            if (fila) await actualizarParametros(fila.id, data);
            else await crearParametros(data);
            onGuardado();
            onClose();
        } catch (err) {
            setError(mensajeError(err, 'No se pudieron guardar los parámetros.'));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ModalShell title={fila ? `Parámetros — semana ${fila.week} de ${fila.year}` : 'Parámetros de una semana nueva'} onClose={onClose} onSubmit={handleSubmit} esEdicion={Boolean(fila)} guardando={guardando} error={error}>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={label} htmlFor="par-anio">Año *</label>
                    <CampoNumero id="par-anio" name="year" value={form.year} onChange={cambiar} decimales={0} max={2100} className={input} />
                </div>
                <div>
                    <label className={label} htmlFor="par-semana">Semana a liquidar *</label>
                    <CampoNumero id="par-semana" name="week" value={form.week} onChange={cambiar} decimales={0} max={53} className={input} />
                </div>
                <div>
                    <label className={label} htmlFor="par-minimo">Precio mínimo oficial por caja (USD) *</label>
                    <CampoNumero id="par-minimo" name="minimum_price" value={form.minimum_price} onChange={cambiar} className={input} />
                    <p className="text-xs text-gray-400 mt-1">Si el pactado es menor, se liquida a este precio y la diferencia va a la nota de crédito.</p>
                </div>
                <div>
                    <label className={label} htmlFor="par-caja">Tipo de caja *</label>
                    <input id="par-caja" name="box_type" value={form.box_type} onChange={(e) => setForm((f) => ({ ...f, box_type: e.target.value.toUpperCase() }))} maxLength={20} className={input} />
                    <p className="text-xs text-gray-400 mt-1">Se imprime en el encabezado de la liquidación.</p>
                </div>
                <div>
                    <label className={label} htmlFor="par-bpa">Retención con BPA vigente (%)</label>
                    <CampoNumero id="par-bpa" name="bpa_rate" value={form.bpa_rate} onChange={cambiar} max={10} className={input} />
                </div>
                <div>
                    <label className={label} htmlFor="par-bolivar">Reconocimiento por caja en Pto. Bolívar (USD)</label>
                    <CampoNumero id="par-bolivar" name="pto_bolivar_bonus" value={form.pto_bolivar_bonus} onChange={cambiar} max={5} className={input} />
                </div>
                <div className="col-span-2">
                    <label className={label} htmlFor="par-notas">Observación</label>
                    <input id="par-notas" name="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value.toUpperCase() }))} maxLength={255} className={input} />
                </div>
            </div>
        </ModalShell>
    );
}

function TablaRetencion({ onToast }) {
    const [tramos, setTramos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [editando, setEditando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [sim, setSim] = useState({ boxes: '298', price: '8.20', regime: 'NORMAL' });
    const [resultado, setResultado] = useState(null);

    const pedir = () =>
        getTramos()
            .then((t) => setTramos(t.map((x) => ({ from_boxes: String(x.from_boxes), to_boxes: x.to_boxes === null ? '' : String(x.to_boxes), rate: aPorcentaje(x.rate) }))))
            .catch(() => onToast({ tipo: 'error', mensaje: 'No se pudo cargar la tabla de retención.' }))
            .finally(() => setCargando(false));

    useEffect(() => {
        pedir();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cambiar = (i, campo, valor) => setTramos((ts) => ts.map((t, j) => {
        if (j === i) return { ...t, [campo]: valor };
        // El tramo siguiente arranca donde termina este
        if (campo === 'to_boxes' && j === i + 1) return { ...t, from_boxes: valor };
        return t;
    }));

    const agregar = () => setTramos((ts) => {
        const ultimo = ts[ts.length - 1];
        return [...ts, { from_boxes: ultimo?.to_boxes || '', to_boxes: '', rate: '' }];
    });

    const guardar = async () => {
        setError('');
        setGuardando(true);
        try {
            await guardarTramos(tramos.map((t) => ({ from_boxes: Number(t.from_boxes || 0), to_boxes: t.to_boxes === '' ? null : Number(t.to_boxes), rate: Number(t.rate || 0) / 100 })));
            await pedir();
            setEditando(false);
            onToast({ tipo: 'exito', mensaje: 'Tabla de retención guardada.' });
        } catch (err) {
            setError(mensajeError(err, 'No se pudo guardar la tabla.'));
        } finally {
            setGuardando(false);
        }
    };

    const simular = async (e) => {
        e.preventDefault();
        if (!sim.boxes || !sim.price) return;
        try {
            setResultado(await simularRetencion({ boxes: Number(sim.boxes), price: Number(sim.price), regime: sim.regime, bpa_rate: 0.01 }));
        } catch (err) {
            onToast({ tipo: 'error', mensaje: mensajeError(err, 'No se pudo calcular.') });
        }
    };

    if (cargando) return <p className="text-sm text-gray-500">Cargando...</p>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-gray-800">Tabla de tramos</h2>
                        <p className="text-xs text-gray-500">Impuesto a la renta único del banano (Art. 27 LRTI). Si cambia la ley, se actualiza solo esta tabla.</p>
                    </div>
                    {!editando && (
                        <button type="button" onClick={() => setEditando(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-primario hover:bg-primario-claro">
                            <Pencil size={16} /> Editar
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 border-b">
                                <th className="py-2 pr-2">Más de (cajas)</th>
                                <th className="py-2 pr-2">Hasta (cajas)</th>
                                <th className="py-2 pr-2">Tarifa (%)</th>
                                {editando && <th />}
                            </tr>
                        </thead>
                        <tbody>
                            {tramos.map((t, i) => (
                                <tr key={i} className="border-b last:border-0">
                                    <td className="py-2 pr-2">
                                        {editando && i > 0 ? <span className="text-gray-500">{t.from_boxes ? dinero(t.from_boxes, 0) : '—'}</span> : dinero(t.from_boxes || 0, 0)}
                                    </td>
                                    <td className="py-2 pr-2">
                                        {editando ? (
                                            i === tramos.length - 1 ? <span className="text-gray-500">EN ADELANTE</span>
                                                : <CampoNumero value={t.to_boxes} onChange={(e) => cambiar(i, 'to_boxes', e.target.value)} decimales={0} aria-label={`Hasta, tramo ${i + 1}`} className={input} />
                                        ) : (t.to_boxes === '' ? 'EN ADELANTE' : dinero(t.to_boxes, 0))}
                                    </td>
                                    <td className="py-2 pr-2">
                                        {editando ? <CampoNumero value={t.rate} onChange={(e) => cambiar(i, 'rate', e.target.value)} max={10} aria-label={`Tarifa, tramo ${i + 1}`} className={input} /> : `${dinero(t.rate, 2)} %`}
                                    </td>
                                    {editando && (
                                        <td className="py-2">
                                            {tramos.length > 1 && (
                                                <button type="button" onClick={() => setTramos((ts) => ts.filter((_, j) => j !== i).map((x, j, arr) => (j === arr.length - 1 ? { ...x, to_boxes: '' } : x)))}
                                                    title="Quitar tramo" aria-label="Quitar tramo" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {editando && (
                    <div className="flex flex-wrap justify-between gap-2">
                        <button type="button" onClick={agregar} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-primario hover:bg-primario-claro">
                            <Plus size={16} /> Agregar tramo
                        </button>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => { setEditando(false); setError(''); pedir(); }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300">Cancelar</button>
                            <button type="button" onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primario text-white hover:opacity-90 disabled:opacity-50">
                                <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={simular} className="bg-white rounded-xl border p-5 space-y-4">
                <div>
                    <h2 className="font-bold text-gray-800">Simulador</h2>
                    <p className="text-xs text-gray-500">La tasa depende solo del número de cajas de cada liquidación; se redondea a 2 decimales (la que va a Contífico).</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className={label} htmlFor="sim-cajas">Cajas</label>
                        <CampoNumero id="sim-cajas" value={sim.boxes} onChange={(e) => setSim((s) => ({ ...s, boxes: e.target.value }))} decimales={0} className={input} />
                    </div>
                    <div>
                        <label className={label} htmlFor="sim-precio">Precio</label>
                        <CampoNumero id="sim-precio" value={sim.price} onChange={(e) => setSim((s) => ({ ...s, price: e.target.value }))} className={input} />
                    </div>
                    <div>
                        <label className={label} htmlFor="sim-regimen">Régimen</label>
                        <select id="sim-regimen" value={sim.regime} onChange={(e) => setSim((s) => ({ ...s, regime: e.target.value }))} className={input}>
                            {Object.entries(REGIMENES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                </div>
                <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-primario text-white hover:opacity-90">Calcular</button>
                {resultado && (
                    <dl className="grid grid-cols-3 gap-3 text-sm">
                        <div className="bg-gray-50 rounded-lg p-3"><dt className="text-xs text-gray-500">Ingreso</dt><dd className="font-bold">$ {dinero(resultado.ingreso)}</dd></div>
                        <div className="bg-gray-50 rounded-lg p-3"><dt className="text-xs text-gray-500">Tasa efectiva</dt><dd className="font-bold">{porcentaje(resultado.tasa)}</dd></div>
                        <div className="bg-gray-50 rounded-lg p-3"><dt className="text-xs text-gray-500">Retención</dt><dd className="font-bold">$ {dinero(resultado.retencion)}</dd></div>
                    </dl>
                )}
            </form>
        </div>
    );
}

export default function SettlementParametersPage() {
    const [filas, setFilas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [pestana, setPestana] = useState('SEMANAS');
    const [modal, setModal] = useState(null); // null | { fila, propuesta }
    const [toast, setToast] = useState(null);

    const pedir = () =>
        getParametros()
            .then((d) => setFilas(Array.isArray(d) ? d : []))
            .catch(() => setToast({ tipo: 'error', mensaje: 'No se pudieron cargar los parámetros.' }))
            .finally(() => setCargando(false));

    useEffect(() => {
        pedir();
    }, []);

    const nueva = async () => {
        try {
            setModal({ fila: null, propuesta: await getPropuestaParametros() });
        } catch {
            setToast({ tipo: 'error', mensaje: 'No se pudo preparar la semana nueva.' });
        }
    };
    const pestanaBoton = (activa) => `px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${activa ? 'bg-primario text-white' : 'text-gray-600 hover:bg-gray-100'}`;

    return (
        <div className="p-6 space-y-6">
            <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />
            <EncabezadoPagina
                titulo="Parámetros de liquidación"
                subtitulo="Precio mínimo oficial de cada semana y tabla de retención IR único banano"
                textoBoton={pestana === 'SEMANAS' ? 'Nueva semana' : undefined}
                onNuevo={pestana === 'SEMANAS' ? nueva : undefined}
            />

            <div className="flex gap-1 bg-white border rounded-lg p-1 w-fit">
                <button type="button" onClick={() => setPestana('SEMANAS')} className={pestanaBoton(pestana === 'SEMANAS')}>SEMANAS</button>
                <button type="button" onClick={() => setPestana('RETENCION')} className={pestanaBoton(pestana === 'RETENCION')}>TABLA DE RETENCIÓN</button>
            </div>

            {pestana === 'SEMANAS' && (
                <TablaEstandar datos={filas} cargando={cargando} nombreRegistros="semanas" mostrarPestanas={false} porPagina={15}
                    placeholderBusqueda="Buscar por semana o año..."
                    textosBusqueda={(f) => [`${f.week}`, `${f.year}`, `WK${f.week}`, f.notes]}
                    columnas={[
                        { titulo: 'Semana', render: (f) => <span className="font-semibold whitespace-nowrap">WK{f.week} · {f.year}</span> },
                        { titulo: 'Mínimo oficial', render: (f) => `$ ${dinero(f.minimum_price)}` },
                        { titulo: 'Caja', render: (f) => f.box_type },
                        { titulo: 'BPA', render: (f) => porcentaje(f.bpa_rate) },
                        { titulo: 'Pto. Bolívar', render: (f) => `$ ${dinero(f.pto_bolivar_bonus)} / caja` },
                        { titulo: 'Observación', render: (f) => f.notes || '—' },
                        {
                            titulo: 'Acciones',
                            render: (f) => (
                                <button type="button" onClick={() => setModal({ fila: f })} title="Editar" aria-label="Editar" className="p-1.5 rounded-lg hover:bg-gray-100 text-primario">
                                    <Pencil size={16} />
                                </button>
                            ),
                        },
                    ]}
                />
            )}

            {pestana === 'RETENCION' && <TablaRetencion onToast={setToast} />}

            {modal && <ParametrosModal fila={modal.fila} propuesta={modal.propuesta} onClose={() => setModal(null)} onGuardado={() => { pedir(); setToast({ tipo: 'exito', mensaje: 'Parámetros guardados.' }); }} />}
        </div>
    );
}
