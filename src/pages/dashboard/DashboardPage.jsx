// Dashboard gerencial — VISTA DE DEMOSTRACIÓN (datos de ejemplo)
// Ubicación: src/pages/dashboard/DashboardPage.jsx
//
// 29/10/2026: maqueta para mostrar a gerencia cómo quedará el tablero. TODOS los números son
// de ejemplo (constantes abajo). Cuando haya operación real, cada bloque se conecta a su
// endpoint: pedido/barcos/compras (customer-orders), tarjas y liquidaciones (settlements),
// stock (inventory-movements/stock-general).
//
// Gráficos con recharts. Reglas (skill dataviz): colores por serie en orden fijo
// (azul, naranja, verde agua — validados para daltonismo), un solo eje Y por gráfico,
// barras finas con punta redondeada, leyenda + tooltip, y cada gráfico tiene vista de tabla.
import { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { AlertTriangle, CheckCircle2, AlertCircle, Table2, BarChart3 } from 'lucide-react';

// ---------------- Tokens de gráfico ----------------
const SERIE = ['#2a78d6', '#eb6834', '#1baf7a']; // slots 1-3 (orden fijo, nunca por ranking)
const TINTA = { primaria: '#0b0b0b', secundaria: '#52514e', tenue: '#898781', grilla: '#e1e0d9' };
const ESTADO = { bien: '#0ca30c', alerta: '#fab219', critico: '#d03b3b' };

const fCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const fDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------------- DATOS DE EJEMPLO ----------------
const SEMANA_ACTUAL = 46;

const SEMANAS = [
  { semana: 'S39', pedido: 138000, comprado: 136500, embarcado: 135200 },
  { semana: 'S40', pedido: 142000, comprado: 142000, embarcado: 141100 },
  { semana: 'S41', pedido: 145000, comprado: 143800, embarcado: 143800 },
  { semana: 'S42', pedido: 140000, comprado: 140000, embarcado: 139400 },
  { semana: 'S43', pedido: 148000, comprado: 146200, embarcado: 145900 },
  { semana: 'S44', pedido: 152000, comprado: 151000, embarcado: 150200 },
  { semana: 'S45', pedido: 150000, comprado: 150000, embarcado: 149300 },
  { semana: 'S46', pedido: 150000, comprado: 142300, embarcado: 118000 },
];

const PRECIOS = [
  { semana: 'S39', oficial: 7.5, real: 7.05 },
  { semana: 'S40', oficial: 7.5, real: 7.1 },
  { semana: 'S41', oficial: 7.5, real: 7.15 },
  { semana: 'S42', oficial: 7.5, real: 7.0 },
  { semana: 'S43', oficial: 7.5, real: 7.1 },
  { semana: 'S44', oficial: 7.5, real: 7.2 },
  { semana: 'S45', oficial: 7.5, real: 7.15 },
  { semana: 'S46', oficial: 7.5, real: 7.1 },
];

const CLIENTES = [
  { cliente: 'RVI', cajas: 96000 },
  { cliente: 'GT', cajas: 44000 },
  { cliente: 'GRAND TRADE - JSC', cajas: 10000 },
];

const PRODUCTORES = [
  { nombre: 'PEPE PÉREZ', cajas: 18500, rechazo: 1.8 },
  { nombre: 'ADELA VALLEJO', cajas: 15200, rechazo: 2.4 },
  { nombre: 'ADRIAN FISCHERT', cajas: 13800, rechazo: 6.1 },
  { nombre: 'BANANERA EL ORO', cajas: 12100, rechazo: 3.2 },
  { nombre: 'FINCA SAN JOSÉ', cajas: 10400, rechazo: 9.8 },
  { nombre: 'AGRÍCOLA LA FLORIDA', cajas: 9600, rechazo: 2.1 },
  { nombre: 'COMERCIALIZADORA DEL SUR', cajas: 8900, rechazo: 4.7 },
];

const BARCOS = [
  { barco: 'COOL EXPLORER', viaje: 'UNI1406', naviera: 'UNIREEFER', salida: 'GUAYAQUIL', zarpe: '10/11', eta: '02/12', cajas: 64000, estado: 'EMBARCADO' },
  { barco: 'SNOW FLOWER', viaje: 'UNI1404', naviera: 'UNIREEFER', salida: 'PUERTO BOLÍVAR', zarpe: '11/11', eta: '03/12', cajas: 54000, estado: 'EMBARCADO' },
  { barco: 'WILD PEONY', viaje: 'UNI1405', naviera: 'UNIREEFER', salida: 'GUAYAQUIL', zarpe: '13/11', eta: '05/12', cajas: 32000, estado: 'CARGANDO' },
];

const STOCK_CRITICO = [
  { material: 'TAPA AGAT D. ELENA IBA ROJA', bodega: 'BODEGA MACHALA', existencia: 4200, minimo: 15000 },
  { material: 'FUNDA SIN LOGO 38 X 51', bodega: 'BODEGA MACHALA', existencia: 9800, minimo: 20000 },
  { material: 'LIGAS', bodega: 'BODEGA GUAYAQUIL', existencia: 1200, minimo: 3000 },
];

const PAGOS = { pendiente80: 312450.0, pendiente20: 78112.5, anticipos: 18500.0, productores: 23 };

// ---------------- Piezas ----------------

// Tooltip con tintas de texto (nunca el color de la serie en el texto)
function TooltipSIAE({ active, payload, label, formato = fCajas, sufijo = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-black/10 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold mb-1" style={{ color: TINTA.primaria }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2" style={{ color: TINTA.secundaria }}>
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          {p.name}: <strong style={{ color: TINTA.primaria }}>{formato(p.value)}{sufijo}</strong>
        </p>
      ))}
    </div>
  );
}

