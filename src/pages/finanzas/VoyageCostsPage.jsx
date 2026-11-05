// Gastos del viaje (FINANZAS) — src/pages/finanzas/VoyageCostsPage.jsx
// 02/11/2026: cada nave cobra distinto. Por cada viaje de la semana se registra lo que cobra la nave
// por contenedor (solo cuenta en ventas CFR/CIF: en FOB el flete lo paga el cliente), el flete total
// bajo cubierta y los demás gastos con su factura (de todo el viaje o de un cliente).
// La ganancia se ve en Finanzas → Ganancia por viaje.
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Ship } from 'lucide-react';
import { getCustomerOrders } from '../../api/customerOrders';
import { getThirdParties } from '../../api/thirdParties';
import { getVoyageCosts, getVoyageCost, saveVoyageCost } from '../../api/voyageCosts';
import SelectBuscable from '../../components/common/SelectBuscable';
import ToastFlotante from '../../components/common/ToastFlotante';
import CampoNumero from '../../components/common/CampoNumero';

const dinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cajas = (n) => Number(n || 0).toLocaleString('es-EC', { maximumFractionDigits: 2 });
const texto = (v) => (v === null || v === undefined ? '' : String(v));
const fecha = (f) => (f ? f.split('-').reverse().join('/') : '—');

let contador = 0;
const gastoVacio = () => ({ _key: `g-${++contador}`, id: null, category: 'PUERTO_TRAMITES', customer_id: '', description: '', supplier_id: '', invoice_number: '', invoice_date: '', amount: '' });
const gastoDesdeBackend = (g) => ({
  _key: `g-${g.id}`, id: g.id, category: g.category, customer_id: texto(g.customer_id), description: texto(g.description),
  supplier_id: texto(g.supplier_id), invoice_number: texto(g.invoice_number), invoice_date: texto(g.invoice_date), amount: texto(g.amount),
});

