// Materiales del pedido (preliminar) — src/components/MaterialesPedidoPanel.jsx
//
// 16/11/2026: cuánto material necesita el pedido de la semana (cajas × receta de su marca, menos lo ya
// retirado) contra el stock sumado de las bodegas. Si no alcanza, alerta con las cajas que sí cubren y
// los insumos que faltan. El costo en $ solo llega del backend para GERENCIA, FINANZAS y ADMIN.
// Lo usan el Pedido semanal (líneas en edición) y Despacho de materiales → Por despachar (sin dólares).
// Solo muestra: no guarda ni bloquea nada.
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { dinero } from '../utils/formato';

const fNum = (n, unidad) => Number(n || 0).toLocaleString('es-EC', { maximumFractionDigits: unidad === 'LIBRAS' ? 2 : 0 });
const fCajas = (n) => Number(n || 0).toLocaleString('es-EC');

export default function MaterialesPedidoPanel({ datos, cargando, error, titulo = 'Materiales del pedido' }) {
  const [abierto, setAbierto] = useState(false);
  // 18/11/2026 (Peter): insumo elegido en verde, como en las listas compactas
  const [filaSeleccionada, setFilaSeleccionada] = useState(null);

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">{error}</div>;
  }
  // Ninguna línea con receta: no hay nada que comparar (no se dice que "alcanza")
  if (datos && !datos.cajas && datos.sin_receta?.length > 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4 text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span>
          <strong>{titulo}:</strong> no se puede calcular porque estas marcas no tienen receta de materiales:{' '}
          {datos.sin_receta.map((s) => `${s.marca} (${fCajas(s.cajas)} cajas)`).join(', ')}. Pide que les carguen la receta en Insumos.
        </span>
      </div>
    );
  }
  if (!datos || !datos.cajas) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 mb-4 text-sm text-gray-500 flex items-center gap-2">
        <Package size={16} /> {cargando ? 'Calculando materiales…' : `${titulo}: agrega líneas con marca y cajas para calcular.`}
      </div>
    );
  }

  const falta = datos.con_faltante > 0;
  const insumos = datos.insumos || [];
  const verBodegas = !datos.solo_mi_bodega && insumos[0]?.por_bodega?.length > 0;
  const bodegas = verBodegas ? insumos[0].por_bodega : [];

  return (
    <div className={`rounded-xl border px-4 py-3 mb-4 ${falta ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm">
          <p className="font-semibold text-gray-800 flex items-center gap-2">
            <Package size={16} /> {titulo} <span className="text-xs font-normal text-gray-500">(preliminar{cargando ? ' · actualizando…' : ''})</span>
          </p>
          {falta ? (
            <p className="mt-1 flex items-start gap-1.5 text-amber-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                Con lo que hay en {datos.solo_mi_bodega ? 'las bodegas' : `las ${datos.bodegas} bodegas`} alcanza para{' '}
                <strong>{fCajas(datos.cajas_alcanzan)} de {fCajas(datos.cajas)} cajas</strong>.
                Faltan materiales para <strong>{fCajas(datos.cajas - datos.cajas_alcanzan)} cajas</strong> ({datos.con_faltante} insumo{datos.con_faltante === 1 ? '' : 's'}).
              </span>
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-green-800">
              <CheckCircle2 size={16} /> Los materiales en bodega alcanzan para las {fCajas(datos.cajas)} cajas.
            </p>
          )}
          {datos.sin_receta?.length > 0 && (
            <p className="mt-1 text-xs text-amber-800">
              SIN RECETA (no se calculan): {datos.sin_receta.map((s) => `${s.marca} (${fCajas(s.cajas)} cajas)`).join(', ')}.
            </p>
          )}
        </div>
        {datos.ve_costo && (
          <div className="text-right text-sm">
            <p className="text-xs uppercase font-semibold text-gray-500">Costo de materiales</p>
            <p className="text-xl font-bold text-gray-800">$ {dinero(datos.costo)}</p>
            <p className="text-xs text-gray-600">$ {dinero(datos.costo_por_caja, 4)} por caja</p>
            {datos.insumos_sin_costo > 0 && (
              <p className="text-xs text-amber-700">{datos.insumos_sin_costo} insumo{datos.insumos_sin_costo === 1 ? '' : 's'} sin costo: el total sale más bajo</p>
            )}
          </div>
        )}
      </div>

      <button type="button" onClick={() => setAbierto((v) => !v)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-primario hover:underline">
        {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {abierto ? 'Ocultar' : 'Ver'} detalle por insumo
      </button>

      {abierto && (
        <div className="mt-2 overflow-auto max-h-80 bg-white rounded-lg border border-gray-200">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-primario text-white uppercase">
              <tr>
                {/* 18/11/2026 (Peter): columna # y estilo de lista compacta */}
                <th className="text-center px-2 py-1.5 w-10">#</th>
                <th className="text-left px-2 py-1.5">Insumo</th>
                <th className="text-right px-2 py-1.5">Necesario</th>
                <th className="text-right px-2 py-1.5">Ya retirado</th>
                {bodegas.map((b) => <th key={b.warehouse_id} className="text-right px-2 py-1.5 whitespace-nowrap">{b.name.replace(/^BODEGA /, '')}</th>)}
                <th className="text-right px-2 py-1.5">{datos.solo_mi_bodega ? 'Mi bodega' : 'Stock total'}</th>
                <th className="text-right px-2 py-1.5">Faltante</th>
                {datos.ve_costo && <th className="text-right px-2 py-1.5">Costo</th>}
              </tr>
            </thead>
            <tbody>
              {insumos.map((x, i) => (
                <tr key={x.supply_id} onClick={() => setFilaSeleccionada(x.supply_id)} className={`cursor-pointer ${filaSeleccionada === x.supply_id ? 'fila-elegida bg-green-600 text-white' : (i % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-violet-50 hover:bg-yellow-50')}`}>
                  <td className="bg-gray-200 border border-gray-300 px-1 py-1 text-center text-xs font-bold text-gray-700">{i + 1}</td>
                  <td className="px-2 py-1 border border-gray-200">{x.name} <span className="text-gray-400">{x.unit}</span></td>
                  <td className="px-2 py-1 border border-gray-200 text-right">{fNum(x.necesario, x.unit)}</td>
                  <td className="px-2 py-1 border border-gray-200 text-right text-gray-500">{fNum(x.ya_retirado, x.unit)}</td>
                  {verBodegas && x.por_bodega.map((b) => <td key={b.warehouse_id} className="px-2 py-1 border border-gray-200 text-right text-gray-500">{fNum(b.stock, x.unit)}</td>)}
                  <td className="px-2 py-1 border border-gray-200 text-right">{fNum(datos.solo_mi_bodega ? x.stock_mi_bodega : x.stock, x.unit)}</td>
                  <td className={`px-2 py-1 border border-gray-200 text-right font-semibold ${x.faltante > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {x.faltante > 0 ? fNum(x.faltante, x.unit) : 'OK'}
                  </td>
                  {datos.ve_costo && <td className="px-2 py-1 border border-gray-200 text-right">$ {dinero(x.costo)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
