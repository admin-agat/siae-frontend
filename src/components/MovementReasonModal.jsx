// MovementReasonModal.jsx
// Modal para crear/editar un Motivo de Movimiento (ej. "Compra a Proveedor",
// "Transferencia a otra Bodega"). Un motivo solo tiene Nombre y Tipo — es un
// catálogo simple, sin líneas ni detalle.
import { useState, useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { createMovementReason, updateMovementReason } from '../api/movementReasons';
// Estándar centralizado de mensajes toast (crear/actualizar/desactivar/reactivar)
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';

export default function MovementReasonModal({ reason, onClose, onGuardado }) {
    const esEdicion = Boolean(reason?.id);

    const [name, setName] = useState('');
    const [type, setType] = useState('INGRESO');

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    // Toast de éxito — mismo patrón visual y mismo helper que los demás modales
    const [mostrarExito, setMostrarExito] = useState(false);

    useEffect(() => {
        if (reason) {
            setName(reason.name || '');
            setType(reason.type || 'INGRESO');
        } else {
            setName('');
            setType('INGRESO');
        }
    }, [reason]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('EL NOMBRE ES OBLIGATORIO');
            return;
        }

        setGuardando(true);
        // 'crear' o 'actualizar', usado tanto para el toast de éxito como el de error
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            const data = { name: name.trim().toUpperCase(), type };

            if (esEdicion) {
                await updateMovementReason(reason.id, data);
            } else {
                await createMovementReason(data);
            }

            // Se muestra el toast de éxito y se espera un momento antes de
            // cerrar, mismo comportamiento que el resto de los modales
            // (antes este cerraba de inmediato sin ninguna confirmación visual)
            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('ERROR AL GUARDAR EL MOTIVO DE MOVIMIENTO:', err);
            // Mensaje de error estandarizado, con fallback al mensaje del backend si existe
            setError(
                err.response?.data?.message || getMensajeError('motivo', accion)
            );
            setGuardando(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative">

                {/* Toast de éxito — texto generado por el helper estandarizado,
                    distingue automáticamente "creado" vs "actualizado" */}
                {mostrarExito && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-10">
                        <CheckCircle size={18} />
                        {getMensajeExito('motivo', esEdicion ? 'actualizar' : 'crear')}
                    </div>
                )}

                <div className="flex justify-between items-center px-6 py-4 border-b">
                    <h2 className="text-lg font-bold text-gray-800">
                        {esEdicion ? 'Editar Motivo' : 'Nuevo Motivo de Movimiento'}
                    </h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre *</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value.toUpperCase())}
                            placeholder="Ej: COMPRA A PROVEEDOR"
                            required
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipo *</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            required
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none"
                        >
                            <option value="INGRESO">INGRESO</option>
                            <option value="EGRESO">EGRESO</option>
                            <option value="DEVOLUCION">DEVOLUCIÓN</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={guardando}
                            className="px-4 py-2.5 text-sm font-semibold bg-[#3B5BDB] text-white rounded-lg hover:bg-[#2F49B8] disabled:opacity-50"
                        >
                            {guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}