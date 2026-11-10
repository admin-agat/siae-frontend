// Modal de SOLO LECTURA del pedido semanal (botón "Ver" en Pedido semanal).
// Ubicación: src/components/CustomerOrderViewModal.jsx
// Muestra la cabecera, todas las líneas con su precio (el guardado en la línea, no el
// del contrato actual) y el resumen por cliente. Para cambiar algo se usa "Editar".
// 29/10/2026: botón Imprimir (también desde la acción Imprimir de la tabla: imprimirAlAbrir).
// La hoja impresa es un bloque aparte (id="area-impresion", ver @media print en index.css).
// 04/11/2026 (prueba de interfaz): columnas CARGA y NEGOCIACIÓN (antes "Modalidad"/"Tipo", al revés de
// lo que se esperaba), el incoterm va debajo de la negociación, N° pedido y notas debajo del cliente
// (casi siempre estaban vacías), nada se parte en dos líneas, resumen por cliente ARRIBA, fila de
// total en la tabla, encabezado fijo al bajar y el comentario en una fila propia.
import { useState, useEffect, useRef } from 'react';
import { X, Pencil, Printer } from 'lucide-react';
import { getCustomerOrder } from '../api/customerOrders';
import { useAuth } from '../context/AuthContext';
import EstadoBadge from './common/EstadoBadge';
import { marcaConPresentacion } from '../utils/presentaciones';
import { ETIQUETA_MODALIDAD } from '../utils/modalidades';

