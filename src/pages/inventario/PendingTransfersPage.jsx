// PendingTransfersPage.jsx
// Bandeja del Coordinador de Inventario: lista las transferencias entre
// bodegas que están en estado PENDIENTE (el EGRESO ya salió de la bodega
// origen, pero el INGRESO en destino todavía no existe). Cada transferencia
// se puede VER (solo lectura), CONFIRMAR (verde, crea el INGRESO en destino)
// o CANCELAR (rojo, desactiva el EGRESO y el stock vuelve a la bodega
// origen) — misma paleta Guardar-verde/Cancelar-rojo del resto del sistema.
import { useState, useEffect, Fragment } from 'react';
import { CheckCircle2, ArrowRight, AlertTriangle, Eye, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getPendingTransfers, confirmTransfer, cancelTransfer } from '../../api/inventoryMovements';
import CampoNumero from '../../components/common/CampoNumero';

// 31/10/2026: soloRecibir = vista del bodeguero de destino ("Recibir transferencias"):
// solo confirma lo que llega a su bodega; cancelar sigue siendo del Coordinador.
export default function PendingTransfersPage({ soloRecibir = false }) {
    const [transferencias, setTransferencias] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    // Transferencia actualmente abierta en el modal de confirmación (null =
    // modal cerrado). lineasModal guarda una copia editable de sus líneas.
    const [transferenciaAConfirmar, setTransferenciaAConfirmar] = useState(null);
    const [lineasModal, setLineasModal] = useState([]);
    const [confirmando, setConfirmando] = useState(false);
    const [errorModal, setErrorModal] = useState('');

    // Transferencia abierta en el modal de SOLO VISUALIZACIÓN (null = modal
    // cerrado). Independiente del modal de confirmación.
    const [transferenciaAVer, setTransferenciaAVer] = useState(null);

    // Flujo de cancelación DENTRO del modal "Ver": en vez de un segundo
    // modal apilado, se reemplaza el footer por una confirmación inline.
    // Puede activarse desde el botón "Cancelar transferencia" DENTRO del
    // modal, o directo desde el botón rojo de la fila (ver
    // abrirCancelacionDirecta), que salta directo a esta vista.
    const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);
    const [cancelando, setCancelando] = useState(false);
    const [errorCancelar, setErrorCancelar] = useState('');

    const [toast, setToast] = useState(null);
    // 18/11/2026 (Peter): fila elegida (verde), como las listas compactas
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);
    // 19/11/2026 (Peter): paginación local de 10 en 10 (tabla con formato SAP)
    const POR_PAGINA = 10;
    const [paginaGuardada, setPagina] = useState(1);

    useEffect(() => {
        cargarPendientes();
    }, []);

    const cargarPendientes = async () => {
        setCargando(true);
        setError('');
        try {
            const res = await getPendingTransfers();
            setTransferencias(res.data);
        } catch (err) {
            console.error('ERROR AL CARGAR TRANSFERENCIAS PENDIENTES:', err);
            setError('NO SE PUDIERON CARGAR LAS TRANSFERENCIAS PENDIENTES');
        } finally {
            setCargando(false);
        }
    };

     // Corta solo la parte de fecha (antes de la 'T') antes de partir por
    // guiones — el backend puede mandar 'YYYY-MM-DD' o un timestamp ISO
    // completo ('YYYY-MM-DDTHH:mm:ss.uuuuuuZ') según el cast del campo, y
    // esto funciona con cualquiera de los dos formatos.
    const formatearFecha = (fechaISO) => {
        if (!fechaISO) return '—';
        const soloFecha = fechaISO.split('T')[0];
        const [anio, mes, dia] = soloFecha.split('-');
        return `${dia}/${mes}/${anio}`;
    };

    // Abre el modal precargando cada línea con la cantidad que salió en el
    // EGRESO como valor editable inicial, más un campo de motivo vacío.
    const abrirModalConfirmar = (transferencia) => {
        setTransferenciaAConfirmar(transferencia);
        setLineasModal(
            transferencia.lines.map((l) => ({
                supply_id: l.supply_id,
                supply_name: `${l.supply?.code ?? ''} — ${l.supply?.name ?? ''}`,
                cantidad_enviada: Number(l.quantity),
                quantity: String(l.quantity),
                reception_note: '',
            }))
        );
        setErrorModal('');
    };

    const cerrarModal = () => {
        if (confirmando) return; // evita cerrar a mitad de una petición en curso
        setTransferenciaAConfirmar(null);
        setLineasModal([]);
        setErrorModal('');
    };

    const abrirModalVer = (transferencia) => {
        setTransferenciaAVer(transferencia);
        setConfirmandoCancelacion(false);
        setErrorCancelar('');
    };

    // NUEVO — botón rojo de la fila: abre el mismo modal pero directo en la
    // vista de confirmación de cancelación, sin pasar primero por el
    // detalle. Así el Coordinador no necesita dos clics para cancelar.
    const abrirCancelacionDirecta = (transferencia) => {
        setTransferenciaAVer(transferencia);
        setConfirmandoCancelacion(true);
        setErrorCancelar('');
    };

    const cerrarModalVer = () => {
        if (cancelando) return; // evita cerrar a mitad de una petición en curso
        setTransferenciaAVer(null);
        setConfirmandoCancelacion(false);
        setErrorCancelar('');
    };

    // Segundo clic real que dispara la cancelación en el backend. El primer
    // clic (ya sea "Cancelar transferencia" dentro del modal, o el botón
    // rojo de la fila) solo muestra esta confirmación inline.
    const cancelarTransferencia = async () => {
        setCancelando(true);
        setErrorCancelar('');
        try {
            await cancelTransfer(transferenciaAVer.id);

            // Saca la transferencia cancelada de la lista sin recargar todo
            setTransferencias((prev) => prev.filter((t) => t.id !== transferenciaAVer.id));

            setToast({
                mensaje: `TRANSFERENCIA A ${transferenciaAVer.destination_warehouse?.name} CANCELADA — EL STOCK QUEDÓ EN ${transferenciaAVer.warehouse?.name}`,
            });

            setTransferenciaAVer(null);
            setConfirmandoCancelacion(false);
        } catch (err) {
            console.error('ERROR AL CANCELAR LA TRANSFERENCIA:', err);
            const mensajeBackend = err?.response?.data?.message;
            setErrorCancelar(mensajeBackend || 'NO SE PUDO CANCELAR LA TRANSFERENCIA');
        } finally {
            setCancelando(false);
        }
    };

    const actualizarLineaModal = (index, campo, valor) => {
        setLineasModal((prev) => {
            const copia = [...prev];
            copia[index] = { ...copia[index], [campo]: valor };
            return copia;
        });
    };

    // Una línea necesita motivo cuando lo confirmado es menos que lo que
    // salió originalmente en el EGRESO — mismo criterio que necesitaMotivo()
    // en InventoryMovementFormPage.jsx para la Recepción.
    const necesitaMotivo = (linea) => {
        const confirmada = parseFloat(linea.quantity) || 0;
        return confirmada < linea.cantidad_enviada;
    };

    const confirmarTransferencia = async () => {
        const lineasSinMotivo = lineasModal.filter(
            (l) => necesitaMotivo(l) && !l.reception_note?.trim()
        );
        if (lineasSinMotivo.length > 0) {
            setErrorModal('DEBÉS INDICAR EL MOTIVO DE DISCREPANCIA EN LOS INSUMOS QUE LLEGARON INCOMPLETOS');
            return;
        }

        setConfirmando(true);
        setErrorModal('');
        try {
            await confirmTransfer(transferenciaAConfirmar.id, {
                lines: lineasModal.map((l) => ({
                    supply_id: l.supply_id,
                    quantity: l.quantity,
                    reception_note: l.reception_note?.trim() || null,
                })),
            });

            // Saca la transferencia confirmada de la lista sin recargar todo
            setTransferencias((prev) => prev.filter((t) => t.id !== transferenciaAConfirmar.id));

           setToast({
                mensaje: `TRANSFERENCIA A ${transferenciaAConfirmar.destination_warehouse?.name} CONFIRMADA CORRECTAMENTE`,
            });

            setTransferenciaAConfirmar(null);
            setLineasModal([]);
        } catch (err) {
            console.error('ERROR AL CONFIRMAR LA TRANSFERENCIA:', err);
            const mensajeBackend = err?.response?.data?.message;
            setErrorModal(mensajeBackend || 'NO SE PUDO CONFIRMAR LA TRANSFERENCIA');
        } finally {
            setConfirmando(false);
        }
    };

    // 19/11/2026 (Peter): página visible (al confirmar/cancelar una, si sobran menos páginas muestra la última)
    const totalPaginas = Math.max(1, Math.ceil(transferencias.length / POR_PAGINA));
    const paginaActual = Math.min(paginaGuardada, totalPaginas);
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const filasPagina = transferencias.slice(inicio, inicio + POR_PAGINA);

    return (
        <div className="max-w-full mx-auto p-6 space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-gray-800">
                    {soloRecibir ? 'Recibir transferencias' : 'Transferencias Pendientes'}
                </h1>
                <p className="text-gray-500 text-sm">
                    {soloRecibir
                        ? 'Material enviado a tu bodega: confirma lo que realmente llegó'
                        : 'Transferencias entre bodegas esperando confirmación de recepción'}
                </p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                    {error}
                </div>
            )}

            {/* 19/11/2026 (Peter): tabla con formato SAP (#, filas alternadas, paginación) */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-primario text-white">
                        <tr>
                            {/* 18/11/2026 (Peter): lista compacta como el Pedido semanal (columna #) */}
                            <th className="text-center px-2 py-2 text-xs w-10">#</th>
                            <th className="text-left px-3 py-2 text-xs uppercase whitespace-nowrap">Origen → Destino</th>
                            <th className="text-left px-3 py-2 text-xs uppercase whitespace-nowrap">Fecha</th>
                            <th className="text-left px-3 py-2 text-xs uppercase whitespace-nowrap">Guía de remisión</th>
                            <th className="text-left px-3 py-2 text-xs uppercase whitespace-nowrap">Insumos</th>
                            <th className="text-center px-3 py-2 text-xs uppercase whitespace-nowrap w-72">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cargando ? (
                            <tr>
                                <td colSpan={6} className="text-center px-4 py-8 text-gray-400">
                                    Cargando transferencias pendientes...
                                </td>
                            </tr>
                        ) : transferencias.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center px-4 py-8 text-gray-400">
                                    No hay transferencias pendientes de confirmación
                                </td>
                            </tr>
                        ) : (
                            filasPagina.map((t, index) => (
                                <tr
                                    key={t.id}
                                    onClick={() => setFilaSeleccionada(t.id)}
                                    className={`cursor-pointer ${filaSeleccionada === t.id ? 'fila-elegida bg-green-600 text-white' : (index % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-violet-50 hover:bg-yellow-50')}`}
                                >
                                    <td className="bg-gray-200 border border-gray-300 px-1 py-1.5 text-center text-sm font-bold text-gray-700">{inicio + index + 1}</td>
                                    <td className="px-3 py-1.5 border border-gray-200 font-semibold text-gray-800">
                                        <span className="flex items-center gap-1.5">
                                            {t.warehouse?.name}
                                            <ArrowRight size={13} className="text-gray-400" />
                                            {t.destination_warehouse?.name}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 border border-gray-200">{formatearFecha(t.date)}</td>
                                    <td className="px-3 py-1.5 border border-gray-200">{t.delivery_note || '—'}</td>
                                    <td className="px-3 py-1.5 border border-gray-200 text-gray-600">
                                        {t.lines.map((l) => l.supply?.name).join(', ')}
                                    </td>
                                    <td className="px-3 py-1.5 border border-gray-200">
                                        <div className="flex items-center justify-center gap-2">
                                            {/* 18/11/2026 (Peter): botones de acciones con el estándar de color (Ver en azul primario) */}
                                            <button
                                                onClick={() => abrirModalVer(t)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primario text-white rounded-lg hover:bg-primario-hover"
                                            >
                                                <Eye size={14} />
                                                Ver
                                            </button>
                                            {/* Confirmar — verde, mismo patrón Guardar-verde del resto
                                                del sistema (antes estaba en azul #3B5BDB) */}
                                            <button
                                                onClick={() => abrirModalConfirmar(t)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700"
                                            >
                                                <CheckCircle2 size={14} />
                                                Confirmar
                                            </button>
                                            {/* Cancelar transferencia — acción de peligro → rojo (red-600) de la paleta */}
                                            {!soloRecibir && (
                                                <button
                                                    onClick={() => abrirCancelacionDirecta(t)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                                                >
                                                    <XCircle size={14} />
                                                    Cancelar
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {!cargando && transferencias.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                        <span className="text-xs text-gray-500">
                            Mostrando {inicio + 1}–{Math.min(inicio + POR_PAGINA, transferencias.length)} de {transferencias.length} transferencias
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPagina(Math.max(1, paginaActual - 1))}
                                disabled={paginaActual === 1}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                <ChevronLeft size={16} />
                                Anterior
                            </button>
                            <span className="text-sm text-gray-600 px-2">
                                Página {paginaActual} de {totalPaginas}
                            </span>
                            <button
                                type="button"
                                onClick={() => setPagina(Math.min(totalPaginas, paginaActual + 1))}
                                disabled={paginaActual === totalPaginas}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                Siguiente
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de SOLO VISUALIZACIÓN + flujo de cancelación inline */}
            {transferenciaAVer && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-bold text-gray-800 mb-1">
                            Detalle de transferencia
                        </h2>
                        <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">
                            {transferenciaAVer.warehouse?.name}
                            <ArrowRight size={13} className="text-gray-400" />
                            {transferenciaAVer.destination_warehouse?.name}
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                            <div>
                                <span className="text-gray-400">Fecha</span>
                                <p className="font-medium text-gray-800">
                                    {formatearFecha(transferenciaAVer.date)}
                                </p>
                            </div>
                            <div>
                                <span className="text-gray-400">Guía de remisión</span>
                                <p className="font-medium text-gray-800">
                                    {transferenciaAVer.delivery_note || '—'}
                                </p>
                            </div>
                            {transferenciaAVer.reference && (
                                <div className="col-span-2">
                                    <span className="text-gray-400">Referencia</span>
                                    <p className="font-medium text-gray-800">
                                        {transferenciaAVer.reference}
                                    </p>
                                </div>
                            )}
                        </div>

                        <table className="w-full text-sm mb-2 border-collapse">
                            <thead className="bg-primario text-white text-xs">
                                <tr>
                                    {/* 18/11/2026 (Peter): columna # y filas alternadas */}
                                    <th className="text-center px-2 py-2 text-xs w-10">#</th>
                                    <th className="text-left px-3 py-2">Insumo</th>
                                    <th className="text-right px-3 py-2 w-32">Cantidad enviada</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transferenciaAVer.lines.map((linea, i) => (
                                    <tr key={linea.supply_id} className={i % 2 === 0 ? 'bg-white' : 'bg-violet-50'}>
                                        <td className="bg-gray-200 border border-gray-300 px-1 py-1.5 text-center text-sm font-bold text-gray-700">{i + 1}</td>
                                        <td className="px-3 py-1.5 border border-gray-200">
                                            {linea.supply?.code ? `${linea.supply.code} — ` : ''}
                                            {linea.supply?.name}
                                        </td>
                                        <td className="px-3 py-1.5 border border-gray-200 text-right font-medium">
                                            {Number(linea.quantity).toLocaleString('es-EC')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Confirmación inline de cancelación. Reemplaza el footer
                            normal cuando el Coordinador hace clic en "Cancelar
                            transferencia" DENTRO del modal, o cuando llega directo
                            desde el botón rojo de la fila. */}
                        {confirmandoCancelacion ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-3">
                                <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700 mb-1">
                                    <AlertTriangle size={15} />
                                    ¿Cancelar esta transferencia?
                                </p>
                                <p className="text-xs text-red-600 mb-3">
                                    El envío se anulará y el stock volverá a mostrarse disponible en{' '}
                                    {transferenciaAVer.warehouse?.name}. Esta acción no se puede deshacer.
                                </p>
                                {errorCancelar && (
                                    <p className="text-red-700 text-xs font-medium mb-3">{errorCancelar}</p>
                                )}
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setConfirmandoCancelacion(false)}
                                        disabled={cancelando}
                                        className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        No, volver
                                    </button>
                                    <button
                                        onClick={cancelarTransferencia}
                                        disabled={cancelando}
                                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600"
                                    >
                                        <XCircle size={14} />
                                        {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={`flex items-center mt-5 ${soloRecibir ? 'justify-end' : 'justify-between'}`}>
                                {!soloRecibir && (
                                    <button
                                        onClick={() => setConfirmandoCancelacion(true)}
                                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-red-600 text-red-600 hover:bg-red-50"
                                    >
                                        <XCircle size={14} />
                                        Cancelar transferencia
                                    </button>
                                )}
                                <button
                                    onClick={cerrarModalVer}
                                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                                >
                                    Cerrar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de confirmación — modal propio en React, nunca confirm() nativo */}
            {transferenciaAConfirmar && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-bold text-gray-800 mb-1">
                            Confirmar transferencia
                        </h2>
                        <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">
                            {transferenciaAConfirmar.warehouse?.name}
                            <ArrowRight size={13} className="text-gray-400" />
                            {transferenciaAConfirmar.destination_warehouse?.name}
                        </p>

                        <table className="w-full text-sm mb-2 border-collapse">
                            <thead className="bg-primario text-white text-xs">
                                <tr>
                                    {/* 18/11/2026 (Peter): columna # */}
                                    <th className="text-center px-2 py-2 text-xs w-10">#</th>
                                    <th className="text-left px-3 py-2">Insumo</th>
                                    <th className="text-right px-3 py-2 w-28">Enviado</th>
                                    <th className="text-right px-3 py-2 w-32">Recibido</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineasModal.map((linea, index) => (
                                    <Fragment key={linea.supply_id}>
                                        <tr className={index % 2 === 0 ? 'bg-white' : 'bg-violet-50'}>
                                            <td className="bg-gray-200 border border-gray-300 px-1 py-1.5 text-center text-sm font-bold text-gray-700">{index + 1}</td>
                                            <td className="px-3 py-1.5 border border-gray-200">{linea.supply_name}</td>
                                            <td className="px-3 py-1.5 border border-gray-200 text-right text-gray-500">
                                                {linea.cantidad_enviada}
                                            </td>
                                            <td className="px-3 py-1 border border-gray-200">
                                                <CampoNumero decimales={2}
                                                    value={linea.quantity}
                                                    onChange={(e) => actualizarLineaModal(index, 'quantity', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-primario"
                                                />
                                            </td>
                                        </tr>
                                        {necesitaMotivo(linea) && (
                                            <tr className="bg-amber-50 border-b border-amber-200">
                                                <td colSpan={4} className="px-3 py-3">
                                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1.5">
                                                        <AlertTriangle size={13} />
                                                        Motivo de discrepancia * — llegaron {linea.quantity || 0} de {linea.cantidad_enviada} enviados
                                                    </label>
                                                    <textarea
                                                        value={linea.reception_note}
                                                        onChange={(e) => actualizarLineaModal(index, 'reception_note', e.target.value.toUpperCase())}
                                                        rows={2}
                                                        placeholder="EJ: DAÑO EN EL TRASLADO, FALTANTE AL DESCARGAR, ETC."
                                                        className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>

                        {/* 31/10/2026: el faltante se registra solo como MERMA en la bodega destino */}
                        {lineasModal.some(necesitaMotivo) && (
                            <p className="text-amber-700 text-xs mt-2">
                                Lo que no llegó se registrará como MERMA/DAÑO en{' '}
                                {transferenciaAConfirmar.destination_warehouse?.name}, con el motivo que indiques.
                            </p>
                        )}

                        {errorModal && (
                            <p className="text-red-600 text-xs mt-2">{errorModal}</p>
                        )}

                        <div className="flex justify-end gap-3 mt-5">
                            <button
                                onClick={cerrarModal}
                                disabled={confirmando}
                                className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Volver
                            </button>
                            <button
                                onClick={confirmarTransferencia}
                                disabled={confirmando}
                                className="px-4 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                            >
                                {confirmando ? 'Confirmando...' : 'Confirmar recepción'}
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