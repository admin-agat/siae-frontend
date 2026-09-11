// Modal para crear/editar un Barco, siempre asociado a una Naviera fija
// (se abre desde el detalle expandido de esa naviera en ShippingLinesPage).
import { useState, useEffect, useRef } from 'react';
import { createVessel, updateVessel } from '../api/vessels';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';

export default function VesselModal({ vessel, shippingLineId, onClose, onGuardado }) {
    const esEdicion = Boolean(vessel?.id);

    const [name, setName] = useState('');
    const formInicialRef = useRef(null);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    useEffect(() => {
        const nombreInicial = vessel?.name || '';
        setName(nombreInicial);
        formInicialRef.current = nombreInicial;
    }, [vessel]);

    const hayCambiosSinGuardar = () => {
        if (formInicialRef.current === null) return false;
        return name !== formInicialRef.current;
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
            setError('EL NOMBRE DEL BARCO ES OBLIGATORIO');
            return;
        }

        setGuardando(true);
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            const data = { name: name.trim().toUpperCase(), shipping_line_id: shippingLineId };

            if (esEdicion) {
                await updateVessel(vessel.id, data);
            } else {
                await createVessel(data);
            }

            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('ERROR AL GUARDAR EL BARCO:', err);
            setError(
                err.response?.data?.message || getMensajeError('barco', accion)
            );
            setGuardando(false);
        }
    };

    return (
        <>
            <ModalShell
                title={esEdicion ? 'Editar barco' : 'Nuevo barco'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={guardando}
                error={error}
                toast={mostrarExito ? getMensajeExito('barco', esEdicion ? 'actualizar' : 'crear') : ''}
                size="sm"
            >
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre del barco *</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value.toUpperCase())}
                        placeholder="Ej: MSC ANNA"
                        required
                        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </ModalShell>

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