// 10/11/2026: las 4 modalidades con los nombres de Exportaciones y Logística (utils/modalidades.js)
const TIPOS_CARGA = ETIQUETA_MODALIDAD;

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const formatoDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatoFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');
const sinPrecio = (l) => l.box_price === null || l.box_price === undefined;
const carga = (l) => `${TIPOS_CARGA[l.cargo_type] || l.cargo_type}${l.containers_qty ? ` (${l.containers_qty} × ${formatoCajas(l.boxes_per_container)})` : ''}`;

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
        if (sinPrecio(l)) fila.sinPrecio += l.boxes;
        else fila.monto += l.boxes * Number(l.box_price);
    });
    const totalCajas = lineas.reduce((s, l) => s + l.boxes, 0);
    const totalMonto = resumen.reduce((s, r) => s + r.monto, 0);
    const totalSinPrecio = resumen.reduce((s, r) => s + r.sinPrecio, 0);
    const conNumeroPedido = lineas.some((l) => l.order_number);

    const th = 'border border-gray-400 px-1.5 py-1 text-left font-semibold bg-gray-100 whitespace-nowrap';
    const td = 'border border-gray-300 px-1.5 py-0.5';
    // Pantalla: encabezado fijo al bajar (sticky dentro del cuerpo del modal) y sin partir el texto
    const thPantalla = 'sticky top-0 z-10 bg-primario text-white px-3 py-2 uppercase whitespace-nowrap';

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
                            <th className={th}>Carga</th>
                            <th className={`${th} text-right`}>Cajas</th>
                            <th className={th}>Puerto</th>
                            <th className={th}>Negociación</th>
                            <th className={th}>Incoterm</th>
                            <th className={`${th} text-right`}>Precio caja</th>
                            <th className={`${th} text-right`}>Monto</th>
                            {conNumeroPedido && <th className={th}>N° pedido</th>}
                            <th className={th}>Notas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lineas.map((l, i) => (
                            <tr key={l.id}>
                                <td className={td}>{i + 1}</td>
                                <td className={td}>{l.customer?.third_party?.name}{l.brand && ` · ${marcaConPresentacion(l.brand.name, l.presentation)}`}</td>
                                <td className={td}>{carga(l)}</td>
                                <td className={`${td} text-right font-semibold whitespace-nowrap`}>{formatoCajas(l.boxes)}</td>
                                <td className={`${td} whitespace-nowrap`}>{l.departure_port?.name}</td>
                                <td className={td}>{l.negotiation_type}</td>
                                <td className={td}>{l.incoterm}</td>
                                <td className={`${td} text-right whitespace-nowrap`}>{sinPrecio(l) ? 'PENDIENTE' : `$ ${formatoDinero(l.box_price)}`}</td>
                                <td className={`${td} text-right whitespace-nowrap`}>{sinPrecio(l) ? '—' : `$ ${formatoDinero(l.boxes * Number(l.box_price))}`}</td>
                                {conNumeroPedido && <td className={td}>{l.order_number || '—'}</td>}
                                <td className={td}>{l.notes || '—'}</td>
                            </tr>
                        ))}
                        <tr className="font-bold">
                            <td className={td} colSpan={3}>TOTAL SEMANA {pedido.week}</td>
                            <td className={`${td} text-right whitespace-nowrap`}>{formatoCajas(totalCajas)}</td>
                            <td className={td} colSpan={4}></td>
                            <td className={`${td} text-right whitespace-nowrap`}>$ {formatoDinero(totalMonto)}</td>
                            <td className={td} colSpan={conNumeroPedido ? 2 : 1}>{totalSinPrecio > 0 ? `${formatoCajas(totalSinPrecio)} cajas sin precio` : ''}</td>
                        </tr>
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

                <div className="px-6 pb-4 overflow-y-auto">
                    {error ? (
                        <p className="text-red-600 text-sm pt-4">{error}</p>
                    ) : !pedido ? (
                        <p className="text-gray-400 text-sm pt-4">Cargando pedido...</p>
                    ) : (
                        <>
                            {/* Cabecera */}
                            <div className="flex flex-wrap gap-x-10 gap-y-3 pt-4 mb-3 text-sm">
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
                            </div>
                            {pedido.comment && (
                                <div className="mb-3 text-sm">
                                    <p className="text-xs text-gray-500 uppercase">Comentario</p>
                                    <p className="text-gray-800">{pedido.comment}</p>
                                </div>
                            )}

                            {/* Resumen por cliente (arriba: se ve sin bajar) */}
                            <div className="flex flex-wrap gap-3 mb-4">
                                {resumen.map((r) => (
                                    <div key={r.customer_id} className="rounded-xl border bg-primario-claro/40 px-4 py-2 text-sm min-w-[200px]">
                                        <p className="font-semibold text-primario">{r.nombre}</p>
                                        <p className="font-bold text-gray-800">{formatoCajas(r.contrato + r.spot)} cajas</p>
                                        <p className="text-xs text-gray-500">Contrato {formatoCajas(r.contrato)} · Spot {formatoCajas(r.spot)}</p>
                                        <p className="text-xs text-gray-700">
                                            $ {formatoDinero(r.monto)}
                                            {r.sinPrecio > 0 && <span className="text-amber-600"> · {formatoCajas(r.sinPrecio)} cajas sin precio</span>}
                                        </p>
                                    </div>
                                ))}
                                <div className="rounded-xl border bg-gray-50 px-4 py-2 text-sm min-w-[200px]">
                                    <p className="font-semibold text-gray-700">TOTAL SEMANA {pedido.week}</p>
                                    <p className="font-bold text-gray-800">{formatoCajas(totalCajas)} cajas</p>
                                    <p className="text-xs text-gray-700">$ {formatoDinero(totalMonto)} conocido</p>
                                    {totalSinPrecio > 0 && <p className="text-xs text-amber-600">{formatoCajas(totalSinPrecio)} cajas sin precio</p>}
                                </div>
                            </div>

                            {/* Líneas (sin overflow en el contenedor para que el encabezado quede fijo al bajar) */}
                            <div className="rounded-xl border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr>
                                            <th className={`${thPantalla} text-left rounded-tl-xl`}>#</th>
                                            <th className={`${thPantalla} text-left`}>Cliente</th>
                                            <th className={`${thPantalla} text-left`}>Carga</th>
                                            <th className={`${thPantalla} text-right`}>Cajas</th>
                                            <th className={`${thPantalla} text-left`}>Puerto</th>
                                            <th className={`${thPantalla} text-left`}>Negociación</th>
                                            <th className={`${thPantalla} text-right`}>Precio caja</th>
                                            <th className={`${thPantalla} text-right rounded-tr-xl`}>Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineas.map((l, i) => (
                                            <tr key={l.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                                <td className="px-3 py-2 font-medium">
                                                    <span className="whitespace-nowrap">{l.customer?.third_party?.name}</span>
                                                    {l.brand && <span className="block text-xs font-normal text-gray-500">{marcaConPresentacion(l.brand.name, l.presentation)}</span>}
                                                    {l.order_number && <span className="block text-xs font-normal text-gray-500">N° pedido: {l.order_number}</span>}
                                                    {l.notes && <span className="block text-xs font-normal text-gray-500 italic max-w-xs">{l.notes}</span>}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="whitespace-nowrap">{TIPOS_CARGA[l.cargo_type] || l.cargo_type}</span>
                                                    {l.containers_qty && (
                                                        <span className="block text-xs text-gray-500">{l.containers_qty} × {formatoCajas(l.boxes_per_container)}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatoCajas(l.boxes)}</td>
                                                <td className="px-3 py-2 whitespace-nowrap">{l.departure_port?.name}</td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                        l.negotiation_type === 'CONTRATO' ? 'bg-primario-claro text-primario' : 'bg-amber-50 text-amber-700'
                                                    }`}>
                                                        {l.negotiation_type}
                                                    </span>
                                                    <span className="block text-xs text-gray-500 mt-0.5">{l.incoterm}</span>
                                                </td>
                                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                                    {sinPrecio(l) ? <span className="text-amber-600 text-xs font-semibold">PENDIENTE</span> : `$ ${formatoDinero(l.box_price)}`}
                                                </td>
                                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                                    {sinPrecio(l) ? '—' : `$ ${formatoDinero(l.boxes * Number(l.box_price))}`}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 border-t-2 font-bold">
                                        <tr>
                                            <td className="px-3 py-2 rounded-bl-xl" colSpan={3}>TOTAL SEMANA {pedido.week}</td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">{formatoCajas(totalCajas)}</td>
                                            <td colSpan={3} className="px-3 py-2 text-right text-xs font-normal text-amber-600">
                                                {totalSinPrecio > 0 && `${formatoCajas(totalSinPrecio)} cajas sin precio`}
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap rounded-br-xl">$ {formatoDinero(totalMonto)}</td>
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
