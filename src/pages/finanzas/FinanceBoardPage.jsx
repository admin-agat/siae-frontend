// Tablero financiero — src/pages/finanzas/FinanceBoardPage.jsx
//
// 16/11/2026: suma la Ganancia por viaje de todos los barcos de los pedidos del rango de semanas
// (GET /boards/finance). Mismos números que la pantalla Ganancia por viaje: venta − fruta − materiales
// − fletes − transporte − gastos = ganancia. Si un barco tiene datos incompletos (sin precio de venta,
// sin tarifa de flete, sin gastos) los márgenes salen PRELIMINARES y se avisa qué falta.
// Solo GERENCIA, FINANZAS y ADMIN (pantalla 'tablero_financiero').
//
// Gráficos con recharts, mismas reglas que el Tablero de operaciones (skill dataviz): colores por serie
// en orden fijo, un solo eje Y, barras finas con punta redondeada, leyenda + tooltip y vista de tabla.
import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ReferenceLine,
} from 'recharts';
import { AlertTriangle, CheckCircle2, AlertCircle, Info, Table2, BarChart3, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { getFinanceBoard } from '../../api/boards';
import { semanaISO } from '../../utils/semana';
import { dinero } from '../../utils/formato';

// ---------------- Tokens de gráfico (los mismos del Tablero de operaciones) ----------------
const SERIE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
const TINTA = { primaria: '#0b0b0b', secundaria: '#52514e', tenue: '#898781', grilla: '#e1e0d9' };
const ESTADO = { bien: '#0ca30c', alerta: '#fab219', critico: '#d03b3b' };

const fUsd = (n) => `$ ${dinero(n)}`;
const fUsd0 = (n) => `$ ${dinero(n, 0)}`;
const fCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const fPct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toLocaleString('es-EC', { maximumFractionDigits: 1 })} %`);
const kilo = (v) => (Math.abs(v) >= 1000000 ? `${(v / 1000000).toLocaleString('es-EC', { maximumFractionDigits: 1 })}M` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v);
const ejeProps = { tick: { fill: TINTA.tenue, fontSize: 11 }, axisLine: { stroke: '#c3c2b7' }, tickLine: false };

// ---------------- Piezas ----------------

function TooltipDinero({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-black/10 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold mb-1" style={{ color: TINTA.primaria }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2" style={{ color: TINTA.secundaria }}>
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color || p.payload?.fill }} />
          {p.name}: <strong style={{ color: TINTA.primaria }}>{fUsd(p.value)}</strong>
        </p>
      ))}
      {payload[0]?.payload?.margen !== undefined && (
        <p className="mt-1" style={{ color: TINTA.secundaria }}>Margen: <strong style={{ color: TINTA.primaria }}>{fPct(payload[0].payload.margen)}</strong></p>
      )}
    </div>
  );
}

function TarjetaGrafico({ titulo, subtitulo, tabla, vacio, children, className = '' }) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <div className={`bg-white rounded-xl shadow p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="font-semibold" style={{ color: TINTA.primaria }}>{titulo}</h2>
          {subtitulo && <p className="text-xs" style={{ color: TINTA.secundaria }}>{subtitulo}</p>}
        </div>
        {tabla && !vacio && (
          <button type="button" onClick={() => setVerTabla((v) => !v)} title={verTabla ? 'Ver gráfico' : 'Ver como tabla'}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            {verTabla ? <BarChart3 size={16} /> : <Table2 size={16} />}
          </button>
        )}
      </div>
      {vacio ? <p className="text-sm text-gray-400 py-8 text-center">{vacio}</p> : verTabla ? tabla : children}
    </div>
  );
}

