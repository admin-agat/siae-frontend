// Tablero de operaciones — src/pages/dashboard/DashboardPage.jsx
//
// 29/10/2026: maqueta con datos de ejemplo para mostrar a gerencia.
// 11/11/2026: reemplazada por el Tablero de operaciones con DATOS REALES (GET /boards/operations).
// Todo cuelga de la semana del pedido: pedido → distribución en barcos → compra de fruta → cierre de embarque.
// El cumplimiento de contratos de productores va por semana de compra. Este tablero NO muestra dinero
// (eso irá en el tablero financiero); lo ven Gerencia, Exportaciones y Comercial.
//
// Gráficos con recharts. Reglas (skill dataviz): colores por serie en orden fijo (azul, naranja, verde agua,
// amarillo), un solo eje Y por gráfico, barras finas con punta redondeada, leyenda + tooltip, y cada gráfico
// tiene vista de tabla. Los estados siempre llevan ícono + texto.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { AlertTriangle, CheckCircle2, AlertCircle, Info, Table2, BarChart3, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { getOperationsBoard } from '../../api/boards';
import SelectBuscable from '../../components/common/SelectBuscable';
import { semanaISO } from '../../utils/semana';
import { ETIQUETA_MODALIDAD } from '../../utils/modalidades';

// ---------------- Tokens de gráfico ----------------
const SERIE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']; // slots 1-4 (orden fijo, nunca por ranking)
const TINTA = { primaria: '#0b0b0b', secundaria: '#52514e', tenue: '#898781', grilla: '#e1e0d9' };
const ESTADO = { bien: '#0ca30c', alerta: '#fab219', critico: '#d03b3b' };

const fCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const fPct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toLocaleString('es-EC', { maximumFractionDigits: 1 })} %`);
const pct = (a, b) => (b > 0 ? (a / b) * 100 : null);
const fFecha = (f) => (f ? f.slice(5).split('-').reverse().join('/') : '—');
const kilo = (v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v);
const ejeProps = { tick: { fill: TINTA.tenue, fontSize: 11 }, axisLine: { stroke: '#c3c2b7' }, tickLine: false };

// ---------------- Piezas ----------------

// Tooltip con tintas de texto (nunca el color de la serie en el texto)
function TooltipSIAE({ active, payload, label, sufijo = ' cajas' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-black/10 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold mb-1" style={{ color: TINTA.primaria }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2" style={{ color: TINTA.secundaria }}>
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          {p.name}: <strong style={{ color: TINTA.primaria }}>{fCajas(p.value)}{sufijo}</strong>
        </p>
      ))}
    </div>
  );
}

// Tarjeta de gráfico con botón para ver la misma información como tabla
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
          <button
            type="button"
            onClick={() => setVerTabla((v) => !v)}
            title={verTabla ? 'Ver gráfico' : 'Ver como tabla'}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            {verTabla ? <BarChart3 size={16} /> : <Table2 size={16} />}
          </button>
        )}
      </div>
      {vacio ? <p className="text-sm text-gray-400 py-8 text-center">{vacio}</p> : verTabla ? tabla : children}
    </div>
  );
}

function TablaSimple({ columnas, filas, alto = '' }) {
  return (
    <div className={`overflow-auto ${alto}`}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b">
            {columnas.map((c) => (
              <th key={c.titulo} className={`py-1.5 px-2 text-xs uppercase font-semibold whitespace-nowrap ${c.derecha ? 'text-right' : 'text-left'}`} style={{ color: TINTA.secundaria }}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b last:border-0">
              {columnas.map((c) => (
                <td key={c.titulo} className={`py-1.5 px-2 ${c.derecha ? 'text-right whitespace-nowrap' : ''}`}>{c.valor(f)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Stat tile: etiqueta, valor y una línea de contexto
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

// Estado con ícono + texto (el color nunca va solo)
function Estado({ nivel, texto }) {
  const Icono = nivel === 'bien' ? CheckCircle2 : nivel === 'alerta' ? AlertCircle : AlertTriangle;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: TINTA.primaria }}>
      <Icono size={14} color={ESTADO[nivel]} /> {texto}
    </span>
  );
}

const NIVEL_BARCO = { EMBARCADO: 'bien', COMPLETO: 'bien', COMPRANDO: 'alerta', 'SIN COMPRA': 'critico' };
const NIVEL_ALERTA = { critico: 'critico', alerta: 'alerta', aviso: 'alerta' };
const nivelContrato = (p) => (p === null ? 'alerta' : p >= 95 ? 'bien' : p >= 80 ? 'alerta' : 'critico');

function Alerta({ a }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="border-b last:border-0 py-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setAbierta((v) => !v)} className="text-gray-400 hover:text-gray-600" title="Ver detalle">
          {abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <Estado nivel={NIVEL_ALERTA[a.nivel]} texto={a.nivel === 'critico' ? 'URGENTE' : a.nivel === 'alerta' ? 'REVISAR' : 'AVISO'} />
        <span className="text-sm flex-1" style={{ color: TINTA.primaria }}>{a.titulo}</span>
        <span className="text-sm font-semibold whitespace-nowrap">{fCajas(a.cantidad)}{a.cajas ? <span className="text-xs text-gray-500 font-normal"> · {fCajas(a.cajas)} cajas</span> : null}</span>
        <Link to={a.ruta} className="text-xs text-primario hover:underline whitespace-nowrap">Corregir ›</Link>
      </div>
      {abierta && (
        <ul className="ml-8 mt-1 text-xs space-y-0.5" style={{ color: TINTA.secundaria }}>
          {a.detalle.map((d, i) => <li key={i}>{d}</li>)}
          {a.cantidad > a.detalle.length && <li className="italic">… y {fCajas(a.cantidad - a.detalle.length)} más</li>}
        </ul>
      )}
    </div>
  );
}

// ---------------- Página ----------------

const { semana: SEMANA_HOY, anio: ANIO_HOY } = semanaISO();
const FILTROS_INICIALES = { year: ANIO_HOY, week_from: Math.max(1, SEMANA_HOY - 7), week_to: SEMANA_HOY, customer_id: '', brand_id: '', negotiation_type: '' };
const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1);

export default function DashboardPage() {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '' && v !== null));
    getOperationsBoard(params)
      .then((r) => { if (vigente) { setDatos(r.data); setError(''); } })
      .catch((e) => vigente && setError(Object.values(e.response?.data?.errors || {})[0]?.[0] || 'NO SE PUDO CARGAR EL TABLERO.'))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [filtros, recarga]);

  const cambiar = (e) => {
    const { name, value } = e.target;
    setFiltros((f) => {
      const n = { ...f, [name]: ['year', 'week_from', 'week_to'].includes(name) ? Number(value) : value };
      // el rango nunca queda al revés
      if (name === 'week_from' && n.week_from > n.week_to) n.week_to = n.week_from;
      if (name === 'week_to' && n.week_to < n.week_from) n.week_from = n.week_to;
      return n;
    });
  };

  const semanas = useMemo(() => (datos?.semanas || []).filter((s) => s.tiene_pedido).map((s) => ({
    ...s, etiqueta: `WK${s.week}`, comprado_spot: s.comprado - s.comprado_contrato,
  })), [datos]);

  const input = 'w-full bg-gray-100 border border-gray-200 rounded-2xl px-3 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
  const label = 'block text-xs font-semibold text-gray-600 uppercase mb-1';
  const t = datos?.totales;
  const alertas = datos?.alertas || [];
  const urgentes = alertas.filter((a) => a.nivel === 'critico').length;
  const ultima = [...semanas].reverse()[0];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tablero de operaciones</h1>
          <p className="text-sm text-gray-500">
            Pedido, barcos, compra de fruta y embarque por semana del pedido
            {datos?.generado && <> · actualizado {datos.generado.slice(11)} del {datos.generado.slice(0, 10).split('-').reverse().join('/')}</>}
          </p>
        </div>
        <button type="button" onClick={() => setRecarga((n) => n + 1)} disabled={cargando}
          className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm disabled:opacity-50">
          <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Filtros en una sola fila */}
      <div className="bg-white rounded-xl shadow p-3 mb-4 grid grid-cols-2 md:grid-cols-6 gap-3">
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
        <div>
          <label className={label}>Cliente</label>
          <SelectBuscable name="customer_id" value={filtros.customer_id} onChange={cambiar} className={input}>
            <option value="">TODOS</option>
            {(datos?.filtros.clientes || []).map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </SelectBuscable>
        </div>
        <div>
          <label className={label}>Marca</label>
          <SelectBuscable name="brand_id" value={filtros.brand_id} onChange={cambiar} className={input}>
            <option value="">TODAS</option>
            {(datos?.filtros.marcas || []).map((m) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
          </SelectBuscable>
        </div>
        <div>
          <label className={label}>Negociación</label>
          <select name="negotiation_type" value={filtros.negotiation_type} onChange={cambiar} className={input}>
            <option value="">CONTRATO Y SPOT</option>
            <option value="CONTRATO">CONTRATO</option>
            <option value="SPOT">SPOT</option>
          </select>
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">{error}</p>}
      {!datos && cargando && <p className="text-sm text-gray-400 py-10 text-center">Cargando tablero…</p>}

      {datos && (
        <>
          {t.semanas_sin_compra.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-2 mb-4">
              <AlertCircle size={16} className="shrink-0" />
              Semanas con pedido pero sin compras cargadas en el sistema: {t.semanas_sin_compra.map((w) => `WK${w}`).join(', ')}. Los totales de compra están incompletos.
            </div>
          )}

          {/* Indicadores del rango */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <Indicador etiqueta={`Pedido WK${datos.rango.week_from}–${datos.rango.week_to}`} valor={`${fCajas(t.pedido)} cajas`}
              contexto={ultima ? `WK${ultima.week}: ${fCajas(ultima.pedido)} cajas` : 'Sin pedidos en el rango'} />
            <Indicador etiqueta="Distribuido en barcos" valor={fPct(pct(t.distribuido, t.pedido))}
              contexto={`${fCajas(t.distribuido)} cajas en ${fCajas(t.barcos)} barcos`} tono={t.distribuido >= t.pedido ? 'bien' : 'alerta'} />
            <Indicador etiqueta="Fruta comprada" valor={fPct(pct(t.comprado, t.pedido))}
              contexto={t.comprado >= t.pedido ? `${fCajas(t.comprado)} cajas` : `Faltan ${fCajas(t.pedido - t.comprado)} cajas`}
              tono={t.comprado >= t.pedido ? 'bien' : 'alerta'}
              ayuda={`Comprado ÷ pedido. Meta de los bloques: ${fCajas(t.meta_compra)} cajas; compra sobre la meta: ${fCajas(t.sobre_compra)} cajas.`} />
            <Indicador etiqueta="Embarcado (cierre)" valor={fPct(pct(t.embarcado, t.distribuido_cerrados))}
              contexto={`${fCajas(t.embarcado)} cajas · ${t.barcos_cerrados} de ${t.barcos} barcos con cierre`}
              tono={t.barcos_cerrados < t.barcos ? 'alerta' : 'bien'}
              ayuda="Embarcado ÷ distribuido, solo en los barcos que ya tienen Cierre de embarque. Es parcial hasta que Logística cierre todos." />
            <Indicador etiqueta="Alertas" valor={fCajas(alertas.length)}
              contexto={urgentes ? `${urgentes} urgentes` : alertas.length ? 'Ninguna urgente' : 'Todo en orden'}
              tono={urgentes ? 'critico' : alertas.length ? 'alerta' : 'bien'} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
            {/* G1 Embudo por semana */}
            <TarjetaGrafico
              className="xl:col-span-2"
              titulo="Cajas por semana"
              subtitulo="Pedido de Rusia, distribuido en barcos, fruta comprada y embarcado según el cierre"
              vacio={!semanas.length && 'No hay pedidos en estas semanas.'}
              tabla={<TablaSimple
                columnas={[
                  { titulo: 'Semana', valor: (f) => f.etiqueta },
                  { titulo: 'Pedido', valor: (f) => fCajas(f.pedido), derecha: true },
                  { titulo: 'Distribuido', valor: (f) => fCajas(f.distribuido), derecha: true },
                  { titulo: 'Meta compra', valor: (f) => fCajas(f.meta_compra), derecha: true },
                  { titulo: 'Comprado', valor: (f) => fCajas(f.comprado), derecha: true },
                  { titulo: '% compra', valor: (f) => fPct(pct(f.comprado, f.pedido)), derecha: true },
                  { titulo: 'Embarcado', valor: (f) => fCajas(f.embarcado), derecha: true },
                  { titulo: 'Barcos', valor: (f) => `${f.barcos_cerrados}/${f.barcos} con cierre`, derecha: true },
                ]}
                filas={semanas}
              />}
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={semanas} barGap={2} barCategoryGap="20%" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={TINTA.grilla} />
                    <XAxis dataKey="etiqueta" {...ejeProps} />
                    <YAxis {...ejeProps} axisLine={false} width={48} tickFormatter={kilo} />
                    <Tooltip content={<TooltipSIAE />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: TINTA.secundaria }} />
                    <Bar dataKey="pedido" name="Pedido" fill={SERIE[0]} radius={[4, 4, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="distribuido" name="Distribuido" fill={SERIE[1]} radius={[4, 4, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="comprado" name="Comprado" fill={SERIE[2]} radius={[4, 4, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="embarcado" name="Embarcado" fill={SERIE[3]} radius={[4, 4, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TarjetaGrafico>

            {/* G3 CONTRATO vs SPOT (compra) */}
            <TarjetaGrafico
              titulo="Compra CONTRATO vs SPOT"
              subtitulo="Cajas compradas por semana del pedido"
              vacio={!t.comprado && 'Aún no hay compras cargadas en estas semanas.'}
              tabla={<TablaSimple
                columnas={[
                  { titulo: 'Semana', valor: (f) => f.etiqueta },
                  { titulo: 'Contrato', valor: (f) => fCajas(f.comprado_contrato), derecha: true },
                  { titulo: 'Spot', valor: (f) => fCajas(f.comprado_spot), derecha: true },
                  { titulo: '% contrato', valor: (f) => fPct(pct(f.comprado_contrato, f.comprado)), derecha: true },
                ]}
                filas={semanas}
              />}
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={semanas} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={TINTA.grilla} />
                    <XAxis dataKey="etiqueta" {...ejeProps} />
                    <YAxis {...ejeProps} axisLine={false} width={48} tickFormatter={kilo} />
                    <Tooltip content={<TooltipSIAE />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: TINTA.secundaria }} />
                    <Bar dataKey="comprado_contrato" name="Contrato" stackId="c" fill={SERIE[0]} stroke="#fff" strokeWidth={1} maxBarSize={22} />
                    <Bar dataKey="comprado_spot" name="Spot" stackId="c" fill={SERIE[1]} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TarjetaGrafico>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
            {/* G2 Por cliente */}
            <TarjetaGrafico
              titulo="Pedido y compra por cliente"
              subtitulo="En la tabla, el detalle por marca"
              vacio={!datos.por_cliente.length && 'Sin datos en el rango.'}
              tabla={<TablaSimple
                alto="max-h-72"
                columnas={[
                  { titulo: 'Cliente / marca', valor: (f) => (f.marca ? <span className="pl-3 text-gray-500">{f.marca}</span> : <strong>{f.cliente}</strong>) },
                  { titulo: 'Pedido', valor: (f) => fCajas(f.pedido), derecha: true },
                  { titulo: 'Comprado', valor: (f) => fCajas(f.comprado), derecha: true },
                  { titulo: '%', valor: (f) => fPct(pct(f.comprado, f.pedido)), derecha: true },
                ]}
                filas={datos.por_cliente.flatMap((c) => [c, ...c.marcas])}
              />}
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datos.por_cliente} layout="vertical" barGap={2} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={TINTA.grilla} />
                    <XAxis type="number" {...ejeProps} tickFormatter={kilo} />
                    <YAxis type="category" dataKey="cliente" {...ejeProps} width={110} />
                    <Tooltip content={<TooltipSIAE />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: TINTA.secundaria }} />
                    <Bar dataKey="pedido" name="Pedido" fill={SERIE[0]} radius={[0, 4, 4, 0]} maxBarSize={12} />
                    <Bar dataKey="comprado" name="Comprado" fill={SERIE[2]} radius={[0, 4, 4, 0]} maxBarSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TarjetaGrafico>

            {/* G4 Por puerto */}
            <TarjetaGrafico
              titulo="Por puerto de salida"
              subtitulo="Distribuido en barcos y fruta comprada"
              vacio={!datos.por_puerto.length && 'Sin datos en el rango.'}
              tabla={<TablaSimple
                columnas={[
                  { titulo: 'Puerto', valor: (f) => f.puerto },
                  { titulo: 'Distribuido', valor: (f) => fCajas(f.distribuido), derecha: true },
                  { titulo: 'Comprado', valor: (f) => fCajas(f.comprado), derecha: true },
                ]}
                filas={datos.por_puerto}
              />}
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datos.por_puerto} layout="vertical" barGap={2} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={TINTA.grilla} />
                    <XAxis type="number" {...ejeProps} tickFormatter={kilo} />
                    <YAxis type="category" dataKey="puerto" {...ejeProps} width={110} />
                    <Tooltip content={<TooltipSIAE />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: TINTA.secundaria }} />
                    <Bar dataKey="distribuido" name="Distribuido" fill={SERIE[1]} radius={[0, 4, 4, 0]} maxBarSize={12} />
                    <Bar dataKey="comprado" name="Comprado" fill={SERIE[2]} radius={[0, 4, 4, 0]} maxBarSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TarjetaGrafico>

            {/* G5 Modalidad: pocas categorías → tabla con barra de proporción */}
            <TarjetaGrafico titulo="Bajo cubierta vs contenedor" subtitulo="Cajas pedidas por modalidad de carga"
              vacio={!datos.por_modalidad.length && 'Sin datos en el rango.'}>
              <div className="space-y-3">
                {datos.por_modalidad.map((m) => {
                  const p = pct(m.pedido, t.pedido) || 0;
                  return (
                    <div key={m.modalidad || 'x'}>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: TINTA.primaria }}>{ETIQUETA_MODALIDAD[m.modalidad] || m.modalidad || 'SIN MODALIDAD'}</span>
                        <span style={{ color: TINTA.secundaria }}>{fCajas(m.pedido)} · <strong style={{ color: TINTA.primaria }}>{fPct(p)}</strong></span>
                      </div>
                      <div className="h-2 rounded bg-gray-100 mt-1">
                        <div className="h-2 rounded" style={{ width: `${p}%`, backgroundColor: m.contenedor ? SERIE[1] : SERIE[0] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </TarjetaGrafico>
          </div>

          {/* Alertas */}
          <TarjetaGrafico className="mb-4" titulo="Pendientes por revisar" subtitulo="Reglas automáticas sobre el rango elegido · abre el detalle con la flecha"
            vacio={!alertas.length && 'Sin pendientes en el rango. ✔'}>
            <div className="max-h-96 overflow-auto">
              {alertas.map((a) => <Alerta key={a.codigo} a={a} />)}
            </div>
          </TarjetaGrafico>

          {/* T1 Barcos */}
          <TarjetaGrafico className="mb-4" titulo="Barcos del rango" subtitulo="Distribución de Logística, compra de Comercial y cierre de embarque"
            vacio={!datos.barcos.length && 'No hay barcos en estas semanas.'}>
            <TablaSimple
              alto="max-h-96"
              columnas={[
                { titulo: 'WK', valor: (f) => f.week },
                { titulo: 'Barco', valor: (f) => <span className="font-medium">{f.barco}</span> },
                { titulo: 'Salida', valor: (f) => `${f.puerto || '—'} · ${fFecha(f.departure_date)}` },
                { titulo: 'ETA', valor: (f) => fFecha(f.eta) },
                { titulo: 'Distribuido', valor: (f) => fCajas(f.distribuido), derecha: true },
                { titulo: 'Comprado', valor: (f) => fCajas(f.comprado), derecha: true },
                { titulo: '% compra', valor: (f) => fPct(pct(f.comprado, f.distribuido)), derecha: true },
                { titulo: 'Embarcado', valor: (f) => (f.embarcado ? fCajas(f.embarcado) : '—'), derecha: true },
                { titulo: 'Estado', valor: (f) => <Estado nivel={NIVEL_BARCO[f.estado]} texto={f.estado} /> },
              ]}
              filas={datos.barcos}
            />
          </TarjetaGrafico>

          {/* T2 Contratos */}
          <TarjetaGrafico className="mb-4" titulo="Cumplimiento de contratos de productores"
            subtitulo="Por semana de compra · cupo = cajas semanales × semanas vigentes del rango que ya empezaron · los de menor cumplimiento primero"
            vacio={!datos.contratos.length && 'No hay contratos vigentes en estas semanas.'}>
            <TablaSimple
              alto="max-h-96"
              columnas={[
                { titulo: 'Vendedor', valor: (f) => <span className="font-medium">{f.vendedor}</span> },
                { titulo: 'N°', valor: (f) => f.numero },
                { titulo: 'Finca', valor: (f) => f.finca || '—' },
                { titulo: 'Cupo semanal', valor: (f) => fCajas(f.cupo_semanal), derecha: true },
                { titulo: 'Semanas', valor: (f) => f.semanas, derecha: true },
                { titulo: 'Cupo del rango', valor: (f) => fCajas(f.cupo_rango), derecha: true },
                { titulo: 'Comprado', valor: (f) => fCajas(f.comprado), derecha: true },
                { titulo: 'Cumplimiento', valor: (f) => <Estado nivel={nivelContrato(f.porcentaje)} texto={fPct(f.porcentaje)} /> },
                { titulo: 'Sem. sin compra', valor: (f) => f.semanas_sin_compra, derecha: true },
                { titulo: 'Última semana', valor: (f) => (f.ultima_semana ? `WK${f.ultima_semana}: ${fCajas(f.comprado_ultima)}` : '—'), derecha: true },
              ]}
              filas={datos.contratos}
            />
          </TarjetaGrafico>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* T3 Vendedores */}
            <TarjetaGrafico titulo="Vendedores con más cajas" subtitulo="Productores y comercializadoras · los 15 primeros"
              vacio={!datos.vendedores.length && 'Aún no hay compras cargadas en estas semanas.'}>
              <TablaSimple
                columnas={[
                  { titulo: 'Vendedor', valor: (f) => f.vendedor },
                  { titulo: 'Tipo', valor: (f) => <span className="text-xs text-gray-500">{f.tipo}</span> },
                  { titulo: 'Cajas', valor: (f) => fCajas(f.cajas), derecha: true },
                  { titulo: '% del total', valor: (f) => fPct(f.porcentaje), derecha: true },
                  { titulo: 'Compras', valor: (f) => f.compras, derecha: true },
                  { titulo: 'Semanas', valor: (f) => f.semanas, derecha: true },
                ]}
                filas={datos.vendedores}
              />
            </TarjetaGrafico>

            {/* T4 Comerciales */}
            <TarjetaGrafico titulo="Compra por comercial"
              subtitulo="Una compra con dos comerciales cuenta para los dos: la suma puede pasar el total comprado"
              vacio={!datos.comerciales.length && 'Aún no hay compras cargadas en estas semanas.'}>
              <TablaSimple
                columnas={[
                  { titulo: 'Comercial', valor: (f) => f.comercial },
                  { titulo: 'Cajas', valor: (f) => fCajas(f.cajas), derecha: true },
                  { titulo: 'Compras', valor: (f) => f.compras, derecha: true },
                  { titulo: 'Vendedores', valor: (f) => f.vendedores, derecha: true },
                ]}
                filas={datos.comerciales}
              />
            </TarjetaGrafico>
          </div>
        </>
      )}
    </div>
  );
}
