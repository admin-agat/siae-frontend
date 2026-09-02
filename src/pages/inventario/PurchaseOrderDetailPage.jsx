// PurchaseOrderDetailPage.jsx
// Vista de detalle de una Orden de Compra: cabecera completa (proveedor + RUC,
// bodega, fecha, semana, estado, quién la creó), tabla de líneas con
// cantidad pedida vs. recibida, y el desglose de IVA/Retención/Total —
// todos estos montos vienen ya calculados desde el backend (PurchaseOrder
// y PurchaseOrderLine exponen sus accessors vía $appends).
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

    if (cargando) {
        return (
            <div className="max-w-full mx-auto p-6">
                <p className="text-gray-400 text-sm">Cargando orden de compra...</p>
            </div>
        );
    }

    if (error || !orden) {
        return (
            <div className="max-w-full mx-auto p-6 space-y-4">
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                    {error || 'ORDEN DE COMPRA NO ENCONTRADA'}
                </div>
                <button
                    onClick={() => navigate('/ordenes-compra')}
                    className="text-sm font-semibold text-[#0F6E56] hover:text-[#0a5a45]"
                >
                    ← Volver al listado
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-full mx-auto p-6 space-y-4">
            {/* Encabezado con botón volver */}
            <div className="flex items-center gap-3 mb-2">
                <button
                    onClick={() => navigate('/ordenes-compra')}
                    className="text-gray-500 hover:text-[#0F6E56]"
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
            </div>

            {/* Cabecera */}
            <div className="bg-white rounded-xl shadow p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                    <div className="col-span-2 md:col-span-3">
                        <p className="text-gray-400 text-xs mb-1">Referencia / Observación</p>
                        <p className="font-semibold text-gray-800">{orden.reference || '—'}</p>
                    </div>
                </div>
            </div>

            {/* Líneas de detalle */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="px-4 py-3 border-b">
                    <h2 className="font-semibold text-gray-800">Insumos pedidos</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-[#0F6E56] text-white">
                            <tr>
                                <th className="text-left px-2 py-2">Insumo</th>
                                <th className="text-right px-2 py-2 w-24">Pedido</th>
                                <th className="text-right px-2 py-2 w-24">Recibido</th>
                                <th className="text-right px-2 py-2 w-24">Precio unit.</th>
                                <th className="text-center px-2 py-2 w-16">% IVA</th>
                                <th className="text-center px-2 py-2 w-16">% Desc</th>
                                <th className="text-center px-2 py-2 w-16">% Ret IR</th>
                                <th className="text-right px-2 py-2 w-24">Subtotal</th>
                                <th className="text-right px-2 py-2 w-24">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orden.lines?.map((linea, index) => (
                                <tr key={linea.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-2 py-1.5">
                                        {linea.supply?.code} — {linea.supply?.name}
                                    </td>
                                    <td className="px-2 py-1.5 text-right">{linea.quantity_ordered}</td>
                                    <td className="px-2 py-1.5 text-right">
                                        {linea.quantity_received > 0 ? (
                                            <span className="text-green-700 font-medium">{linea.quantity_received}</span>
                                        ) : (
                                            <span className="text-gray-400">0</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 text-right">${parseFloat(linea.unit_price).toFixed(4)}</td>
                                    <td className="px-2 py-1.5 text-center">{linea.tax_rate}%</td>
                                    <td className="px-2 py-1.5 text-center">{linea.discount_percent}%</td>
                                    <td className="px-2 py-1.5 text-center">{linea.retention_rate}%</td>
                                    <td className="px-2 py-1.5 text-right">${parseFloat(linea.subtotal).toFixed(2)}</td>
                                    <td className="px-2 py-1.5 text-right font-medium">${parseFloat(linea.total).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Resumen de totales — mismo desglose que Contífico, ya calculado por el backend */}
            <div className="bg-white rounded-xl shadow p-4">
                <h2 className="font-semibold text-gray-800 mb-3">Resumen</h2>
                <div className="flex justify-end">
                    <div className="w-full max-w-xs space-y-1 text-sm">
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
                        <div className="flex justify-between font-bold text-[#0F6E56] text-base pt-2 border-t">
                            <span>Total</span>
                            <span>${parseFloat(orden.total).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}