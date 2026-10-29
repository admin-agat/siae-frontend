// Modal de SOLO LECTURA del pedido semanal (botón "Ver" en Pedido semanal).
// Ubicación: src/components/CustomerOrderViewModal.jsx
// Muestra la cabecera, todas las líneas con su precio (el guardado en la línea, no el
// del contrato actual) y el resumen por cliente. Para cambiar algo se usa "Editar".
// 29/10/2026: botón Imprimir (también desde la acción Imprimir de la tabla: imprimirAlAbrir).
// La hoja impresa es un bloque aparte (id="area-impresion", ver @media print en index.css).
import { useState, useEffect, useRef } from 'react';
import { X, Pencil, Printer } from 'lucide-react';
import { getCustomerOrder } from '../api/customerOrders';
import { useAuth } from '../context/AuthContext';
import EstadoBadge from './common/EstadoBadge';

const TIPOS_CARGA = {
    CAJA_BAJO_CUBIERTA: 'BAJO CUBIERTA',
    GRANEL_BAJO_CUBIERTA: 'GRANEL BAJO CUBIERTA',
    CAJA_CONTENEDOR: 'CONTENEDOR',
    GRANEL_CONTENEDOR: 'CONTENEDOR A GRANEL',
};

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const formatoDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatoFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');

