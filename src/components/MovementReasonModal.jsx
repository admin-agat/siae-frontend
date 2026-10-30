// MovementReasonModal.jsx
// Modal para crear/editar un Motivo de Movimiento (ej. "Compra a Proveedor",
// "Transferencia a otra Bodega"). Un motivo solo tiene Nombre y Tipo — es un
// catálogo simple, sin líneas ni detalle.
import { useState, useEffect, useRef } from 'react';
import { createMovementReason, updateMovementReason } from '../api/movementReasons';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';
import SelectBuscable from './common/SelectBuscable';

export default function MovementReasonModal({ reason, onClose, onGuardado }) {
    const esEdicion = Boolean(reason?.id);

    const [name, setName] = useState('');
    const [type, setType] = useState('INGRESO');

    // Guarda el estado inicial del formulario para poder comparar y saber
    // si el usuario realmente modificó algo antes de mostrarle la confirmación al cancelar
    const formInicialRef = useRef(null);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    // Controla el modal propio de "¿seguro que deseas salir?" (reemplaza el confirm() nativo del navegador)
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    useEffect(() => {
        const datosIniciales = {
            name: reason?.name || '',
            type: reason?.type || 'INGRESO',
        };
        setName(datosIniciales.name);
        setType(datosIniciales.type);
        formInicialRef.current = datosIniciales;
    }, [reason]);

    // Compara el formulario actual contra el estado con el que abrió,
    // para saber si hay cambios sin guardar
    const hayCambiosSinGuardar = () => {
        if (!formInicialRef.current) return false;
        return JSON.stringify({ name, type }) !== JSON.stringify(formInicialRef.current);
    };

    const handleCancelar = () => {
        if (hayCambiosSinGuardar()) {
            setMostrarConfirmarSalida(true);
            return;
        }
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('EL NOMBRE ES OBLIGATORIO');
            return;
        }

        setGuardando(true);
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            const data = { name: name.trim().toUpperCase(), type };

            if (esEdicion) {
                await updateMovementReason(reason.id, data);
            } else {
                await createMovementReason(data);
            }

            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('ERROR AL GUARDAR EL MOTIVO DE MOVIMIENTO:', err);
            setError(
                err.response?.data?.message || getMensajeError('motivo', accion)
            );
            setGuardando(false);
        }
    };

    return (
        <>
            <ModalShell
                title={esEdicion ? 'Editar Motivo' : 'Nuevo Motivo de Movimiento'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={guardando}
                error={error}
                toast={mostrarExito ? getMensajeExito('motivo', esEdicion ? 'actualizar' : 'crear') : ''}
                size="sm"
            >
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre *</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value.toUpperCase())}
                        placeholder="Ej: COMPRA A PROVEEDOR"
                        required
                        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipo *</label>
                    <SelectBuscable
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        required
                        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="INGRESO">INGRESO</option>
                        <option value="EGRESO">EGRESO</option>
                        <option value="DEVOLUCION">DEVOLUCIÓN</option>
                    </SelectBuscable>
                </div>
            </ModalShell>

            {/* Modal propio de confirmación al salir (reemplaza el confirm() nativo del navegador) */}
            {mostrarConfirmarSalida && (
                <div className="fixed inset-0 flex items-center justify-center z-[60]" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm px-6 py-6">
                        <h3 className="text-base font-bold text-gray-800 mb-2">¿Seguro que deseas salir?</h3>
                        <p className="text-sm text-gray-500 mb-6">Tienes cambios sin guardar que se perderán.</p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setMostrarConfirmarSalida(false)}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 rounded-lg transition"
                            >
                                Seguir editando
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                            >
                                Salir sin guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}