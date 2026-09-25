// PurchaseOrdersPage.jsx
// Listado de Órdenes de Compra (OC). Cada fila muestra el código generado,
// proveedor, bodega destino, fecha/semana y estado (PENDIENTE hasta que se
// reciba vía InventoryMovementFormPage). Desde aquí se navega a crear una
// nueva OC, ver el detalle de una existente, o cancelarla/cerrarla (con
// motivo obligatorio) si todavía está PENDIENTE o PARCIAL.
//
// Importante: el backend decide automáticamente el estado destino según lo
// ya recibido (PurchaseOrderController@cancel) — PENDIENTE (nada recibido)
// pasa a CANCELADA, PARCIAL (ya hay INGRESO real en bodega) pasa a CERRADA.
// El frontend nunca envía el estado destino, solo refleja esa decisión.
import { useState, useEffect, useMemo } from 'react';
import { Plus, Eye, Ban, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPurchaseOrders, cancelPurchaseOrder } from '../../api/purchaseOrders';

const PAGE_SIZE = 10;

const ESTADO_ESTILOS = {
    PENDIENTE: 'bg-amber-100 text-amber-800',
    PARCIAL: 'bg-blue-100 text-blue-800',
    COMPLETA: 'bg-green-100 text-green-800',
    RECIBIDA: 'bg-green-100 text-green-800',
    CANCELADA: 'bg-red-100 text-red-800',
    // CERRADA: ni verde (no se completó) ni rojo (sí llegó algo, no fue
    // una cancelación en blanco) — gris/ámbar propio para diferenciarlo
    // de un vistazo en la tabla.
    CERRADA: 'bg-gray-200 text-gray-700',
};

// Estados desde los que SÍ se puede cancelar/cerrar una orden. COMPLETA,
// CANCELADA y CERRADA quedan fuera (el backend también lo rechaza, esto es
// solo para no mostrar un botón que de todas formas va a fallar).
const ESTADOS_CANCELABLES = ['PENDIENTE', 'PARCIAL'];