export default function CustomerOrderViewModal({ pedidoId, onClose, onEditar, imprimirAlAbrir = false }) {
    const { user } = useAuth();
    const [pedido, setPedido] = useState(null);
    const [error, setError] = useState('');
    const yaImpreso = useRef(false);

    useEffect(() => {
        getCustomerOrder(pedidoId)
            .then((res) => setPedido(res.data))
            .catch(() => setError('NO SE PUDO CARGAR EL PEDIDO.'));
    }, [pedidoId]);

    // Acción "Imprimir" de la tabla: en cuanto llega el pedido, abre el diálogo de impresión (una vez)
    useEffect(() => {
        if (imprimirAlAbrir && pedido && !yaImpreso.current) {
            yaImpreso.current = true;
            setTimeout(() => window.print(), 100); // deja pintar la hoja antes de imprimir
        }
    }, [imprimirAlAbrir, pedido]);

    const lineas = pedido?.lines || [];

    // Resumen por cliente, en el orden en que aparecen en el pedido
    const resumen = [];
    lineas.forEach((l) => {
        let fila = resumen.find((r) => r.customer_id === l.customer_id);
        if (!fila) {
            fila = { customer_id: l.customer_id, nombre: l.customer?.third_party?.name, contrato: 0, spot: 0, monto: 0, sinPrecio: 0 };
            resumen.push(fila);
        }
        if (l.negotiation_type === 'CONTRATO') fila.contrato += l.boxes; else fila.spot += l.boxes;
        if (l.box_price === null || l.box_price === undefined) fila.sinPrecio += l.boxes;
        else fila.monto += l.boxes * Number(l.box_price);
    });
    const totalCajas = lineas.reduce((s, l) => s + l.boxes, 0);
    const totalMonto = resumen.reduce((s, r) => s + r.monto, 0);
    const totalSinPrecio = resumen.reduce((s, r) => s + r.sinPrecio, 0);

    const th = 'border border-gray-400 px-1.5 py-1 text-left font-semibold bg-gray-100';
    const td = 'border border-gray-300 px-1.5 py-0.5';

    return (
        <>
        {/* Hoja de impresión (solo se ve al imprimir) */}
        {pedido && (
            <div id="area-impresion" className="hidden print:block text-[10px] text-black">
                <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-1 mb-2">
                    <div>
                        <p className="font-bold text-sm">AGAT-ECUAGREEN S.A.</p>
                        <p className="font-bold text-base">PEDIDO SEMANAL — SEMANA {pedido.week} / {pedido.year}</p>
                    </div>
                    <div className="text-right leading-tight text-gray-600">
                        <p>Usuario: {user?.name || '—'}</p>
                        <p>Fecha de impresión: {new Date().toLocaleString('es-EC')}</p>
                        {!pedido.status && <p className="font-bold text-red-700 text-xs">PEDIDO ANULADO</p>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-6 mb-2 text-xs">
                    <span>Total semana: <strong>{formatoCajas(pedido.expected_boxes ?? totalCajas)}</strong> cajas</span>
                    <span>Fecha del correo: <strong>{formatoFecha(pedido.received_at)}</strong></span>
                    <span>Líneas: <strong>{lineas.length}</strong></span>
                    {pedido.comment && <span>Comentario: <strong>{pedido.comment}</strong></span>}
                </div>
                <table className="w-full border-collapse mb-3">
                    <thead>
                        <tr>
                            <th className={`${th} w-6`}>#</th>
                            <th className={th}>Cliente</th>
                            <th className={th}>Modalidad</th>
                            <th className={`${th} text-right`}>Cajas</th>
                            <th className={th}>Incoterm</th>
                            <th className={th}>Puerto</th>
                            <th className={th}>Tipo</th>
                            <th className={`${th} text-right`}>Precio caja</th>
                            <th className={`${th} text-right`}>Monto</th>
                            <th className={th}>N° pedido</th>
                            <th className={th}>Notas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lineas.map((l, i) => (
                            <tr key={l.id}>
                                <td className={td}>{i + 1}</td>
                                <td className={td}>{l.customer?.third_party?.name}</td>
                                <td className={td}>{TIPOS_CARGA[l.cargo_type] || l.cargo_type}{l.containers_qty ? ` (${l.containers_qty} × ${formatoCajas(l.boxes_per_container)})` : ''}</td>
                                <td className={`${td} text-right font-semibold`}>{formatoCajas(l.boxes)}</td>
                                <td className={td}>{l.incoterm}</td>
                                <td className={td}>{l.departure_port?.name}</td>
                                <td className={td}>{l.negotiation_type}</td>
                                <td className={`${td} text-right`}>{l.box_price === null ? 'PENDIENTE' : `$ ${formatoDinero(l.box_price)}`}</td>
                                <td className={`${td} text-right`}>{l.box_price === null ? '—' : `$ ${formatoDinero(l.boxes * Number(l.box_price))}`}</td>
                                <td className={td}>{l.order_number || '—'}</td>
                                <td className={td}>{l.notes || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <table className="border-collapse min-w-[50%] break-inside-avoid">
                    <thead>
                        <tr>
                            <th className={th}>Cliente</th>
                            <th className={`${th} text-right`}>Contrato</th>
                            <th className={`${th} text-right`}>Spot</th>
                            <th className={`${th} text-right`}>Total cajas</th>
                            <th className={`${th} text-right`}>Monto (USD)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {resumen.map((r) => (
                            <tr key={r.customer_id}>
                                <td className={td}>{r.nombre}</td>
                                <td className={`${td} text-right`}>{formatoCajas(r.contrato)}</td>
                                <td className={`${td} text-right`}>{formatoCajas(r.spot)}</td>
                                <td className={`${td} text-right font-semibold`}>{formatoCajas(r.contrato + r.spot)}</td>
                                <td className={`${td} text-right`}>{formatoDinero(r.monto)}{r.sinPrecio > 0 ? ` (${formatoCajas(r.sinPrecio)} cajas sin precio)` : ''}</td>
                            </tr>
                        ))}
                        <tr className="font-bold">
                            <td className={td}>TOTAL SEMANA {pedido.week}</td>
                            <td className={td}></td>
                            <td className={td}></td>
                            <td className={`${td} text-right`}>{formatoCajas(totalCajas)}</td>
                            <td className={`${td} text-right`}>{formatoDinero(totalMonto)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )}

        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                {/* Encabezado */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-bold text-primario">
                        {pedido ? `Pedido semana ${pedido.week} / ${pedido.year}` : 'Pedido semanal'}
                    </h2>
                    <button type="button" onClick={onClose} title="Cerrar" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 py-4 overflow-y-auto">
                    {error ? (
                        <p className="text-red-600 text-sm">{error}</p>
                    ) : !pedido ? (
                        <p className="text-gray-400 text-sm">Cargando pedido...</p>
                    ) : (
                        <>
                            {/* Cabecera */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Total semana</p>
                                    <p className="font-bold text-gray-800">{formatoCajas(pedido.expected_boxes ?? totalCajas)} cajas</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Fecha del correo</p>
                                    <p className="text-gray-800">{formatoFecha(pedido.received_at)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Líneas</p>
                                    <p className="text-gray-800">{lineas.length}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Estado</p>
                                    <EstadoBadge activo={pedido.status} textoActivo="ACTIVO" textoInactivo="ANULADO" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Comentario</p>
                                    <p className="text-gray-800">{pedido.comment || '—'}</p>
                                </div>
                            </div>

                            {/* Líneas */}
                            <div className="overflow-x-auto rounded-xl border mb-4">
                                <table className="w-full text-sm min-w-[1000px]">
                                    <thead className="bg-primario text-white">
                                        <tr>
                                            <th className="text-left px-3 py-2 uppercase">#</th>
                                            <th className="text-left px-3 py-2 uppercase">Cliente</th>
                                            <th className="text-left px-3 py-2 uppercase">Modalidad</th>
                                            <th className="text-right px-3 py-2 uppercase">Cajas</th>
                                            <th className="text-left px-3 py-2 uppercase">Incoterm</th>
                                            <th className="text-left px-3 py-2 uppercase">Puerto</th>
                                            <th className="text-left px-3 py-2 uppercase">Tipo</th>
                                            <th className="text-right px-3 py-2 uppercase">Precio caja</th>
                                            <th className="text-right px-3 py-2 uppercase">Monto</th>
                                            <th className="text-left px-3 py-2 uppercase">N° pedido</th>
                                            <th className="text-left px-3 py-2 uppercase">Notas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineas.map((l, i) => (
                                            <tr key={l.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                                <td className="px-3 py-2 font-medium">{l.customer?.third_party?.name}</td>
                                                <td className="px-3 py-2">
                                                    {TIPOS_CARGA[l.cargo_type] || l.cargo_type}
                                                    {l.containers_qty && (
                                                        <span className="block text-xs text-gray-500">{l.containers_qty} × {formatoCajas(l.boxes_per_container)}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold">{formatoCajas(l.boxes)}</td>
                                                <td className="px-3 py-2">{l.incoterm}</td>
                                                <td className="px-3 py-2">{l.departure_port?.name}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                        l.negotiation_type === 'CONTRATO' ? 'bg-primario-claro text-primario' : 'bg-amber-50 text-amber-700'
                                                    }`}>
                                                        {l.negotiation_type}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {l.box_price === null ? <span className="text-amber-600 text-xs font-semibold">PENDIENTE</span> : `$ ${formatoDinero(l.box_price)}`}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {l.box_price === null ? '—' : `$ ${formatoDinero(l.boxes * Number(l.box_price))}`}
                                                </td>
                                                <td className="px-3 py-2">{l.order_number || '—'}</td>
                                                <td className="px-3 py-2 text-xs text-gray-600">{l.notes || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Resumen por cliente */}
                            <div className="rounded-xl border overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-primario-claro text-primario">
                                        <tr>
                                            <th className="text-left px-4 py-2 uppercase">Cliente</th>
                                            <th className="text-right px-4 py-2 uppercase">Contrato</th>
                                            <th className="text-right px-4 py-2 uppercase">Spot</th>
                                            <th className="text-right px-4 py-2 uppercase">Total cajas</th>
                                            <th className="text-right px-4 py-2 uppercase">Monto (USD)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resumen.map((r) => (
                                            <tr key={r.customer_id} className="border-t">
                                                <td className="px-4 py-2 font-medium">{r.nombre}</td>
                                                <td className="px-4 py-2 text-right">{formatoCajas(r.contrato)}</td>
                                                <td className="px-4 py-2 text-right">{formatoCajas(r.spot)}</td>
                                                <td className="px-4 py-2 text-right font-semibold">{formatoCajas(r.contrato + r.spot)}</td>
                                                <td className="px-4 py-2 text-right">
                                                    {formatoDinero(r.monto)}
                                                    {r.sinPrecio > 0 && <span className="block text-xs text-amber-600">{formatoCajas(r.sinPrecio)} cajas sin precio</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 border-t-2">
                                        <tr>
                                            <td className="px-4 py-2 font-bold">TOTAL SEMANA {pedido.week}</td>
                                            <td colSpan={2}></td>
                                            <td className="px-4 py-2 text-right font-bold">{formatoCajas(totalCajas)}</td>
                                            <td className="px-4 py-2 text-right font-bold">
                                                {formatoDinero(totalMonto)}
                                                {totalSinPrecio > 0 && <span className="block text-xs font-normal text-amber-600">{formatoCajas(totalSinPrecio)} cajas sin precio</span>}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    )}
                </div>

                {/* Pie: Cerrar (rojo, mismo estándar que Cancelar) y Editar (verde) si el pedido está activo */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t">
                    <button type="button" onClick={onClose} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-cancelar text-cancelar-texto hover:bg-cancelar-hover transition">
                        <X size={16} />
                        Cerrar
                    </button>
                    <button type="button" onClick={() => window.print()} disabled={!pedido} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-primario text-white hover:bg-primario-hover disabled:opacity-50 transition">
                        <Printer size={16} />
                        Imprimir
                    </button>
                    {pedido?.status && (
                        <button type="button" onClick={onEditar} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover transition">
                            <Pencil size={16} />
                            Editar pedido
                        </button>
                    )}
                </div>
            </div>
        </div>
        </>
    );
}
