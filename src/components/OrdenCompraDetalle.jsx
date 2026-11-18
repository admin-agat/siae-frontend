// Detalle de una orden de compra (solo lectura) — 05/11/2026.
// Lo usan Órdenes de compra del departamento y Aprobación y pago de OC (Contabilidad).
// Las líneas pueden ser de texto libre (departamento) o de insumo (bodega).
import { useState } from 'react';
import { dinero } from '../utils/formato';
import { estadoOC, fechaVer, totalesOC } from '../utils/ordenCompra';

export default function OrdenCompraDetalle({ orden }) {
    const estado = estadoOC(orden);
    const lineas = orden.lines || [];
    const t = totalesOC(lineas);
    // 18/11/2026 (Peter): línea elegida en verde, como en las listas compactas
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);
    const dato = (titulo, valor) => (
        <div>
            <p className="text-xs font-semibold text-gray-500">{titulo}</p>
            <p className="text-sm text-gray-800">{valor || '—'}</p>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dato('Código', <span className="font-semibold">{orden.code}</span>)}
                {dato('Fecha', fechaVer(orden.date))}
                {dato('Departamento', orden.department)}
                {dato('Estado', <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${estado.clase}`}>{estado.texto}</span>)}
                <div className="col-span-2">{dato('Proveedor', orden.third_party?.name)}</div>
                {dato('Hecha por', orden.creator?.name)}
                {dato(orden.warehouse ? 'Bodega' : 'Aprobada por', orden.warehouse?.name || orden.approver?.name)}
                <div className="col-span-2 md:col-span-4">{dato('Concepto', orden.reference)}</div>
            </div>

            {orden.approval_status === 'RECHAZADA' && orden.rejection_reason && (
                <p className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2">
                    <strong>Motivo del rechazo:</strong> {orden.rejection_reason}
                </p>
            )}
            {orden.status === 'CANCELADA' && orden.cancellation_reason && (
                <p className="bg-gray-100 text-gray-700 text-sm rounded-lg px-4 py-2">
                    <strong>Cancelada:</strong> {orden.cancellation_reason}
                </p>
            )}
            {orden.bank_payment_batch && (
                <p className="bg-indigo-50 text-indigo-700 text-sm rounded-lg px-4 py-2">
                    Lote de pago al banco: <strong>{orden.bank_payment_batch.code}</strong>
                </p>
            )}

            <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-primario text-white">
                        <tr>
                            {/* 18/11/2026 (Peter): columna # y estilo de lista compacta */}
                            <th className="text-center px-2 py-2 text-xs w-10">#</th>
                            <th className="text-left px-3 py-2 text-xs">DESCRIPCIÓN</th>
                            <th className="text-right px-3 py-2 text-xs">CANT.</th>
                            <th className="text-right px-3 py-2 text-xs">PRECIO</th>
                            <th className="text-center px-3 py-2 text-xs">% IVA</th>
                            <th className="text-center px-3 py-2 text-xs">% DESC</th>
                            <th className="text-center px-3 py-2 text-xs">% RET IR</th>
                            <th className="text-right px-3 py-2 text-xs">SUBTOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lineas.map((l, i) => (
                            <tr key={l.id ?? i} onClick={() => setFilaSeleccionada(i)} className={`cursor-pointer ${filaSeleccionada === i ? 'fila-elegida bg-green-600 text-white' : (i % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-violet-50 hover:bg-yellow-50')}`}>
                                <td className="bg-gray-200 border border-gray-300 px-1 py-1.5 text-center text-sm font-bold text-gray-700">{i + 1}</td>
                                <td className="px-3 py-1.5 border border-gray-200">{l.description || l.supply?.name}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-right">{Number(l.quantity_ordered).toLocaleString('es-EC')}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-right">{dinero(l.unit_price)}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{Number(l.tax_rate)}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{Number(l.discount_percent || 0)}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-center">{Number(l.retention_rate || 0)}</td>
                                <td className="px-3 py-1.5 border border-gray-200 text-right">{dinero(l.subtotal)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end">
                <div className="w-full max-w-xs text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{dinero(t.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">IVA</span><span>{dinero(t.iva)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Retención IR</span><span>− {dinero(t.retencion)}</span></div>
                    <div className="flex justify-between border-t pt-1 font-bold text-gray-800"><span>Total a pagar</span><span>$ {dinero(orden.total ?? t.total)}</span></div>
                </div>
            </div>
        </div>
    );
}