export default function PurchaseOrdersPage() {
    const navigate = useNavigate();

    const [ordenes, setOrdenes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('TODOS');
    const [pagina, setPagina] = useState(1);

    // Estado del modal de cancelación: null cuando está cerrado, o la
    // orden que se quiere cancelar/cerrar mientras el modal está abierto.
    const [ordenACancelar, setOrdenACancelar] = useState(null);
    const [motivoCancelacion, setMotivoCancelacion] = useState('');
    const [cancelando, setCancelando] = useState(false);
    const [errorCancelacion, setErrorCancelacion] = useState('');

    // Toast local (mismo patrón del resto del sistema: sin librería,
    // estado propio con auto-hide).
    const [toast, setToast] = useState(null);

    useEffect(() => {
        cargarOrdenes();
    }, []);

    const cargarOrdenes = async () => {
        setCargando(true);
        setError('');
        try {
            const res = await getPurchaseOrders();
            setOrdenes(res.data);
        } catch (err) {
            console.error('ERROR AL CARGAR ÓRDENES DE COMPRA:', err);
            setError('NO SE PUDIERON CARGAR LAS ÓRDENES DE COMPRA');
        } finally {
            setCargando(false);
        }
    };

    // Ayuda a decidir, ANTES de llamar al backend, si la acción sobre esta
    // orden va a cerrar (PARCIAL) o cancelar (PENDIENTE) — solo para texto
    // en pantalla; la decisión real y definitiva la toma el backend.
    const esCierre = (orden) => orden?.status === 'PARCIAL';

    const abrirModalCancelar = (orden) => {
        setOrdenACancelar(orden);
        setMotivoCancelacion('');
        setErrorCancelacion('');
    };

    const cerrarModalCancelar = () => {
        if (cancelando) return; // evita cerrar a mitad de una petición en curso
        setOrdenACancelar(null);
        setMotivoCancelacion('');
        setErrorCancelacion('');
    };

    const confirmarCancelacion = async () => {
        if (motivoCancelacion.trim().length < 3) {
            setErrorCancelacion('EL MOTIVO DEBE TENER AL MENOS 3 CARACTERES');
            return;
        }

        setCancelando(true);
        setErrorCancelacion('');
        try {
            const res = await cancelPurchaseOrder(ordenACancelar.id, motivoCancelacion.trim());

            // Toma el estado final DEL BACKEND (res.data.status), nunca lo
            // asume en el frontend — es el backend quien decide CANCELADA
            // vs CERRADA según lo que ya se había recibido.
            const estadoFinal = res.data.status;

            // Actualiza la fila en memoria sin tener que recargar todo el listado
            setOrdenes((prev) =>
                prev.map((o) =>
                    o.id === ordenACancelar.id
                        ? { ...o, status: estadoFinal, cancellation_reason: motivoCancelacion.trim() }
                        : o
                )
            );

            const mensajeToast =
                estadoFinal === 'CERRADA'
                    ? `ORDEN ${ordenACancelar.code} CERRADA — LO YA RECIBIDO QUEDA EN INVENTARIO`
                    : `ORDEN ${ordenACancelar.code} CANCELADA CORRECTAMENTE`;

            setToast({ tipo: 'exito', mensaje: mensajeToast });
            setTimeout(() => setToast(null), 2500);

            setOrdenACancelar(null);
            setMotivoCancelacion('');
        } catch (err) {
            console.error('ERROR AL CANCELAR/CERRAR LA ORDEN:', err);
            const mensajeBackend = err?.response?.data?.message;
            setErrorCancelacion(mensajeBackend || 'NO SE PUDO PROCESAR LA ORDEN');
        } finally {
            setCancelando(false);
        }
    };

    const ordenesFiltradas = useMemo(() => {
        return ordenes.filter((o) => {
            const coincideEstado = filtroEstado === 'TODOS' || o.status === filtroEstado;
            const texto = busqueda.trim().toUpperCase();
            const coincideTexto =
                !texto ||
                o.code?.toUpperCase().includes(texto) ||
                o.third_party?.name?.toUpperCase().includes(texto) ||
                o.warehouse?.name?.toUpperCase().includes(texto);
            return coincideEstado && coincideTexto;
        });
    }, [ordenes, busqueda, filtroEstado]);

    const totalPaginas = Math.max(1, Math.ceil(ordenesFiltradas.length / PAGE_SIZE));
    const ordenesPagina = ordenesFiltradas.slice(
        (pagina - 1) * PAGE_SIZE,
        pagina * PAGE_SIZE
    );

    useEffect(() => {
        setPagina(1);
    }, [busqueda, filtroEstado]);

    const formatearFecha = (fechaISO) => {
        if (!fechaISO) return '—';
        const [anio, mes, dia] = fechaISO.split('-');
        return `${dia}/${mes}/${anio}`;
    };

    return (
        <div className="max-w-full mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Órdenes de Compra</h1>
                    <p className="text-gray-500 text-sm">
                        Pedidos a proveedores, pendientes o ya recibidos en bodega
                    </p>
                </div>
                <button
                    onClick={() => navigate('/ordenes-compra/nueva')}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#3B5BDB] text-white rounded-lg hover:bg-[#2F49B8]"
                >
                    <Plus size={16} />
                    Nueva Orden de Compra
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-4 items-center">
                <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                    placeholder="BUSCAR POR CÓDIGO, PROVEEDOR O BODEGA..."
                    className="flex-1 min-w-[240px] bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none uppercase"
                />
                <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                >
                    <option value="TODOS">Todos los estados</option>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="PARCIAL">Parcial</option>
                    <option value="COMPLETA">Completa</option>
                    <option value="CERRADA">Cerrada</option>
                    <option value="CANCELADA">Cancelada</option>
                </select>
            </div>

            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-[#3B5BDB] text-white">
                        <tr>
                            <th className="text-left px-4 py-3">Código</th>
                            <th className="text-left px-4 py-3">Proveedor</th>
                            <th className="text-left px-4 py-3">Bodega destino</th>
                            <th className="text-left px-4 py-3">Fecha</th>
                            <th className="text-center px-4 py-3 w-20">Semana</th>
                            <th className="text-center px-4 py-3 w-32">Estado</th>
                            <th className="text-center px-4 py-3 w-24">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cargando ? (
                            <tr>
                                <td colSpan={7} className="text-center px-4 py-8 text-gray-400">
                                    Cargando órdenes de compra...
                                </td>
                            </tr>
                        ) : ordenesPagina.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center px-4 py-8 text-gray-400">
                                    No hay órdenes de compra que coincidan con el filtro
                                </td>
                            </tr>
                        ) : (
                            ordenesPagina.map((orden, index) => (
                                <tr
                                    key={orden.id}
                                    className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                                >
                                    <td className="px-4 py-3 font-semibold text-gray-800">{orden.code}</td>
                                    <td className="px-4 py-3">{orden.third_party?.name || '—'}</td>
                                    <td className="px-4 py-3">{orden.warehouse?.name || '—'}</td>
                                    <td className="px-4 py-3">{formatearFecha(orden.date)}</td>
                                    <td className="px-4 py-3 text-center">{orden.week ?? '—'}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                ESTADO_ESTILOS[orden.status] || 'bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                            {orden.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-3">
                                            <button
                                                onClick={() => navigate(`/ordenes-compra/${orden.id}`)}
                                                className="text-gray-500 hover:text-[#3B5BDB]"
                                                title="Ver detalle"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {ESTADOS_CANCELABLES.includes(orden.status) && (
                                                <button
                                                    onClick={() => abrirModalCancelar(orden)}
                                                    className="text-gray-500 hover:text-red-600"
                                                    title={esCierre(orden) ? 'Cerrar orden' : 'Cancelar orden'}
                                                >
                                                    {/* PARCIAL usa un candado (Lock) para diferenciarlo
                                                        visualmente de una cancelación en blanco (Ban) */}
                                                    {esCierre(orden) ? <Lock size={16} /> : <Ban size={16} />}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {totalPaginas > 1 && (
                    <div className="flex justify-between items-center px-4 py-3 border-t bg-gray-50 text-sm">
                        <span className="text-gray-500">
                            Página {pagina} de {totalPaginas} — {ordenesFiltradas.length} orden(es)
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                                disabled={pagina === 1}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                                disabled={pagina === totalPaginas}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de cancelación/cierre — modal propio en React, nunca
                confirm() nativo (Chrome lo bloquea después de varios usos).
                El título, texto y botón cambian según si la orden está
                PARCIAL (cierre) o PENDIENTE (cancelación real). */}
            {ordenACancelar && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-1">
                            {esCierre(ordenACancelar) ? 'Cerrar' : 'Cancelar'} orden {ordenACancelar.code}
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">
                            {esCierre(ordenACancelar)
                                ? 'Esta orden ya tiene material recibido en bodega. Al cerrarla, lo ya recibido queda intacto en inventario y solo se marca que no se espera el resto. Indica el motivo:'
                                : 'Esta acción cambia el estado a CANCELADA. Indica el motivo:'}
                        </p>

                        <textarea
                            value={motivoCancelacion}
                            onChange={(e) => setMotivoCancelacion(e.target.value.toUpperCase())}
                            placeholder="EJ: PROVEEDOR NO PUDO CUMPLIR CON LA ENTREGA..."
                            rows={4}
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none uppercase resize-none"
                            autoFocus
                        />

                        {errorCancelacion && (
                            <p className="text-red-600 text-xs mt-2">{errorCancelacion}</p>
                        )}

                        <div className="flex justify-end gap-3 mt-5">
                            <button
                                onClick={cerrarModalCancelar}
                                disabled={cancelando}
                                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Volver
                            </button>
                            <button
                                onClick={confirmarCancelacion}
                                disabled={cancelando}
                                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {cancelando
                                    ? 'Procesando...'
                                    : esCierre(ordenACancelar)
                                        ? 'Confirmar cierre'
                                        : 'Confirmar cancelación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast de éxito, mismo patrón visual del resto del sistema */}
            {toast && (
                <div className="fixed bottom-6 right-6 bg-green-100 text-green-800 text-sm font-medium px-4 py-3 rounded-lg shadow-lg z-50">
                    {toast.mensaje}
                </div>
            )}
        </div>
    );
}