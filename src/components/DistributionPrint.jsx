// Hoja de impresión de la distribución semanal en barcos
// Ubicación: src/components/DistributionPrint.jsx
//
// Solo se ve al imprimir (botón Imprimir de OrderDistributionPage o Ctrl+P): usa el
// id="area-impresion" del @media print de index.css. Imprime en horizontal:
//   1) Resumen de la semana (pedido, en barcos, pendiente)
//   2) Un bloque por barco con las líneas que lleva
//   3) Resumen por cliente y lo que queda pendiente por embarcar
// Imprime lo que está en pantalla; si hay cambios sin guardar sale marcado como BORRADOR.

const TIPOS_CARGA = {
  CAJA_BAJO_CUBIERTA: 'BAJO CUBIERTA',
  GRANEL_BAJO_CUBIERTA: 'GRANEL BAJO CUBIERTA',
  CAJA_CONTENEDOR: 'CONTENEDOR',
  GRANEL_CONTENEDOR: 'CONTENEDOR A GRANEL',
};

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const formatoFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');

const th = 'border border-gray-400 px-1.5 py-1 text-left font-semibold bg-gray-100';
const td = 'border border-gray-300 px-1.5 py-0.5';

export default function DistributionPrint({ pedido, barcos, navieras, buques, puertos, usuario, borrador }) {
  const lineas = pedido.lines || [];
  const nombre = (lista, id) => lista.find((x) => String(x.id) === String(id))?.name || '—';
  const asignadoLinea = (lineaId) => barcos.reduce((s, b) => s + (Number(b.asign[lineaId]) || 0), 0);
  const totalPedido = lineas.reduce((s, l) => s + l.boxes, 0);
  const totalAsignado = lineas.reduce((s, l) => s + asignadoLinea(l.id), 0);

  // Resumen por cliente
  const porCliente = {};
  lineas.forEach((l) => {
    const c = l.customer?.third_party?.name || '—';
    porCliente[c] = porCliente[c] || { pedido: 0, enBarcos: 0 };
    porCliente[c].pedido += l.boxes;
    porCliente[c].enBarcos += asignadoLinea(l.id);
  });

  const pendientes = lineas
    .map((l, i) => ({ l, i, falta: l.boxes - asignadoLinea(l.id) }))
    .filter((x) => x.falta > 0);

  return (
    <div id="area-impresion" className="hidden print:block text-[10px] text-black">
      {/* Solo esta hoja va en horizontal */}
      <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>

      {/* Encabezado */}
      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-1 mb-2">
        <div>
          <p className="font-bold text-sm">AGAT-ECUAGREEN S.A.</p>
          <p className="font-bold text-base">DISTRIBUCIÓN EN BARCOS — SEMANA {pedido.week} / {pedido.year}</p>
        </div>
        <div className="text-right leading-tight text-gray-600">
          <p>Usuario: {usuario || '—'}</p>
          <p>Fecha de impresión: {new Date().toLocaleString('es-EC')}</p>
          {borrador && <p className="font-bold text-red-700 text-xs">BORRADOR — CAMBIOS SIN GUARDAR</p>}
        </div>
      </div>

      <div className="flex gap-6 mb-3 text-xs">
        <span>Total pedido: <strong>{formatoCajas(totalPedido)}</strong> cajas</span>
        <span>En barcos: <strong>{formatoCajas(totalAsignado)}</strong></span>
        <span>Pendiente por embarcar: <strong>{formatoCajas(totalPedido - totalAsignado)}</strong></span>
        <span>Barcos: <strong>{barcos.length}</strong></span>
      </div>

      {/* Un bloque por barco */}
      {barcos.map((b, i) => {
        const items = lineas
          .map((l, idx) => ({ l, idx, cajas: Number(b.asign[l.id]) || 0 }))
          .filter((x) => x.cajas > 0);
        const totalBarco = items.reduce((s, x) => s + x.cajas, 0);
        const totalCont = items.reduce((s, x) => s + (x.l.boxes_per_container ? x.cajas / x.l.boxes_per_container : 0), 0);
        return (
          <div key={b._key} className="mb-3 break-inside-avoid">
            <div className="flex flex-wrap gap-x-5 bg-gray-200 border border-gray-400 px-2 py-1 font-semibold">
              <span>BARCO #{i + 1}{b.code ? ` (${b.code})` : ''}: {nombre(buques, b.vessel_id)}{b.voyage ? ` — VIAJE ${b.voyage}` : ''}</span>
              <span>NAVIERA: {nombre(navieras, b.shipping_line_id)}</span>
              <span>SALIDA: {nombre(puertos, b.departure_port_id)} — {formatoFecha(b.departure_date)}</span>
              <span>DESTINO: {nombre(puertos, b.destination_port_id)}</span>
              <span>ETA: {formatoFecha(b.eta)}</span>
              <span className="ml-auto">{formatoCajas(totalBarco)} CAJAS{totalCont ? ` · ${totalCont} CONT.` : ''}</span>
            </div>
            {items.length === 0 ? (
              <p className="border border-t-0 border-gray-300 px-2 py-1 text-gray-500">Sin cajas asignadas.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={`${th} w-8`}>Lín.</th>
                    <th className={th}>Cliente</th>
                    <th className={th}>Modalidad</th>
                    <th className={th}>Puerto de la línea</th>
                    <th className={th}>Incoterm · Tipo</th>
                    <th className={th}>N° pedido</th>
                    <th className={`${th} text-right`}>Contenedores</th>
                    <th className={`${th} text-right`}>Cajas</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ l, idx, cajas }) => (
                    <tr key={l.id}>
                      <td className={td}>{idx + 1}</td>
                      <td className={td}>{l.customer?.third_party?.name}</td>
                      <td className={td}>{TIPOS_CARGA[l.cargo_type] || l.cargo_type}</td>
                      <td className={td}>{l.departure_port?.name}</td>
                      <td className={td}>{l.incoterm} · {l.negotiation_type}</td>
                      <td className={td}>{l.order_number || '—'}</td>
                      <td className={`${td} text-right`}>{l.boxes_per_container ? `${cajas / l.boxes_per_container} × ${formatoCajas(l.boxes_per_container)}` : '—'}</td>
                      <td className={`${td} text-right font-semibold`}>{formatoCajas(cajas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* Resumen por cliente y pendientes */}
      <div className="flex gap-6 items-start break-inside-avoid">
        <table className="border-collapse min-w-[45%]">
          <thead>
            <tr>
              <th className={th}>Cliente</th>
              <th className={`${th} text-right`}>Pedido</th>
              <th className={`${th} text-right`}>En barcos</th>
              <th className={`${th} text-right`}>Pendiente</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(porCliente).map(([c, v]) => (
              <tr key={c}>
                <td className={td}>{c}</td>
                <td className={`${td} text-right`}>{formatoCajas(v.pedido)}</td>
                <td className={`${td} text-right`}>{formatoCajas(v.enBarcos)}</td>
                <td className={`${td} text-right font-semibold`}>{formatoCajas(v.pedido - v.enBarcos)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className={td}>TOTAL</td>
              <td className={`${td} text-right`}>{formatoCajas(totalPedido)}</td>
              <td className={`${td} text-right`}>{formatoCajas(totalAsignado)}</td>
              <td className={`${td} text-right`}>{formatoCajas(totalPedido - totalAsignado)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex-1">
          <p className="font-semibold mb-1">PENDIENTE POR EMBARCAR</p>
          {pendientes.length === 0 ? (
            <p>✔ Todo el pedido está distribuido en barcos.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${th} w-8`}>Lín.</th>
                  <th className={th}>Cliente</th>
                  <th className={th}>Puerto</th>
                  <th className={`${th} text-right`}>Cajas pendientes</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map(({ l, i, falta }) => (
                  <tr key={l.id}>
                    <td className={td}>{i + 1}</td>
                    <td className={td}>{l.customer?.third_party?.name}</td>
                    <td className={td}>{l.departure_port?.name}</td>
                    <td className={`${td} text-right font-semibold`}>{formatoCajas(falta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Firmas */}
      <div className="flex justify-around mt-10 break-inside-avoid">
        <div className="text-center w-48 border-t border-gray-800 pt-1">ELABORADO POR (LOGÍSTICA)</div>
        <div className="text-center w-48 border-t border-gray-800 pt-1">REVISADO POR</div>
      </div>
    </div>
  );
}