export default function VoyageCostsPage() {
  const [pedidos, setPedidos] = useState([]);
  const [pedidoId, setPedidoId] = useState('');
  const [barcos, setBarcos] = useState([]);
  const [barcoId, setBarcoId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [form, setForm] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    Promise.all([getCustomerOrders({ status: true }), getThirdParties({ type: 'PROVEEDOR', status: 1 })]).then(([rp, rt]) => {
      const lista = Array.isArray(rp.data) ? rp.data : (rp.data?.data || []);
      setPedidos(lista);
      setProveedores(Array.isArray(rt.data) ? rt.data : []);
      if (lista[0]) setPedidoId(String(lista[0].id));
    }).catch(() => setErrores(['NO SE PUDIERON CARGAR LAS SEMANAS.']));
  }, []);

  const cargarBarcos = (id) => getVoyageCosts(id).then((r) => setBarcos(r.data)).catch(() => setBarcos([]));
  useEffect(() => {
    if (!pedidoId) return;
    let vigente = true;
    getVoyageCosts(pedidoId).then((r) => { if (vigente) { setBarcos(r.data); setBarcoId(null); setDetalle(null); setForm(null); } }).catch(() => vigente && setBarcos([]));
    return () => { vigente = false; };
  }, [pedidoId]);

  const aplicarDetalle = (d) => {
    setDetalle(d);
    setForm({
      container_rate: texto(d.costs.container_rate), under_deck_amount: texto(d.costs.under_deck_amount), notes: texto(d.costs.notes),
      expenses: d.expenses.map(gastoDesdeBackend),
    });
  };

  const abrirBarco = (id) => {
    setBarcoId(id); setErrores([]); setDetalle(null); setForm(null);
    getVoyageCost(id).then((r) => aplicarDetalle(r.data)).catch(() => setErrores(['NO SE PUDO CARGAR EL VIAJE.']));
  };

  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const cambiarGasto = (key, campo, valor) => setForm((f) => ({ ...f, expenses: f.expenses.map((g) => (g._key === key ? { ...g, [campo]: campo === 'description' || campo === 'invoice_number' ? valor.toUpperCase() : valor } : g)) }));
  const agregarGasto = () => setForm((f) => ({ ...f, expenses: [...f.expenses, gastoVacio()] }));
  const quitarGasto = (key) => setForm((f) => ({ ...f, expenses: f.expenses.filter((g) => g._key !== key) }));

  const guardar = async () => {
    const faltan = [];
    form.expenses.forEach((g, i) => {
      if (g.amount === '') faltan.push(`GASTO ${i + 1}: FALTA EL MONTO.`);
      if (g.category === 'OTRO' && !g.description.trim()) faltan.push(`GASTO ${i + 1}: ESCRIBE QUÉ ES (CATEGORÍA OTRO).`);
    });
    if (faltan.length) return setErrores(faltan);
    setErrores([]); setGuardando(true);
    const num = (v) => (v === '' ? null : Number(v));
    try {
      const r = await saveVoyageCost(barcoId, {
        container_rate: num(form.container_rate), under_deck_amount: num(form.under_deck_amount), notes: form.notes || null,
        expenses: form.expenses.map((g) => ({
          id: g.id, category: g.category, customer_id: num(g.customer_id), description: g.description || null, supplier_id: num(g.supplier_id),
          invoice_number: g.invoice_number || null, invoice_date: g.invoice_date || null, amount: Number(g.amount),
        })),
      });
      aplicarDetalle(r.data);
      cargarBarcos(pedidoId);
      setToast({ tipo: 'exito', mensaje: 'Gastos del viaje guardados correctamente' });
    } catch (err) {
      const e = err.response?.data?.errors;
      setErrores(e ? Object.values(e).flat() : [err.response?.data?.message || 'Error al guardar los gastos del viaje']);
    } finally {
      setGuardando(false);
    }
  };

  const input = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
  const etiqueta = 'block text-xs font-semibold text-gray-600 uppercase mb-1';
  const categorias = detalle?.categories || {};
  const conFlete = detalle ? detalle.customers.reduce((s, c) => s + c.contenedores_con_flete, 0) : 0;
  const totalGastos = form ? form.expenses.reduce((s, g) => s + (Number(g.amount) || 0), 0) : 0;
  const fleteContenedor = form && form.container_rate !== '' ? conFlete * Number(form.container_rate) : 0;

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gastos del viaje</h1>
          <p className="text-sm text-gray-500">Lo que cobra cada nave y los demás gastos de la exportación, con su factura</p>
        </div>
        <div className="w-56">
          <label className={etiqueta}>Semana</label>
          <SelectBuscable value={pedidoId} onChange={(e) => setPedidoId(e.target.value)} className={input}>
            {pedidos.map((p) => <option key={p.id} value={String(p.id)}>SEMANA {p.week} / {p.year}</option>)}
          </SelectBuscable>
        </div>
      </div>

      {/* Viajes de la semana */}
      {barcos.length === 0 ? (
        <p className="bg-white rounded-xl shadow p-6 text-sm text-gray-500">Esta semana no tiene barcos. Se arman en Exportaciones → Distribución en barcos.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
          {barcos.map((b) => {
            const falta = (b.contenedores_con_flete > 0 && b.container_rate === null) || (b.cajas_bajo_cubierta > 0 && b.under_deck_amount === null);
            return (
              <button key={b.id} type="button" onClick={() => abrirBarco(b.id)}
                className={`text-left bg-white rounded-xl shadow p-4 border-2 transition ${barcoId === b.id ? 'border-primario' : 'border-transparent hover:border-gray-200'}`}>
                <p className="font-bold text-gray-800 flex items-center gap-2"><Ship size={16} className="text-primario" /> {b.name}</p>
                <p className="text-xs text-gray-500 mb-2">Zarpe {fecha(b.departure_date)} · {cajas(b.cajas)} cajas · {cajas(b.contenedores)} contenedores ({cajas(b.contenedores_con_flete)} CFR/CIF)</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div><p className="text-[10px] text-gray-500 uppercase">Por contenedor</p><p className="font-semibold">{b.container_rate === null ? '—' : `$ ${dinero(b.container_rate)}`}</p></div>
                  <div><p className="text-[10px] text-gray-500 uppercase">Bajo cubierta</p><p className="font-semibold">{b.under_deck_amount === null ? '—' : `$ ${dinero(b.under_deck_amount)}`}</p></div>
                  <div><p className="text-[10px] text-gray-500 uppercase">Gastos ({b.expenses_count})</p><p className="font-semibold">$ {dinero(b.expenses_total)}</p></div>
                </div>
                {falta && <p className="text-[11px] font-semibold text-amber-700 mt-2">FALTA REGISTRAR EL FLETE DE ESTE VIAJE</p>}
              </button>
            );
          })}
        </div>
      )}

      {errores.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">{errores.map((e) => <p key={e}>{e}</p>)}</div>
      )}

      {/* Detalle del viaje elegido */}
      {detalle && form && (
        <div className="bg-white rounded-xl shadow p-4 space-y-4">
          <h2 className="text-lg font-bold text-gray-800">{detalle.shipment.name}</h2>

          {/* Carga por cliente */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-primario-claro text-primario">
                <tr>
                  <th className="text-left px-3 py-2 uppercase text-xs">Cliente</th>
                  <th className="text-right px-3 py-2 uppercase text-xs">Cajas</th>
                  <th className="text-right px-3 py-2 uppercase text-xs">Bajo cubierta</th>
                  <th className="text-right px-3 py-2 uppercase text-xs">Contenedores</th>
                  <th className="text-right px-3 py-2 uppercase text-xs" title="Contenedores de ventas CFR/CIF: el flete lo paga la empresa">Con flete (CFR/CIF)</th>
                  <th className="text-left px-3 py-2 uppercase text-xs">Según</th>
                </tr>
              </thead>
              <tbody>
                {detalle.customers.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-3 text-center text-gray-400">Este barco aún no tiene cajas en la Distribución en barcos ni en el Cierre de embarque.</td></tr>
                )}
                {detalle.customers.map((c) => (
                  <tr key={c.customer_id} className="border-t">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-right">{cajas(c.cajas)}</td>
                    <td className="px-3 py-2 text-right">{cajas(c.cajas_bajo_cubierta)}</td>
                    <td className="px-3 py-2 text-right">{cajas(c.contenedores)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{cajas(c.contenedores_con_flete)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{c.fuente === 'CIERRE' ? 'Cierre de embarque' : 'Distribución (sin cierre aún)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Fletes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={etiqueta}>Tarifa por contenedor (USD)</label>
              <CampoNumero decimales={2} value={form.container_rate} onChange={(e) => cambiar('container_rate', e.target.value)} placeholder="EJ. 2400" className={`${input} text-right`} />
              <p className="text-[11px] text-gray-500 mt-1">{cajas(conFlete)} contenedores CFR/CIF × tarifa = <strong>$ {dinero(fleteContenedor)}</strong>. En FOB el flete lo paga el cliente.</p>
            </div>
            <div>
              <label className={etiqueta}>Flete bajo cubierta, total (USD)</label>
              <CampoNumero decimales={2} value={form.under_deck_amount} onChange={(e) => cambiar('under_deck_amount', e.target.value)} placeholder="SI NO SE COBRA, 0" className={`${input} text-right`} />
              <p className="text-[11px] text-gray-500 mt-1">Se reparte entre los clientes según sus cajas bajo cubierta.</p>
            </div>
            <div>
              <label className={etiqueta}>Notas</label>
              <input value={form.notes} onChange={(e) => cambiar('notes', e.target.value.toUpperCase())} maxLength={255} className={input} />
            </div>
          </div>

          {/* Otros gastos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-700">Otros gastos del viaje</h3>
              <span className="text-sm text-gray-600">Total <strong>$ {dinero(totalGastos)}</strong></span>
            </div>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm min-w-[1100px]">
                <thead className="bg-primario text-white">
                  <tr>
                    <th className="text-left px-2 py-2 uppercase text-xs">Categoría</th>
                    <th className="text-left px-2 py-2 uppercase text-xs">De</th>
                    <th className="text-left px-2 py-2 uppercase text-xs">Descripción</th>
                    <th className="text-left px-2 py-2 uppercase text-xs">Proveedor</th>
                    <th className="text-left px-2 py-2 uppercase text-xs">N° factura</th>
                    <th className="text-left px-2 py-2 uppercase text-xs">Fecha</th>
                    <th className="text-right px-2 py-2 uppercase text-xs">Monto</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.expenses.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-400">Sin gastos registrados. Usa "Agregar gasto".</td></tr>
                  )}
                  {form.expenses.map((g) => (
                    <tr key={g._key} className="border-t">
                      <td className="px-2 py-1.5 min-w-[170px]">
                        <SelectBuscable value={g.category} onChange={(e) => cambiarGasto(g._key, 'category', e.target.value)} className={input}>
                          {Object.entries(categorias).map(([k, v]) => <option key={k} value={k}>{v.toUpperCase()}</option>)}
                        </SelectBuscable>
                      </td>
                      <td className="px-2 py-1.5 min-w-[170px]">
                        <SelectBuscable value={g.customer_id} onChange={(e) => cambiarGasto(g._key, 'customer_id', e.target.value)} className={input}>
                          <option value="">TODO EL VIAJE</option>
                          {detalle.customers.map((c) => <option key={c.customer_id} value={String(c.customer_id)}>{c.name}</option>)}
                        </SelectBuscable>
                      </td>
                      <td className="px-2 py-1.5 min-w-[170px]"><input value={g.description} onChange={(e) => cambiarGasto(g._key, 'description', e.target.value)} maxLength={150} placeholder={g.category === 'OTRO' ? 'OBLIGATORIO' : 'OPCIONAL'} className={input} /></td>
                      <td className="px-2 py-1.5 min-w-[180px]">
                        <SelectBuscable value={g.supplier_id} onChange={(e) => cambiarGasto(g._key, 'supplier_id', e.target.value)} className={input}>
                          <option value="">—</option>
                          {proveedores.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                        </SelectBuscable>
                      </td>
                      <td className="px-2 py-1.5 min-w-[120px]"><input value={g.invoice_number} onChange={(e) => cambiarGasto(g._key, 'invoice_number', e.target.value)} maxLength={40} className={input} /></td>
                      <td className="px-2 py-1.5 min-w-[140px]"><input type="date" value={g.invoice_date} onChange={(e) => cambiarGasto(g._key, 'invoice_date', e.target.value)} className={input} /></td>
                      <td className="px-2 py-1.5 min-w-[110px]"><CampoNumero decimales={2} value={g.amount} onChange={(e) => cambiarGasto(g._key, 'amount', e.target.value)} className={`${input} text-right font-semibold`} /></td>
                      <td className="px-2 py-1.5">
                        <button type="button" onClick={() => quitarGasto(g._key)} title="Quitar gasto" className="text-white p-1.5 rounded-lg bg-red-600 hover:bg-red-700"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">"Todo el viaje" se reparte entre los clientes según sus cajas. Los termógrafos y sellos se registran aquí como gasto del viaje.</p>
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" onClick={agregarGasto} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primario text-white text-sm font-semibold hover:opacity-90">
              <Plus size={16} /> Agregar gasto
            </button>
            <button type="button" onClick={guardar} disabled={guardando} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
              <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar gastos del viaje'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
