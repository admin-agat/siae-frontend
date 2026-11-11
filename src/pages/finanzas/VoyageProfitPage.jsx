// Ganancia por viaje (FINANZAS / GERENCIA) — src/pages/finanzas/VoyageProfitPage.jsx
// 02/11/2026: por cada viaje de la semana y por cliente:
//   venta − fruta − materiales netos (despachado − cobrado al productor) − fletes − otros gastos
//   + transporte descontado al productor = ganancia.
// Venta y cajas salen del Cierre de embarque (si aún no hay cierre, de la Distribución en barcos);
// la fruta, de las compras con sus tarjas. Si falta un precio o una tarifa, el viaje sale INCOMPLETO.
import { useState, useEffect } from 'react';
import { AlertTriangle, Ship } from 'lucide-react';
import { getCustomerOrders } from '../../api/customerOrders';
import { getVoyageProfit } from '../../api/voyageCosts';
import SelectBuscable from '../../components/common/SelectBuscable';

const dinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cajas = (n) => Number(n || 0).toLocaleString('es-EC');
const pct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toLocaleString('es-EC', { maximumFractionDigits: 1 })} %`);
const fecha = (f) => (f ? f.split('-').reverse().join('/') : '—');
const matNetos = (x) => x.materiales - x.materiales_recuperados;
const fletes = (x) => x.flete_contenedor + x.flete_bajo_cubierta;

export default function VoyageProfitPage() {
  const [pedidos, setPedidos] = useState([]);
  const [pedidoId, setPedidoId] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getCustomerOrders({ status: true }).then((r) => {
      const lista = Array.isArray(r.data) ? r.data : (r.data?.data || []);
      setPedidos(lista);
      if (lista[0]) setPedidoId(String(lista[0].id));
    }).catch(() => setError('NO SE PUDIERON CARGAR LAS SEMANAS.'));
  }, []);

  useEffect(() => {
    if (!pedidoId) return;
    let vigente = true;
    getVoyageProfit(pedidoId)
      .then((r) => { if (vigente) { setDatos(r.data); setError(''); } })
      .catch(() => vigente && setError('NO SE PUDO CALCULAR LA GANANCIA.'));
    return () => { vigente = false; };
  }, [pedidoId]);

  const input = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
  const th = 'px-3 py-2 uppercase text-xs whitespace-nowrap';
  const color = (n) => (n < 0 ? 'text-red-600' : 'text-green-700');
  const t = datos?.total;

  const fila = (x, negrita = false) => (
    <>
      <td className={`px-3 py-2 text-right ${negrita ? 'font-semibold' : ''}`}>{cajas(x.cajas)}</td>
      <td className="px-3 py-2 text-right">$ {dinero(x.venta)}</td>
      <td className="px-3 py-2 text-right">$ {dinero(x.fruta)}</td>
      <td className="px-3 py-2 text-right" title={`Despachado $ ${dinero(x.materiales)} − cobrado al productor $ ${dinero(x.materiales_recuperados)}`}>$ {dinero(matNetos(x))}</td>
      <td className="px-3 py-2 text-right" title={`Contenedor $ ${dinero(x.flete_contenedor)} + bajo cubierta $ ${dinero(x.flete_bajo_cubierta)}`}>$ {dinero(fletes(x))}</td>
      <td className="px-3 py-2 text-right" title={x.gastos_detalle ? Object.entries(x.gastos_detalle).map(([k, v]) => `${datos.categories[k] || k}: $ ${dinero(v)}`).join('\n') : ''}>$ {dinero(x.gastos)}</td>
      {/* 11/11/2026: neto = descontado al productor − reconocido al productor */}
      <td className={`px-3 py-2 text-right ${(x.transporte_recuperado - (x.transporte_reconocido || 0)) < 0 ? 'text-red-600' : ''}`}
        title={`Descontado al productor $ ${dinero(x.transporte_recuperado)} − reconocido al productor $ ${dinero(x.transporte_reconocido || 0)}`}>$ {dinero(x.transporte_recuperado - (x.transporte_reconocido || 0))}</td>
      <td className={`px-3 py-2 text-right font-bold ${color(x.ganancia)}`}>$ {dinero(x.ganancia)}</td>
      <td className={`px-3 py-2 text-right ${color(x.ganancia)}`}>{pct(x.margen)}</td>
    </>
  );

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Ganancia por viaje</h1>
          <p className="text-sm text-gray-500">Venta menos fruta, materiales, fletes y gastos de cada nave, por cliente</p>
        </div>
        <div className="w-56">
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Semana</label>
          <SelectBuscable value={pedidoId} onChange={(e) => setPedidoId(e.target.value)} className={input}>
            {pedidos.map((p) => <option key={p.id} value={String(p.id)}>SEMANA {p.week} / {p.year}</option>)}
          </SelectBuscable>
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">{error}</p>}

      {t && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow p-4"><p className="text-xs text-gray-500 uppercase">Venta de la semana</p><p className="text-xl font-bold text-gray-800">$ {dinero(t.venta)}</p><p className="text-xs text-gray-500">{cajas(t.cajas)} cajas</p></div>
          <div className="bg-white rounded-xl shadow p-4"><p className="text-xs text-gray-500 uppercase">Costos</p><p className="text-xl font-bold text-gray-800">$ {dinero(t.venta - t.ganancia)}</p><p className="text-xs text-gray-500">Fruta $ {dinero(t.fruta)} · fletes $ {dinero(fletes(t))}</p></div>
          <div className="bg-white rounded-xl shadow p-4"><p className="text-xs text-gray-500 uppercase">Ganancia</p><p className={`text-xl font-bold ${color(t.ganancia)}`}>$ {dinero(t.ganancia)}</p><p className="text-xs text-gray-500">Margen {pct(t.margen)}</p></div>
          <div className={`rounded-xl shadow p-4 ${t.incompleto ? 'bg-amber-50 border border-amber-200' : 'bg-white'}`}>
            <p className="text-xs text-gray-500 uppercase">Estado</p>
            <p className={`text-base font-bold ${t.incompleto ? 'text-amber-700' : 'text-green-700'}`}>{t.incompleto ? 'INCOMPLETO' : 'COMPLETO'}</p>
            <p className="text-xs text-gray-500">{t.incompleto ? 'Faltan precios o fletes: la ganancia puede cambiar' : 'Todos los datos registrados'}</p>
          </div>
        </div>
      )}

      {datos && datos.shipments.length === 0 && (
        <p className="bg-white rounded-xl shadow p-6 text-sm text-gray-500">Esta semana no tiene barcos.</p>
      )}

      <div className="space-y-4">
        {datos?.shipments.map((v) => (
          <div key={v.id} className="bg-white rounded-xl shadow overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-primario-claro border-b">
              <div>
                <p className="font-bold text-gray-800 flex items-center gap-2"><Ship size={16} className="text-primario" /> {v.name}</p>
                <p className="text-xs text-gray-600">Zarpe {fecha(v.departure_date)} · Por contenedor {v.costs.container_rate === null ? '—' : `$ ${dinero(v.costs.container_rate)}`} · Bajo cubierta {v.costs.under_deck_amount === null ? '—' : `$ ${dinero(v.costs.under_deck_amount)}`}</p>
              </div>
              <p className={`text-lg font-bold ${color(v.total.ganancia)}`}>$ {dinero(v.total.ganancia)} <span className="text-sm font-semibold">({pct(v.total.margen)})</span></p>
            </div>
            {(v.avisos.length > 0 || v.customers.some((c) => c.avisos.length)) && (
              <div className="px-4 py-2 bg-amber-50 text-amber-800 text-xs space-y-0.5 border-b">
                {v.avisos.map((a) => <p key={a} className="flex items-center gap-1"><AlertTriangle size={12} /> {a}</p>)}
                {v.customers.flatMap((c) => c.avisos.map((a) => <p key={c.customer_id + a} className="flex items-center gap-1"><AlertTriangle size={12} /> {c.name}: {a}</p>))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1050px]">
                <thead className="text-gray-500 border-b">
                  <tr>
                    <th className={`${th} text-left`}>Cliente</th>
                    <th className={`${th} text-right`}>Cajas</th>
                    <th className={`${th} text-right`}>Venta</th>
                    <th className={`${th} text-right`}>Fruta</th>
                    <th className={`${th} text-right`} title="Despachado a los productores − lo que se les cobra al liquidar">Materiales netos</th>
                    <th className={`${th} text-right`}>Fletes</th>
                    <th className={`${th} text-right`}>Otros gastos</th>
                    <th className={`${th} text-right`} title="Transporte descontado al productor menos el que se le reconoce cuando él lo pone">± Transporte</th>
                    <th className={`${th} text-right`}>Ganancia</th>
                    <th className={`${th} text-right`}>Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {v.customers.map((c) => (
                    <tr key={c.customer_id} className="border-b">
                      <td className="px-3 py-2 font-medium">
                        {c.name}
                        <span className="block text-[11px] font-normal text-gray-500">
                          {c.precio_promedio === null ? 'Sin precio de venta' : `Precio prom. $ ${dinero(c.precio_promedio)}`} · {c.fuente === 'CIERRE' ? 'según cierre' : c.fuente === 'DISTRIBUCION' ? 'según distribución' : 'sin carga'}
                        </span>
                      </td>
                      {fila(c)}
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-3 py-2">TOTAL DEL VIAJE</td>
                    {fila(v.total, true)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-500 mt-3">Pasa el cursor sobre Materiales, Fletes y Otros gastos para ver el detalle. Los gastos se registran en Finanzas → Gastos del viaje.</p>
    </div>
  );
}
