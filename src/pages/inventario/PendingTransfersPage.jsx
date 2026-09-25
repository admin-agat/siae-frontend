// PendingTransfersPage.jsx
// Bandeja del Coordinador de Inventario: lista las transferencias entre
// bodegas que están en estado PENDIENTE (el EGRESO ya salió de la bodega
// origen, pero el INGRESO en destino todavía no existe). Cada transferencia
// se puede VER (solo lectura), CONFIRMAR (verde, crea el INGRESO en destino)
// o CANCELAR (rojo, desactiva el EGRESO y el stock vuelve a la bodega
// origen) — misma paleta Guardar-verde/Cancelar-rojo del resto del sistema.
import { useState, useEffect, Fragment } from 'react';
import { CheckCircle2, ArrowRight, AlertTriangle, Eye, XCircle } from 'lucide-react';
import { getPendingTransfers, confirmTransfer, cancelTransfer } from '../../api/inventoryMovements';

export default function PendingTransfersPage() {
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

    return (
        <div className="max-w-full mx-auto p-6 space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-gray-800">Transferencias Pendientes</h1>
                <p className="text-gray-500 text-sm">
                    Transferencias entre bodegas esperando confirmación de recepción
                </p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-[#3B5BDB] text-white">
                        <tr>
                            <th className="text-left px-4 py-3">Origen → Destino</th>
                            <th className="text-left px-4 py-3">Fecha</th>
                            <th className="text-left px-4 py-3">Guía de remisión</th>
                            <th className="text-left px-4 py-3">Insumos</th>
                            <th className="text-center px-4 py-3 w-72">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cargando ? (
                            <tr>
                                <td colSpan={5} className="text-center px-4 py-8 text-gray-400">
                                    Cargando transferencias pendientes...
                                </td>
                            </tr>
                        ) : transferencias.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center px-4 py-8 text-gray-400">
                                    No hay transferencias pendientes de confirmación
                                </td>
                            </tr>
                        ) : (
                            transferencias.map((t, index) => (
                                <tr
                                    key={t.id}
                                    className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                                >
                                    <td className="px-4 py-3 font-semibold text-gray-800">
                                        <span className="flex items-center gap-1.5">
                                            {t.warehouse?.name}
                                            <ArrowRight size={13} className="text-gray-400" />
                                            {t.destination_warehouse?.name}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">{formatearFecha(t.date)}</td>
                                    <td className="px-4 py-3">{t.delivery_note || '—'}</td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {t.lines.map((l) => l.supply?.name).join(', ')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => abrirModalVer(t)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
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
                                            {/* Cancelar — rojo sólido con texto blanco + ícono X,
                                                mismo color coral (#e2593f/#c94a32 hover) que
                                                ModalShell.jsx usa para Cancelar en todos los modales */}
                                            <button
                                                onClick={() => abrirCancelacionDirecta(t)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition"
                                                style={{ backgroundColor: '#e2593f' }}
                                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#c94a32')}
                                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e2593f')}
                                            >
                                                <XCircle size={14} />
                                                Cancelar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
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

                        <table className="w-full text-sm mb-2">
                            <thead className="bg-gray-100 text-gray-600">
                                <tr>
                                    <th className="text-left px-3 py-2">Insumo</th>
                                    <th className="text-right px-3 py-2 w-32">Cantidad enviada</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transferenciaAVer.lines.map((linea) => (
                                    <tr key={linea.supply_id} className="border-b">
                                        <td className="px-3 py-2">
                                            {linea.supply?.code ? `${linea.supply.code} — ` : ''}
                                            {linea.supply?.name}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
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
                                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
                                        style={{ backgroundColor: '#e2593f' }}
                                        onMouseEnter={(e) => !cancelando && (e.currentTarget.style.backgroundColor = '#c94a32')}
                                        onMouseLeave={(e) => !cancelando && (e.currentTarget.style.backgroundColor = '#e2593f')}
                                    >
                                        <XCircle size={14} />
                                        {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center mt-5">
                                <button
                                    onClick={() => setConfirmandoCancelacion(true)}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border text-[#e2593f] hover:bg-red-50"
                                    style={{ borderColor: '#e2593f' }}
                                >
                                    <XCircle size={14} />
                                    Cancelar transferencia
                                </button>
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

                        <table className="w-full text-sm mb-2">
                            <thead className="bg-gray-100 text-gray-600">
                                <tr>
                                    <th className="text-left px-3 py-2">Insumo</th>
                                    <th className="text-right px-3 py-2 w-28">Enviado</th>
                                    <th className="text-right px-3 py-2 w-32">Recibido</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineasModal.map((linea, index) => (
                                    <Fragment key={linea.supply_id}>
                                        <tr className="border-b">
                                            <td className="px-3 py-2">{linea.supply_name}</td>
                                            <td className="px-3 py-2 text-right text-gray-500">
                                                {linea.cantidad_enviada}
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={linea.quantity}
                                                    onChange={(e) => actualizarLineaModal(index, 'quantity', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                                                />
                                            </td>
                                        </tr>
                                        {necesitaMotivo(linea) && (
                                            <tr className="bg-amber-50 border-b border-amber-200">
                                                <td colSpan={3} className="px-3 py-3">
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