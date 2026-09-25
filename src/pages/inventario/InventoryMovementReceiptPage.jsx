// InventoryMovementReceiptPage.jsx
// Recibo imprimible de un movimiento de inventario (Ingreso/Egreso), con
// firmas de "Entregado por" / "Recibido por". Se navega aquí justo después
// de guardar el movimiento, pasando el movimiento ya cargado por
// location.state para no pedirlo dos veces. Si la página se recarga (F5)
// y se pierde el state, se vuelve a traer con GET.
//
// NUEVO: si el movimiento tiene producer_quota_id, vino del Despacho de
// Materiales → se muestra como GUÍA DE DESPACHO (vapor, quién retira con
// cédula, firma de la persona que retiró físicamente).
import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { getInventoryMovement } from '../../api/inventoryMovements';

export default function InventoryMovementReceiptPage() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const [movement, setMovement] = useState(location.state?.movement || null);
    const [cargando, setCargando] = useState(!location.state?.movement);
    const [error, setError] = useState('');

    useEffect(() => {
        // Si ya vino por state (caso normal, justo después de guardar), no
        // hace falta pedirlo de nuevo al backend.
        if (movement) return;

        cargarMovimiento();
    }, [id]);

    const cargarMovimiento = async () => {
        try {
            setCargando(true);
            const res = await getInventoryMovement(id);
            setMovement(res.data);
        } catch (err) {
            console.error('ERROR AL CARGAR EL MOVIMIENTO:', err);
            setError('NO SE PUDO CARGAR EL MOVIMIENTO');
        } finally {
            setCargando(false);
        }
    };

    if (cargando) {
        return <div className="p-6 text-sm text-gray-500">Cargando recibo...</div>;
    }

    // NUEVO: a dónde vuelve el botón — un despacho regresa a su pantalla
    const esDespacho = Boolean(movement?.producer_quota_id);
    const rutaVolver = esDespacho ? '/despacho-materiales' : '/stock';
    const textoVolver = esDespacho ? 'Volver a Despacho de Materiales' : 'Volver a Stock';

    if (error || !movement) {
        return (
            <div className="p-6">
                <p className="text-sm text-red-600 mb-4">{error || 'MOVIMIENTO NO ENCONTRADO'}</p>
                <button
                    onClick={() => navigate(rutaVolver)}
                    className="text-sm font-semibold text-[#3B5BDB] hover:text-[#2F49B8]"
                >
                    {textoVolver}
                </button>
            </div>
        );
    }

    const esIngreso = movement.type === 'INGRESO';

    // Título del documento según su origen
    const titulo = esDespacho
        ? 'GUÍA DE DESPACHO DE MATERIALES'
        : `RECIBO DE ${esIngreso ? 'INGRESO' : 'EGRESO'} DE BODEGA`;

    // La etiqueta de cada firma cambia según el sentido del movimiento:
    // en un Ingreso, quien ENTREGA es el proveedor y quien RECIBE es el
    // bodeguero; en un Egreso es al revés (bodega entrega, productor recibe).
    const firmaEntrega = esIngreso
        ? { rol: 'Proveedor', nombre: movement.third_party?.name }
        : { rol: 'Bodega', nombre: movement.warehouse?.name };

    // NUEVO: en un despacho firma la persona que retiró FÍSICAMENTE
    // (a veces el chofer, no el productor), con su cédula.
    const firmaRecibe = esIngreso
        ? { rol: 'Bodeguero', nombre: movement.warehouse?.name }
        : esDespacho
            ? {
                rol: `C.I. ${movement.received_by_document ?? '—'}`,
                nombre: movement.received_by_name,
            }
            : { rol: 'Productor / Comercializadora', nombre: movement.third_party?.name };

    const fechaFormateada = new Date(movement.date + 'T00:00:00').toLocaleDateString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-4">

            {/* Barra de acciones — no se imprime */}
            <div className="flex justify-between items-center print:hidden">
                <button
                    onClick={() => navigate(rutaVolver)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft size={16} />
                    {textoVolver}
                </button>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#3B5BDB] text-white rounded-lg hover:bg-[#2F49B8]"
                >
                    <Printer size={16} />
                    {esDespacho ? 'Imprimir guía' : 'Imprimir recibo'}
                </button>
            </div>

            {/* Área imprimible */}
            <div id="area-impresion" className="bg-white rounded-xl shadow p-8 space-y-6">

                {/* Encabezado */}
                <div className="text-center border-b pb-4">
                    <h1 className="text-lg font-bold text-gray-800">AGAT-ECUAGREEN S.A.</h1>
                    <p className="text-sm font-semibold text-gray-600 mt-1">{titulo}</p>
                    <p className="text-xs text-gray-400 mt-1">Movimiento N° {movement.id}</p>
                </div>

                {/* Datos del movimiento — 3 columnas forzadas en impresión */}
                <div className="grid grid-cols-2 print:grid-cols-3 gap-4 text-sm">
                    <div>
                        <p className="text-xs font-semibold text-gray-500">Bodega</p>
                        <p className="text-gray-800">{movement.warehouse?.name}</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500">Fecha</p>
                        <p className="text-gray-800">{fechaFormateada}</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500">Semana</p>
                        <p className="text-gray-800">{movement.week ?? '—'} / {movement.year ?? '—'}</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500">Motivo</p>
                        <p className="text-gray-800">{movement.reason?.name ?? '—'}</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500">
                            {esIngreso ? 'Proveedor' : 'Productor / Comercializadora'}
                        </p>
                        <p className="text-gray-800">{movement.third_party?.name ?? '—'}</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500">Guía de remisión</p>
                        <p className="text-gray-800">{movement.delivery_note ?? '—'}</p>
                    </div>

                    {/* NUEVO — solo en despachos: vapor y quién retira */}
                    {esDespacho && (
                        <>
                            <div>
                                <p className="text-xs font-semibold text-gray-500">Vapor</p>
                                <p className="text-gray-800">{movement.vapor ?? '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500">Retira</p>
                                <p className="text-gray-800">{movement.received_by_name ?? '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500">Cédula</p>
                                <p className="text-gray-800">{movement.received_by_document ?? '—'}</p>
                            </div>
                        </>
                    )}

                    {movement.purchase_order && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500">Orden de compra</p>
                            <p className="text-gray-800">{movement.purchase_order.code}</p>
                        </div>
                    )}
                    {movement.reference && (
                        <div className="col-span-2 print:col-span-3">
                            <p className="text-xs font-semibold text-gray-500">Referencia / Observación</p>
                            <p className="text-gray-800">{movement.reference}</p>
                        </div>
                    )}
                </div>

                {/* Tabla de insumos — sin precios: es un documento de entrega física,
                    no contable. El valor para el productor sale en la liquidación. */}
                <table className="w-full text-sm border-t border-gray-200 pt-2">
                    <thead>
                        <tr className="border-b border-gray-300">
                            <th className="text-left py-2 font-semibold text-gray-600">Insumo</th>
                            <th className="text-right py-2 font-semibold text-gray-600 w-24">Unidad</th>
                            <th className="text-right py-2 font-semibold text-gray-600 w-32">Cantidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movement.lines.map((linea) => (
                            <tr key={linea.id} className="border-b border-gray-100">
                                <td className="py-2">
                                    <p className="text-gray-800">
                                        {linea.supply?.code} — {linea.supply?.name}
                                    </p>
                                    {/* Ahora sí se guarda (columna agregada en el Paso 6) */}
                                    {linea.reception_note && (
                                        <p className="text-xs text-amber-700 mt-0.5">
                                            Discrepancia: {linea.reception_note}
                                        </p>
                                    )}
                                </td>
                                {/* NUEVO: unidad del insumo (FRASCOS, LIBRAS, CAJAS...) */}
                                <td className="py-2 text-right text-gray-500">{linea.supply?.unit ?? '—'}</td>
                                <td className="py-2 text-right text-gray-800">{linea.quantity}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Firmas */}
                <div className="grid grid-cols-2 gap-8 pt-12 text-center text-sm">
                    <div>
                        <div className="border-t border-gray-400 pt-2">
                            <p className="font-semibold text-gray-700">Entregado por</p>
                            <p className="text-xs text-gray-500">{firmaEntrega.rol}{firmaEntrega.nombre ? ` — ${firmaEntrega.nombre}` : ''}</p>
                        </div>
                    </div>
                    <div>
                        <div className="border-t border-gray-400 pt-2">
                            <p className="font-semibold text-gray-700">Recibido por</p>
                            <p className="text-xs text-gray-500">{firmaRecibe.nombre ? `${firmaRecibe.nombre} — ` : ''}{firmaRecibe.rol}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}