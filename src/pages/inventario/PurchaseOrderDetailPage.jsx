// PurchaseOrderDetailPage.jsx
// Vista de detalle de una Orden de Compra: cabecera completa (proveedor + RUC,
// bodega, fecha, semana, estado, quién la creó), tabla de líneas con
// cantidad pedida vs. recibida, y el desglose de IVA/Retención/Total —
// todos estos montos vienen ya calculados desde el backend (PurchaseOrder
// y PurchaseOrderLine exponen sus accessors vía $appends).
//
// Las clases print:* solo aplican al imprimir (Ctrl+P / botón Imprimir);
// en pantalla normal el diseño se ve exactamente igual que antes.
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getPurchaseOrder } from '../../api/purchaseOrders';

const ESTADO_ESTILOS = {
    PENDIENTE: 'bg-amber-100 text-amber-800',
    RECIBIDA: 'bg-green-100 text-green-800',
    CANCELADA: 'bg-red-100 text-red-800',
};

export default function PurchaseOrderDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [orden, setOrden] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        cargarOrden();
    }, [id]);

    const cargarOrden = async () => {
        setCargando(true);
        setError('');
        try {
            const res = await getPurchaseOrder(id);
            setOrden(res.data);
        } catch (err) {
            console.error('ERROR AL CARGAR LA ORDEN DE COMPRA:', err);
            setError('NO SE PUDO CARGAR LA ORDEN DE COMPRA');
        } finally {
            setCargando(false);
        }
    };

    const formatearFecha = (fechaISO) => {
        if (!fechaISO) return '—';
        const [anio, mes, dia] = fechaISO.split('-');
        return `${dia}/${mes}/${anio}`;
    };

    // Estado: cargando — nunca se imprime esta pantalla, sin id de impresión.
    if (cargando) {
        return (
            <div className="max-w-full mx-auto p-6">
                <p className="text-gray-400 text-sm">Cargando orden de compra...</p>
            </div>
        );
    }

    // Estado: error o sin datos — tampoco lleva id de impresión.
    if (error || !orden) {
        return (
            <div className="max-w-full mx-auto p-6 space-y-4">
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                    {error || 'ORDEN DE COMPRA NO ENCONTRADA'}
                </div>
                <button
                    onClick={() => navigate('/ordenes-compra')}
                    className="text-sm font-semibold text-[#3B5BDB] hover:text-[#2F49B8]"
                >
                    ← Volver al listado
                </button>
            </div>
        );
    }

    // Estado: éxito — ESTE es el que realmente se muestra en pantalla,
    // por eso el id="area-impresion" va aquí (lo usa el @media print
    // de src/index.css para saber qué mostrar al imprimir).
    // print:p-6 -> print:p-3: reduce el margen general de la hoja al imprimir.
    return (
        <div id="area-impresion" className="max-w-full mx-auto p-6 print:p-3 space-y-4 print:space-y-2">

            {/* Encabezado de impresión — solo visible al imprimir, oculto en pantalla */}
            <div className="hidden print:flex justify-between items-start pb-2 mb-1 border-b border-gray-800">
                <div className="font-bold text-base">AGAT-ECUAGREEN S.A.</div>
                <div className="text-right text-[10px] text-gray-500 leading-tight">
                    <p>Usuario: {orden.creator?.name || '—'}</p>
                    <p>Fecha de impresión: {new Date().toLocaleDateString('es-EC')}</p>
                </div>
            </div>

            {/* Encabezado en pantalla, con botón volver e Imprimir — oculto al imprimir */}
            <div className="flex items-center gap-3 mb-2 print:hidden">
                <button
                    onClick={() => navigate('/ordenes-compra')}
                    className="text-gray-500 hover:text-[#3B5BDB]"
                    title="Volver al listado"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{orden.code}</h1>
                    <p className="text-gray-500 text-sm">Detalle de la orden de compra</p>
                </div>
                <span
                    className={`ml-auto inline-block px-3 py-1.5 rounded-full text-xs font-semibold ${
                        ESTADO_ESTILOS[orden.status] || 'bg-gray-100 text-gray-700'
                    }`}
                >
                    {orden.status}
                </span>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-[#3B5BDB] text-white px-4 py-2 rounded-lg hover:bg-[#2F49B8] transition"
                >
                    Imprimir
                </button>
            </div>

            {/* Título + estado, versión compacta solo para impresión
                (reemplaza al encabezado de pantalla, que se ocultó arriba) */}
            <div className="hidden print:flex justify-between items-baseline mb-1">
                <h1 className="text-lg font-bold text-gray-800">Orden de Compra: {orden.code}</h1>
                <span className="text-xs font-semibold">{orden.status}</span>
            </div>

            {/* Cabecera — se imprime igual que en pantalla, sin compactar
                (2 filas: Proveedor/Bodega/Fecha/Semana, luego Elaborado por/Referencia) */}
            <div className="bg-white rounded-xl shadow p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-3 gap-4 text-sm">
                    <div>
                        <p className="text-gray-400 text-xs mb-1">Proveedor</p>
                        <p className="font-semibold text-gray-800">{orden.third_party?.name || '—'}</p>
                        {orden.third_party?.identification && (
                            <p className="text-gray-400 text-xs mt-0.5">RUC: {orden.third_party.identification}</p>
                        )}
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs mb-1">Bodega destino</p>
                        <p className="font-semibold text-gray-800">{orden.warehouse?.name || '—'}</p>
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs mb-1">Fecha</p>
                        <p className="font-semibold text-gray-800">{formatearFecha(orden.date)}</p>
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs mb-1">Semana</p>
                        <p className="font-semibold text-gray-800">{orden.week ?? '—'}</p>
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs mb-1">Elaborado por</p>
                        <p className="font-semibold text-gray-800">{orden.creator?.name || '—'}</p>
                    </div>
                    <div className="col-span-2 md:col-span-3 print:col-span-1">
                        <p className="text-gray-400 text-xs mb-1">Referencia / Observación</p>
                        <p className="font-semibold text-gray-800">{orden.reference || '—'}</p>
                    </div>
                </div>
            </div>

            {/* Líneas de detalle */}
            <div className="bg-white rounded-xl shadow print:shadow-none print:border print:border-gray-300 overflow-hidden">
                <div className="px-4 py-3 print:px-2 print:py-1 border-b">
                    <h2 className="font-semibold text-gray-800 print:text-xs">Insumos pedidos</h2>
                </div>
                <div className="overflow-x-auto">
                    {/* print:text-[10px]: la tabla es lo más denso del documento,
                        así que se reduce más que el resto para que quepan
                        varias líneas sin saltar de página */}
                    <table className="w-full text-sm print:text-[10px]">
                        <thead className="bg-[#3B5BDB] text-white print:bg-gray-200 print:text-gray-800">
                            <tr>
                                <th className="text-left px-2 py-2 print:py-1">Insumo</th>
                                <th className="text-right px-2 py-2 print:py-1 w-24">Pedido</th>
                                <th className="text-right px-2 py-2 print:py-1 w-24">Recibido</th>
                                <th className="text-right px-2 py-2 print:py-1 w-24">Precio unit.</th>
                                <th className="text-center px-2 py-2 print:py-1 w-16">% IVA</th>
                                <th className="text-center px-2 py-2 print:py-1 w-16">% Desc</th>
                                <th className="text-center px-2 py-2 print:py-1 w-16">% Ret IR</th>
                                <th className="text-right px-2 py-2 print:py-1 w-24">Subtotal</th>
                                <th className="text-right px-2 py-2 print:py-1 w-24">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orden.lines?.map((linea, index) => (
                                <tr key={linea.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-2 py-1.5 print:py-0.5">
                                        {linea.supply?.code} — {linea.supply?.name}
                                    </td>
                                    <td className="px-2 py-1.5 print:py-0.5 text-right">{linea.quantity_ordered}</td>
                                    <td className="px-2 py-1.5 print:py-0.5 text-right">
                                        {linea.quantity_received > 0 ? (
                                            <span className="text-green-700 font-medium">{linea.quantity_received}</span>
                                        ) : (
                                            <span className="text-gray-400">0</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 print:py-0.5 text-right">${parseFloat(linea.unit_price).toFixed(4)}</td>
                                    <td className="px-2 py-1.5 print:py-0.5 text-center">{linea.tax_rate}%</td>
                                    <td className="px-2 py-1.5 print:py-0.5 text-center">{linea.discount_percent}%</td>
                                    <td className="px-2 py-1.5 print:py-0.5 text-center">{linea.retention_rate}%</td>
                                    <td className="px-2 py-1.5 print:py-0.5 text-right">${parseFloat(linea.subtotal).toFixed(2)}</td>
                                    <td className="px-2 py-1.5 print:py-0.5 text-right font-medium">${parseFloat(linea.total).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Resumen de totales — mismo desglose que Contífico, ya calculado por el backend */}
            <div className="bg-white rounded-xl shadow print:shadow-none print:border print:border-gray-300 p-4 print:p-2">
                <h2 className="font-semibold text-gray-800 mb-3 print:mb-1 print:text-xs">Resumen</h2>
                <div className="flex justify-end">
                    <div className="w-full max-w-xs space-y-1 print:space-y-0 text-sm print:text-xs">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal 15%</span>
                            <span>${parseFloat(orden.subtotal_15).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal 5%</span>
                            <span>${parseFloat(orden.subtotal_5).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal 0%</span>
                            <span>${parseFloat(orden.subtotal_0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>IVA 15%</span>
                            <span>${parseFloat(orden.iva_15).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>IVA 5%</span>
                            <span>${parseFloat(orden.iva_5).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Retención IR</span>
                            <span>-${parseFloat(orden.retencion_total).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-[#3B5BDB] print:text-gray-900 text-base print:text-xs pt-2 print:pt-1 border-t">
                            <span>Total</span>
                            <span>${parseFloat(orden.total).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bloque de firmas — solo visible al imprimir, estilo Contífico.
                print:mt-10 en vez de mt-16: con todo compactado, no hace
                falta tanto espacio para que se vea proporcional. */}
            <div className="hidden print:block print:mt-10">
                <div className="grid grid-cols-3 gap-8 text-center text-xs">
                    <div>
                        <div className="border-t border-gray-800 pt-1">Elaborado por</div>
                    </div>
                    <div>
                        <div className="border-t border-gray-800 pt-1">Aprobado por</div>
                    </div>
                    <div>
                        <div className="border-t border-gray-800 pt-1">Revisado por</div>
                    </div>
                </div>
            </div>
        </div>
    );
}