// 18/11/2026 (Peter): tablas con el estilo de las listas compactas: columna # gris, línea fina y filas alternadas
const TD_NUMERO = 'bg-gray-200 border border-gray-300 px-1 py-1.5 text-center text-sm font-bold text-gray-700';
const TD = 'px-3 py-1.5 border border-gray-200';
const filaAlterna = (i) => (i % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-violet-50 hover:bg-yellow-50');

function TablaSimple({ columnas, filas, alto = '', pie }) {
  return (
    <div className={`overflow-auto ${alto}`}>
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b">
            <th className="text-center px-2 py-2 text-xs w-10" style={{ color: TINTA.secundaria }}>#</th>
            {columnas.map((c) => (
              <th key={c.titulo} className={`px-3 py-2 text-xs uppercase font-semibold whitespace-nowrap ${c.derecha ? 'text-right' : 'text-left'}`} style={{ color: TINTA.secundaria }}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className={filaAlterna(i)}>
              <td className={TD_NUMERO}>{i + 1}</td>
              {columnas.map((c) => (
                <td key={c.titulo} className={`${TD} ${c.derecha ? 'text-right whitespace-nowrap' : ''}`}>{c.valor(f)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {pie && (
          <tfoot className="sticky bottom-0 bg-gray-50 font-semibold">
            <tr className="border-t">
              <td className="border border-gray-200" />
              {columnas.map((c) => (
                <td key={c.titulo} className={`${TD} ${c.derecha ? 'text-right whitespace-nowrap' : ''}`}>{c.valor(pie)}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Indicador({ etiqueta, valor, contexto, tono, ayuda }) {
  const colorContexto = tono === 'bien' ? '#006300' : tono === 'alerta' ? '#8a5a00' : tono === 'critico' ? '#a32020' : TINTA.secundaria;
  return (
    <div className="bg-white rounded-xl shadow p-4" title={ayuda}>
      <p className="text-xs uppercase font-semibold flex items-center gap-1" style={{ color: TINTA.secundaria }}>
        {etiqueta} {ayuda && <Info size={12} />}
      </p>
      <p className="text-2xl font-bold mt-1" style={{ color: TINTA.primaria }}>{valor}</p>
      {contexto && <p className="text-xs mt-1 font-medium" style={{ color: colorContexto }}>{contexto}</p>}
    </div>
  );
}

function Estado({ nivel, texto }) {
  const Icono = nivel === 'bien' ? CheckCircle2 : nivel === 'alerta' ? AlertCircle : AlertTriangle;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: TINTA.primaria }}>
      <Icono size={14} color={ESTADO[nivel]} /> {texto}
    </span>
  );
}

// Fila de barco con sus avisos desplegables
function FilaBarco({ b, i }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <tr className={filaAlterna(i)}>
        <td className={TD_NUMERO}>{i + 1}</td>
        <td className={TD}>
          {b.avisos.length > 0 && (
            <button type="button" onClick={() => setAbierta((v) => !v)} className="text-gray-400 hover:text-gray-600" title="Ver qué falta">
              {abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
        </td>
        <td className={`${TD} whitespace-nowrap`}>WK{b.week}</td>
        <td className={`${TD} font-medium`}>{b.name}</td>
        <td className={`${TD} text-right whitespace-nowrap`}>{fCajas(b.cajas)}</td>
        <td className={`${TD} text-right whitespace-nowrap`}>{fUsd(b.venta)}</td>
        <td className={`${TD} text-right whitespace-nowrap`}>{fUsd(b.costo)}</td>
        <td className={`${TD} text-right whitespace-nowrap font-semibold`}>{fUsd(b.ganancia)}</td>
        <td className={`${TD} text-right whitespace-nowrap`}>{fPct(b.margen)}</td>
        <td className={TD}>{b.incompleto ? <Estado nivel="alerta" texto="PRELIMINAR" /> : <Estado nivel="bien" texto="COMPLETO" />}</td>
      </tr>
      {abierta && (
        <tr className="bg-amber-50/50">
          <td colSpan={2} className="border border-gray-200" />
          <td colSpan={8} className="py-2 px-3 text-xs border border-gray-200" style={{ color: TINTA.secundaria }}>
            <ul className="list-disc ml-4 space-y-0.5">{b.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------- Página ----------------

const { semana: SEMANA_HOY, anio: ANIO_HOY } = semanaISO();
const FILTROS_INICIALES = { year: ANIO_HOY, week_from: Math.max(1, SEMANA_HOY - 7), week_to: SEMANA_HOY };
const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1);

export default function FinanceBoardPage() {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    getFinanceBoard(filtros)
      .then((r) => { if (vigente) { setDatos(r.data); setError(''); } })
      .catch((e) => vigente && setError(Object.values(e.response?.data?.errors || {})[0]?.[0] || 'NO SE PUDO CARGAR EL TABLERO.'))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [filtros, recarga]);

  const cambiar = (e) => {
    const { name, value } = e.target;
    setFiltros((f) => {
      const n = { ...f, [name]: Number(value) };
      if (name === 'week_from' && n.week_from > n.week_to) n.week_to = n.week_from;
      if (name === 'week_to' && n.week_to < n.week_from) n.week_from = n.week_to;
      return n;
    });
  };

  // Solo semanas con movimiento (venta o costo) para no dibujar barras vacías
  const semanas = useMemo(() => (datos?.semanas || []).filter((s) => s.venta || s.costo)
    .map((s) => ({ ...s, etiqueta: `WK${s.week}` })), [datos]);

  const input = 'w-full bg-gray-100 border border-gray-200 rounded-2xl px-3 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
  const label = 'block text-xs font-semibold text-gray-600 uppercase mb-1';
  const t = datos?.totales;
  const clientes = datos?.por_cliente || [];
  const costos = datos?.costos || [];

  const colsSemana = [
    { titulo: 'Semana', valor: (s) => s.etiqueta || 'TOTAL' },
    { titulo: 'Cajas', derecha: true, valor: (s) => fCajas(s.cajas) },
    { titulo: 'Venta', derecha: true, valor: (s) => fUsd(s.venta) },
    { titulo: 'Costo', derecha: true, valor: (s) => fUsd(s.costo) },
    { titulo: 'Ganancia', derecha: true, valor: (s) => fUsd(s.ganancia) },
    { titulo: 'Margen', derecha: true, valor: (s) => fPct(s.margen) },
  ];
  const colsCliente = [
    { titulo: 'Cliente', valor: (c) => c.name || 'TOTAL' },
    { titulo: 'Cajas', derecha: true, valor: (c) => fCajas(c.cajas) },
    { titulo: 'Venta', derecha: true, valor: (c) => fUsd(c.venta) },
    { titulo: 'Costo', derecha: true, valor: (c) => fUsd(c.costo) },
    { titulo: 'Ganancia', derecha: true, valor: (c) => fUsd(c.ganancia) },
    { titulo: 'Margen', derecha: true, valor: (c) => fPct(c.margen) },
    { titulo: '$/caja', derecha: true, valor: (c) => (c.ganancia_por_caja === null ? '—' : fUsd(c.ganancia_por_caja)) },
  ];
  const colsCosto = [
    { titulo: 'Concepto', valor: (c) => c.concepto },
    { titulo: 'Monto', derecha: true, valor: (c) => fUsd(c.monto) },
    { titulo: '% del costo', derecha: true, valor: (c) => fPct(t?.costo > 0 ? (c.monto / t.costo) * 100 : null) },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tablero financiero</h1>
          <p className="text-sm text-gray-500">
            Venta, costos y ganancia de los barcos por semana del pedido
            {datos?.generado && <> · actualizado {datos.generado.slice(11)} del {datos.generado.slice(0, 10).split('-').reverse().join('/')}</>}
          </p>
        </div>
        <button type="button" onClick={() => setRecarga((n) => n + 1)} disabled={cargando}
          className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm disabled:opacity-50">
          <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Filtros en una sola fila */}
      <div className="bg-white rounded-xl shadow p-3 mb-4 grid grid-cols-3 md:grid-cols-6 gap-3">
        <div>
          <label className={label}>Año</label>
          <select name="year" value={filtros.year} onChange={cambiar} className={input}>
            {[ANIO_HOY - 1, ANIO_HOY].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Desde</label>
          <select name="week_from" value={filtros.week_from} onChange={cambiar} className={input}>
            {SEMANAS.map((w) => <option key={w} value={w}>WK{w}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Hasta</label>
          <select name="week_to" value={filtros.week_to} onChange={cambiar} className={input}>
            {SEMANAS.map((w) => <option key={w} value={w}>WK{w}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">{error}</p>}
      {!datos && cargando && <p className="text-sm text-gray-400 py-10 text-center">Cargando tablero…</p>}

      {datos && (
        <>
          {t.barcos_incompletos > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-2 mb-4">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>CIFRAS PRELIMINARES:</strong> {t.barcos_incompletos} de {t.barcos} barcos tienen datos incompletos
                (precio de venta SPOT, tarifa de flete, gastos del viaje o precio real de la fruta). Mientras falten, la ganancia
                y el margen salen más altos de lo real. El detalle está en la lista de barcos, al final.
              </span>
            </div>
          )}

          {/* Indicadores del rango */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <Indicador etiqueta={`Venta WK${datos.rango.week_from}–${datos.rango.week_to}`} valor={fUsd0(t.venta)}
              contexto={`${fCajas(t.cajas)} cajas en ${t.barcos} barcos`} />
            <Indicador etiqueta="Costo total" valor={fUsd0(t.costo)}
              contexto={`Fruta ${fPct(t.costo > 0 ? (t.fruta / t.costo) * 100 : null)} del costo`}
              ayuda="Fruta + materiales (neto de lo cobrado al productor) + fletes + transporte + gastos del viaje." />
            <Indicador etiqueta="Ganancia" valor={fUsd0(t.ganancia)}
              contexto={t.barcos_incompletos > 0 ? 'Preliminar' : 'Con datos completos'}
              tono={t.ganancia < 0 ? 'critico' : t.barcos_incompletos > 0 ? 'alerta' : 'bien'} />
            <Indicador etiqueta="Margen" valor={fPct(t.margen)} contexto="Ganancia ÷ venta"
              tono={t.margen === null ? undefined : t.margen < 0 ? 'critico' : t.barcos_incompletos > 0 ? 'alerta' : 'bien'} />
            <Indicador etiqueta="Ganancia por caja" valor={t.ganancia_por_caja === null ? '—' : fUsd(t.ganancia_por_caja)}
              contexto={`Fruta ${t.cajas > 0 ? fUsd(t.fruta / t.cajas) : '—'} por caja`} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <TarjetaGrafico titulo="Venta y costo por semana" subtitulo="Dólares por semana del pedido"
              vacio={semanas.length ? '' : 'Sin ventas ni costos en el rango.'}
              tabla={<TablaSimple columnas={colsSemana} filas={semanas} alto="max-h-72" pie={t} />}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={semanas} barGap={2} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={TINTA.grilla} />
                  <XAxis dataKey="etiqueta" {...ejeProps} />
                  <YAxis {...ejeProps} tickFormatter={kilo} width={48} />
                  <Tooltip content={<TooltipDinero />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: TINTA.secundaria }} />
                  <Bar dataKey="venta" name="Venta" fill={SERIE[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="costo" name="Costo" fill={SERIE[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </TarjetaGrafico>

            <TarjetaGrafico titulo="Ganancia por semana" subtitulo="Venta − costo; en rojo las semanas con pérdida"
              vacio={semanas.length ? '' : 'Sin ventas ni costos en el rango.'}
              tabla={<TablaSimple columnas={colsSemana} filas={semanas} alto="max-h-72" pie={t} />}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={semanas} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={TINTA.grilla} />
                  <XAxis dataKey="etiqueta" {...ejeProps} />
                  <YAxis {...ejeProps} tickFormatter={kilo} width={48} />
                  <ReferenceLine y={0} stroke="#c3c2b7" />
                  <Tooltip content={<TooltipDinero />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="ganancia" name="Ganancia" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {semanas.map((s) => <Cell key={s.week} fill={s.ganancia < 0 ? ESTADO.critico : SERIE[2]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </TarjetaGrafico>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            <TarjetaGrafico titulo="En qué se va el dinero" subtitulo="Costo del rango por concepto"
              vacio={costos.length ? '' : 'Sin costos en el rango.'}
              tabla={<TablaSimple columnas={colsCosto} filas={costos} />}>
              <ResponsiveContainer width="100%" height={Math.max(160, costos.length * 36)}>
                <BarChart data={costos} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke={TINTA.grilla} />
                  <XAxis type="number" {...ejeProps} tickFormatter={kilo} />
                  <YAxis type="category" dataKey="concepto" {...ejeProps} width={120} />
                  <Tooltip content={<TooltipDinero />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="monto" name="Costo" fill={SERIE[1]} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </TarjetaGrafico>

            <TarjetaGrafico titulo="Por cliente" subtitulo="Ordenado por venta" className="lg:col-span-2"
              vacio={clientes.length ? '' : 'Sin clientes en el rango.'}>
              <TablaSimple columnas={colsCliente} filas={clientes} alto="max-h-80" pie={{ ...t, name: 'TOTAL' }} />
            </TarjetaGrafico>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold" style={{ color: TINTA.primaria }}>Barcos del rango</h2>
            <p className="text-xs mb-3" style={{ color: TINTA.secundaria }}>Abre la flecha para ver qué dato falta en cada barco.</p>
            {datos.barcos.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Sin barcos en el rango.</p>
            ) : (
              <div className="overflow-auto max-h-[28rem]">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-center px-2 py-2 text-xs w-10" style={{ color: TINTA.secundaria }}>#</th>
                      {['', 'Semana', 'Barco', 'Cajas', 'Venta', 'Costo', 'Ganancia', 'Margen', 'Datos'].map((h, i) => (
                        <th key={h || i} className={`px-3 py-2 text-xs uppercase font-semibold whitespace-nowrap ${i >= 3 && i <= 7 ? 'text-right' : 'text-left'}`} style={{ color: TINTA.secundaria }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>{datos.barcos.map((b, i) => <FilaBarco key={b.id} b={b} i={i} />)}</tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
