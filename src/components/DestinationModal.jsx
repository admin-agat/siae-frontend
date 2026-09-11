// Modal para crear/editar un Destino.
import { useState, useEffect, useRef } from 'react';
import { createDestination, updateDestination } from '../api/destinations';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';

export default function DestinationModal({ destino, onClose, onGuardado }) {
    const esEdicion = Boolean(destino?.id);

    const [name, setName] = useState('');
    const formInicialRef = useRef(null);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    useEffect(() => {
        const nombreInicial = destino?.name || '';
        setName(nombreInicial);
        formInicialRef.current = nombreInicial;
    }, [destino]);

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
            setError('EL NOMBRE DEL DESTINO ES OBLIGATORIO');
            return;
        }

        setGuardando(true);
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            const data = { name: name.trim().toUpperCase() };

            if (esEdicion) {
                await updateDestination(destino.id, data);
            } else {
                await createDestination(data);
            }

            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('ERROR AL GUARDAR EL DESTINO:', err);
            setError(
                err.response?.data?.message || getMensajeError('destino', accion)
            );
            setGuardando(false);
        }
    };

    return (
        <>
            <ModalShell
                title={esEdicion ? 'Editar destino' : 'Nuevo destino'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={guardando}
                error={error}
                toast={mostrarExito ? getMensajeExito('destino', esEdicion ? 'actualizar' : 'crear') : ''}
                size="sm"
            >
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre del destino *</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value.toUpperCase())}
                        placeholder="Ej: ROTTERDAM"
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