// Tarjeta de gráfico con botón para ver la misma información como tabla
function TarjetaGrafico({ titulo, subtitulo, tabla, children, className = '' }) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <div className={`bg-white rounded-xl shadow p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="font-semibold" style={{ color: TINTA.primaria }}>{titulo}</h2>
          {subtitulo && <p className="text-xs" style={{ color: TINTA.secundaria }}>{subtitulo}</p>}
        </div>
        {tabla && (
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
      {verTabla ? tabla : children}
    </div>
  );
}

function TablaSimple({ columnas, filas }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {columnas.map((c) => (
              <th key={c.titulo} className={`py-1.5 px-2 text-xs uppercase font-semibold ${c.derecha ? 'text-right' : 'text-left'}`} style={{ color: TINTA.secundaria }}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b last:border-0">
              {columnas.map((c) => (
                <td key={c.titulo} className={`py-1.5 px-2 ${c.derecha ? 'text-right' : ''}`}>{c.valor(f)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Stat tile: etiqueta, valor y una línea de contexto
function Indicador({ etiqueta, valor, contexto, tono }) {
  const colorContexto = tono === 'bien' ? '#006300' : tono === 'alerta' ? '#8a5a00' : TINTA.secundaria;
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <p className="text-xs uppercase font-semibold" style={{ color: TINTA.secundaria }}>{etiqueta}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: TINTA.primaria }}>{valor}</p>
      {contexto && <p className="text-xs mt-1 font-medium" style={{ color: colorContexto }}>{contexto}</p>}
    </div>
  );
}

// Estado con ícono + texto (el color nunca va solo)
function Estado({ nivel, texto }) {
  const Icono = nivel === 'bien' ? CheckCircle2 : nivel === 'alerta' ? AlertCircle : AlertTriangle;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: TINTA.primaria }}>
      <Icono size={14} color={ESTADO[nivel]} /> {texto}
    </span>
  );
}

const nivelRechazo = (r) => (r < 4 ? 'bien' : r < 8 ? 'alerta' : 'critico');
const textoRechazo = { bien: 'NORMAL', alerta: 'VIGILAR', critico: 'ALTO' };

const ejeProps = { tick: { fill: TINTA.tenue, fontSize: 11 }, axisLine: { stroke: '#c3c2b7' }, tickLine: false };

// ---------------- Página ----------------

export default function DashboardPage() {
  const actual = SEMANAS[SEMANAS.length - 1];
  const avanceCompra = (actual.comprado / actual.pedido) * 100;
  const precioSemana = PRECIOS[PRECIOS.length - 1];
  const ahorroSemana = (precioSemana.oficial - precioSemana.real) * actual.comprado;
  const totalProd = PRODUCTORES.reduce((s, p) => s + p.cajas, 0);
  const rechazoPromedio = PRODUCTORES.reduce((s, p) => s + p.rechazo * p.cajas, 0) / totalProd;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard gerencial</h1>
          <p className="text-sm text-gray-500">Semana {SEMANA_ACTUAL} / 2026 · pedido, compra de fruta, embarques, pagos y materiales</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-2 mb-4">
        <AlertCircle size={16} className="shrink-0" />
        VISTA DE DEMOSTRACIÓN: todos los números son de ejemplo. Se conectarán a los datos reales cuando la operación esté cargada en el sistema.
      </div>

      {/* Indicadores de la semana */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Indicador etiqueta="Pedido de la semana" valor={`${fCajas(actual.pedido)} cajas`} contexto="Correo de Rusia del 03/11" />
        <Indicador etiqueta="Fruta comprada" valor={`${avanceCompra.toFixed(1)} %`} contexto={`Faltan ${fCajas(actual.pedido - actual.comprado)} cajas`} tono="alerta" />
        <Indicador etiqueta="Embarcado" valor={`${fCajas(actual.embarcado)} cajas`} contexto={`${BARCOS.length} barcos esta semana`} />
        <Indicador etiqueta="Ahorro vs precio oficial" valor={`$ ${fDinero(ahorroSemana)}`} contexto={`Real $ ${fDinero(precioSemana.real)} vs oficial $ ${fDinero(precioSemana.oficial)}`} tono="bien" />
        <Indicador etiqueta="Rechazo en puerto" valor={`${rechazoPromedio.toFixed(1)} %`} contexto="Promedio ponderado por cajas" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Cajas por semana */}
        <TarjetaGrafico
          className="xl:col-span-2"
          titulo="Cajas por semana"
          subtitulo="Pedido de Rusia, fruta comprada por Comercial y cajas embarcadas"
          tabla={<TablaSimple
            columnas={[
              { titulo: 'Semana', valor: (f) => f.semana },
              { titulo: 'Pedido', valor: (f) => fCajas(f.pedido), derecha: true },
              { titulo: 'Comprado', valor: (f) => fCajas(f.comprado), derecha: true },
              { titulo: 'Embarcado', valor: (f) => fCajas(f.embarcado), derecha: true },
            ]}
            filas={SEMANAS}
          />}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SEMANAS} barGap={2} barCategoryGap="24%" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={TINTA.grilla} />
                <XAxis dataKey="semana" {...ejeProps} />
                <YAxis {...ejeProps} axisLine={false} width={56} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip content={<TooltipSIAE />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: TINTA.secundaria }} />
                <Bar dataKey="pedido" name="Pedido" fill={SERIE[0]} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="comprado" name="Comprado" fill={SERIE[1]} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="embarcado" name="Embarcado" fill={SERIE[2]} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TarjetaGrafico>

        {/* Cajas por cliente */}
        <TarjetaGrafico
          titulo={`Cajas por cliente — S${SEMANA_ACTUAL}`}
          subtitulo="Reparto del pedido de la semana"
          tabla={<TablaSimple
            columnas={[
              { titulo: 'Cliente', valor: (f) => f.cliente },
              { titulo: 'Cajas', valor: (f) => fCajas(f.cajas), derecha: true },
              { titulo: '%', valor: (f) => `${((f.cajas / actual.pedido) * 100).toFixed(1)} %`, derecha: true },
            ]}
            filas={CLIENTES}
          />}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CLIENTES} layout="vertical" margin={{ top: 8, right: 56, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={TINTA.grilla} />
                <XAxis type="number" {...ejeProps} tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="cliente" {...ejeProps} width={120} />
                <Tooltip content={<TooltipSIAE />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
                <Bar dataKey="cajas" name="Cajas" fill={SERIE[0]} radius={[0, 4, 4, 0]} maxBarSize={22}
                  label={{ position: 'right', fill: TINTA.secundaria, fontSize: 11, formatter: (v) => fCajas(v) }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TarjetaGrafico>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Precio oficial vs real */}
        <TarjetaGrafico
          titulo="Precio por caja: oficial vs real"
          subtitulo="Promedio pagado al productor por semana (USD)"
          tabla={<TablaSimple
            columnas={[
              { titulo: 'Semana', valor: (f) => f.semana },
              { titulo: 'Oficial', valor: (f) => `$ ${fDinero(f.oficial)}`, derecha: true },
              { titulo: 'Real', valor: (f) => `$ ${fDinero(f.real)}`, derecha: true },
              { titulo: 'Dif.', valor: (f) => `$ ${fDinero(f.real - f.oficial)}`, derecha: true },
            ]}
            filas={PRECIOS}
          />}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={PRECIOS} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={TINTA.grilla} />
                <XAxis dataKey="semana" {...ejeProps} />
                <YAxis {...ejeProps} axisLine={false} width={48} domain={[6.8, 7.6]} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                <Tooltip content={<TooltipSIAE formato={(v) => `$ ${fDinero(v)}`} />} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: TINTA.secundaria }} />
                <Line type="monotone" dataKey="oficial" name="Oficial (ministerio)" stroke={SERIE[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="real" name="Real pagado" stroke={SERIE[1]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TarjetaGrafico>

        {/* Top productores */}
        <TarjetaGrafico
          className="xl:col-span-2"
          titulo={`Productores — cajas compradas S${SEMANA_ACTUAL}`}
          subtitulo="Los 7 que más venden esta semana"
          tabla={<TablaSimple
            columnas={[
              { titulo: 'Productor', valor: (f) => f.nombre },
              { titulo: 'Cajas', valor: (f) => fCajas(f.cajas), derecha: true },
              { titulo: '% de la semana', valor: (f) => `${((f.cajas / actual.comprado) * 100).toFixed(1)} %`, derecha: true },
            ]}
            filas={PRODUCTORES}
          />}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PRODUCTORES} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={TINTA.grilla} />
                <XAxis type="number" {...ejeProps} tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="nombre" {...ejeProps} width={170} />
                <Tooltip content={<TooltipSIAE />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
                <Bar dataKey="cajas" name="Cajas" fill={SERIE[0]} radius={[0, 4, 4, 0]} maxBarSize={16}
                  label={{ position: 'right', fill: TINTA.secundaria, fontSize: 11, formatter: (v) => fCajas(v) }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TarjetaGrafico>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Barcos de la semana */}
        <TarjetaGrafico titulo={`Barcos de la semana ${SEMANA_ACTUAL}`} subtitulo="Distribución de Logística">
          <TablaSimple
            columnas={[
              { titulo: 'Barco', valor: (f) => <span className="font-medium">{f.barco} <span className="text-xs text-gray-400">{f.viaje}</span></span> },
              { titulo: 'Salida', valor: (f) => `${f.salida} · ${f.zarpe}` },
              { titulo: 'ETA', valor: (f) => f.eta },
              { titulo: 'Cajas', valor: (f) => fCajas(f.cajas), derecha: true },
              { titulo: 'Estado', valor: (f) => <Estado nivel={f.estado === 'EMBARCADO' ? 'bien' : 'alerta'} texto={f.estado} /> },
            ]}
            filas={BARCOS}
          />
        </TarjetaGrafico>

        {/* Calidad */}
        <TarjetaGrafico titulo="Calidad: rechazo en puerto por productor" subtitulo="Según tarjas · normal < 4 %, vigilar 4–8 %, alto > 8 %">
          <TablaSimple
            columnas={[
              { titulo: 'Productor', valor: (f) => f.nombre },
              { titulo: 'Cajas', valor: (f) => fCajas(f.cajas), derecha: true },
              { titulo: 'Rechazo', valor: (f) => `${f.rechazo.toFixed(1)} %`, derecha: true },
              { titulo: 'Estado', valor: (f) => <Estado nivel={nivelRechazo(f.rechazo)} texto={textoRechazo[nivelRechazo(f.rechazo)]} /> },
            ]}
            filas={[...PRODUCTORES].sort((a, b) => b.rechazo - a.rechazo)}
          />
        </TarjetaGrafico>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Pagos a productores */}
        <TarjetaGrafico titulo="Pagos a productores" subtitulo="Liquidaciones pendientes de pago">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs uppercase font-semibold" style={{ color: TINTA.secundaria }}>Primer pago (80 % / 100 %)</p>
              <p className="text-xl font-bold" style={{ color: TINTA.primaria }}>$ {fDinero(PAGOS.pendiente80)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs uppercase font-semibold" style={{ color: TINTA.secundaria }}>Segundo pago (20 %)</p>
              <p className="text-xl font-bold" style={{ color: TINTA.primaria }}>$ {fDinero(PAGOS.pendiente20)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs uppercase font-semibold" style={{ color: TINTA.secundaria }}>Anticipos por descontar</p>
              <p className="text-xl font-bold" style={{ color: TINTA.primaria }}>$ {fDinero(PAGOS.anticipos)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs uppercase font-semibold" style={{ color: TINTA.secundaria }}>Productores por pagar</p>
              <p className="text-xl font-bold" style={{ color: TINTA.primaria }}>{PAGOS.productores}</p>
            </div>
          </div>
        </TarjetaGrafico>

        {/* Stock crítico */}
        <TarjetaGrafico titulo="Materiales bajo el mínimo" subtitulo="Para comprar antes del próximo despacho">
          <TablaSimple
            columnas={[
              { titulo: 'Material', valor: (f) => f.material },
              { titulo: 'Bodega', valor: (f) => f.bodega },
              { titulo: 'Existencia', valor: (f) => fCajas(f.existencia), derecha: true },
              { titulo: 'Mínimo', valor: (f) => fCajas(f.minimo), derecha: true },
              { titulo: 'Estado', valor: (f) => <Estado nivel={f.existencia / f.minimo < 0.4 ? 'critico' : 'alerta'} texto={f.existencia / f.minimo < 0.4 ? 'CRÍTICO' : 'BAJO'} /> },
            ]}
            filas={STOCK_CRITICO}
          />
        </TarjetaGrafico>
      </div>
    </div>
  );
}
