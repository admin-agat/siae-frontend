// Hoja de impresión del cierre de embarque ("ASIGNACIÓN DE CARGA WK-xx")
// Ubicación: src/components/ClosingPrint.jsx
//
// Solo se ve al imprimir (botón Imprimir de ShipmentClosingPage o Ctrl+P): usa el
// id="area-impresion" del @media print de index.css. Horizontal, con las columnas de la hoja de
// Logística: estado, carga, zarpe, naviera, nave, puerto, consignee, notify, descripción de la
// carga, marca, booking, DAE, B/L, M, cupo, embarcado, diferencia, pesos, AUCP, orden, ingreso y
// estado de la DAE. Los totales de peso se calculan sobre TODAS las filas.
// Imprime lo que está en pantalla; si hay cambios sin guardar sale marcado como BORRADOR.

const formatoCajas = (v) => Number(v || 0).toLocaleString('es-EC');
const formatoKilos = (v) => Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatoFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');
const n = (v) => Number(v) || 0;

const th = 'border border-gray-400 px-1 py-0.5 text-left font-semibold bg-gray-100';
const td = 'border border-gray-300 px-1 py-0.5';
const tdN = `${td} text-right`;

export default function ClosingPrint({ pedido, barcos, resumenCliente, nombreCliente, nombreMarca, usuario, borrador }) {
  const filas = barcos.flatMap((b) => b.bookings.map((k) => ({ b, k })));
  const total = (fn) => filas.reduce((s, { k }) => s + fn(k), 0);

  return (
    <div id="area-impresion" className="hidden print:block text-[8px] text-black">
      <style>{'@page { size: A4 landscape; margin: 7mm; }'}</style>

      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-1 mb-2">
        <div>
          <p className="font-bold text-sm">AGAT-ECUAGREEN S.A.</p>
          <p className="font-bold text-base">ASIGNACIÓN DE CARGA — SEMANA {pedido.week} / {pedido.year}</p>
        </div>
        <div className="text-right leading-tight text-gray-600 text-[9px]">
          <p>Usuario: {usuario || '—'}</p>
          <p>Fecha de impresión: {new Date().toLocaleString('es-EC')}</p>
          {borrador && <p className="font-bold text-red-700 text-xs">BORRADOR — CAMBIOS SIN GUARDAR</p>}
        </div>
      </div>

      <table className="w-full border-collapse mb-3">
        <thead>
          <tr>
            <th className={th}>ESTADO</th>
            <th className={th}>CARGA</th>
            <th className={th}>ZARPE</th>
            <th className={th}>NAVIERA</th>
            <th className={th}>NAVE</th>
            <th className={th}>PUERTO</th>
            <th className={th}>CONSIGNEE</th>
            <th className={th}>NOTIFY</th>
            <th className={th}>DESCRIPCIÓN</th>
            <th className={th}>MARCA</th>
            <th className={th}>BOOKING</th>
            <th className={th}>DAE</th>
            <th className={th}>B/L</th>
            <th className={th}>M</th>
            <th className={th}>CUPO</th>
            <th className={th}>EMBARCADO</th>
            <th className={th}>DIF.</th>
            <th className={th}>P.N</th>
            <th className={th}>PESO NETO</th>
            <th className={th}>P.B</th>
            <th className={th}>PESO BRUTO</th>
            <th className={th}>AUCP</th>
            <th className={th}>ORDEN</th>
            <th className={th}>INGRESO</th>
            <th className={th}>ESTADO DAE</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ b, k }) => {
            const contenedor = k.cargo_mode === 'CONTENEDOR';
            return (
              <tr key={k._key}>
                <td className={td}>{k.arrival_note}</td>
                <td className={`${td} whitespace-nowrap`}>{formatoFecha(b.loading_from)} – {formatoFecha(b.loading_to)}</td>
                <td className={`${td} whitespace-nowrap`}>{formatoFecha(b.departure_date)}</td>
                <td className={td}>{b.naviera}</td>
                <td className={td}>{b.vessel_name}{b.voyage && !b.vessel_name?.includes(b.voyage) ? ` ${b.voyage}` : ''}</td>
                <td className={td}>{b.puerto}</td>
                <td className={td}>{k.consignee_name || nombreCliente(k.customer_id)}</td>
                <td className={td}>{k.notify_name}</td>
                <td className={td}>{contenedor ? 'CONTENEDORES' : `BODEGA ${k.holds}`}</td>
                <td className={td}>{nombreMarca(k.customer_id, k.brand_id)} {k.negotiation_type}</td>
                <td className={td}>{k.booking_number}</td>
                <td className={`${td} whitespace-nowrap`}>{k.dae_number}</td>
                <td className={td}>{k.bl_number}</td>
                <td className={td}>{contenedor ? k.containers_qty : 'CS'}</td>
                <td className={tdN}>{formatoCajas(k.quota_boxes)}</td>
                <td className={tdN}>{formatoCajas(k.shipped_boxes)}</td>
                <td className={tdN}>{formatoCajas(n(k.shipped_boxes) - n(k.quota_boxes))}</td>
                <td className={tdN}>{k.net_weight_per_box}</td>
                <td className={tdN}>{formatoKilos(n(k.shipped_boxes) * n(k.net_weight_per_box))}</td>
                <td className={tdN}>{k.gross_weight_per_box}</td>
                <td className={tdN}>{formatoKilos(n(k.shipped_boxes) * n(k.gross_weight_per_box))}</td>
                <td className={td}>{k.aucp}</td>
                <td className={td}>{k.order_ref}</td>
                <td className={tdN}>{k.port_entry_boxes === '' ? '' : formatoCajas(k.port_entry_boxes)}</td>
                <td className={td}>{k.dae_status}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-bold bg-gray-100">
            <td className={td} colSpan={13}>TOTAL</td>
            <td className={tdN}>{formatoCajas(total((k) => (k.cargo_mode === 'CONTENEDOR' ? n(k.containers_qty) : 0)))}</td>
            <td className={tdN}>{formatoCajas(total((k) => n(k.quota_boxes)))}</td>
            <td className={tdN}>{formatoCajas(total((k) => n(k.shipped_boxes)))}</td>
            <td className={tdN}>{formatoCajas(total((k) => n(k.shipped_boxes) - n(k.quota_boxes)))}</td>
            <td className={td}></td>
            <td className={tdN}>{formatoKilos(total((k) => n(k.shipped_boxes) * n(k.net_weight_per_box)))}</td>
            <td className={td}></td>
            <td className={tdN}>{formatoKilos(total((k) => n(k.shipped_boxes) * n(k.gross_weight_per_box)))}</td>
            <td className={td} colSpan={2}></td>
            <td className={tdN}>{formatoCajas(total((k) => n(k.port_entry_boxes)))}</td>
            <td className={td}></td>
          </tr>
        </tfoot>
      </table>

      <p className="font-bold text-[10px] mb-1">RESUMEN POR CLIENTE</p>
      <table className="border-collapse mb-6">
        <thead>
          <tr>
            <th className={th}>CLIENTE</th>
            <th className={th}>PEDIDO CONTRATO</th>
            <th className={th}>EMBARCADO CONTRATO</th>
            <th className={th}>PEDIDO SPOT</th>
            <th className={th}>EMBARCADO SPOT</th>
            <th className={th}>PEDIDO TOTAL</th>
            <th className={th}>EMBARCADO TOTAL</th>
            <th className={th}>DIFERENCIA</th>
          </tr>
        </thead>
        <tbody>
          {resumenCliente.map((c) => (
            <tr key={c.id}>
              <td className={td}>{c.name}</td>
              <td className={tdN}>{formatoCajas(c.pedido_contrato)}</td>
              <td className={tdN}>{formatoCajas(c.contrato)}</td>
              <td className={tdN}>{formatoCajas(c.pedido_spot)}</td>
              <td className={tdN}>{formatoCajas(c.spot)}</td>
              <td className={tdN}>{formatoCajas(c.pedido)}</td>
              <td className={tdN}>{formatoCajas(c.embarcado)}</td>
              <td className={tdN}>{formatoCajas(c.embarcado - c.pedido)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-around mt-10 text-[9px]">
        <div className="text-center border-t border-gray-700 w-56 pt-1">ELABORADO POR (LOGÍSTICA)</div>
        <div className="text-center border-t border-gray-700 w-56 pt-1">REVISADO POR</div>
      </div>
    </div>
  );
}
