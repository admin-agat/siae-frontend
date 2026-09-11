// Modal para crear/editar un Concepto de Tarifa, siempre asociado a un Puerto fijo
// (se abre desde el detalle del puerto seleccionado en PortsMasterDetailPage).
import { useState, useEffect, useRef } from 'react';
import { History } from 'lucide-react';
import { createPortTariffItem, updatePortTariffItem, getPortTariffItemPriceHistory } from '../api/portTariffItems';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';

export default function PortTariffItemModal({ item, portId, onClose, onGuardado }) {
    const esEdicion = Boolean(item?.id);

    const [form, setForm] = useState({ concept: '', amount: '' });
    const formInicialRef = useRef(null);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    const [mostrandoHistorial, setMostrandoHistorial] = useState(false);
    const [historial, setHistorial] = useState([]);
    const [cargandoHistorial, setCargandoHistorial] = useState(false);

    useEffect(() => {
        const dataInicial = {
            concept: item?.concept || '',
            amount: item?.amount ?? '',
        };
        setForm(dataInicial);
        formInicialRef.current = dataInicial;
        setMostrandoHistorial(false);
    }, [item]);

    const hayCambiosSinGuardar = () => {
        if (formInicialRef.current === null) return false;
        return JSON.stringify(form) !== JSON.stringify(formInicialRef.current);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: name === 'concept' ? value.toUpperCase() : value,
        }));
    };

    const handleCancelar = () => {
        if (hayCambiosSinGuardar()) {
            setMostrarConfirmarSalida(true);
            return;
        }
        onClose();
    };

    const handleVerHistorial = async () => {
        if (!item) return;
        setCargandoHistorial(true);
        setMostrandoHistorial(true);
        try {
            const res = await getPortTariffItemPriceHistory(item.id);
            setHistorial(res.data);
        } catch (err) {
            console.error('ERROR AL CARGAR HISTORIAL DE PRECIOS:', err);
        } finally {
            setCargandoHistorial(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.concept.trim()) {
            setError('EL CONCEPTO ES OBLIGATORIO');
            return;
        }
        if (form.amount === '' || Number(form.amount) < 0) {
            setError('EL MONTO DEBE SER UN NÚMERO VÁLIDO');
            return;
        }

        setGuardando(true);
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            const data = {
                concept: form.concept.trim(),
                amount: parseFloat(form.amount),
            };

            if (esEdicion) {
                await updatePortTariffItem(item.id, data);
            } else {
                await createPortTariffItem({ ...data, port_id: portId });
            }

            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('ERROR AL GUARDAR EL CONCEPTO DE TARIFA:', err);
            setError(
                err.response?.data?.message || getMensajeError('concepto tarifa', accion)
            );
            setGuardando(false);
        }
    };

    return (
        <>
            <ModalShell
                title={esEdicion ? 'Editar concepto de tarifa' : 'Nuevo concepto de tarifa'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={guardando}
                error={error}
                toast={mostrarExito ? getMensajeExito('concepto tarifa', esEdicion ? 'actualizar' : 'crear') : ''}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Concepto *</label>
                        <input
                            name="concept"
                            value={form.concept}
                            onChange={handleChange}
                            placeholder="Ej: MANIPULEO"
                            required
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Monto (USD) *</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            name="amount"
                            value={form.amount}
                            onChange={handleChange}
                            placeholder="0.00"
                            required
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {esEdicion && (
                        <button
                            type="button"
                            onClick={handleVerHistorial}
                            className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                        >
                            <History size={16} />
                            Ver historial de precios
                        </button>
                    )}

                    {mostrandoHistorial && (
                        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-48 overflow-y-auto">
                            {cargandoHistorial ? (
                                <p className="text-sm text-gray-500">Cargando...</p>
                            ) : historial.length === 0 ? (
                                <p className="text-sm text-gray-500">Sin cambios de precio registrados.</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-600">
                                            <th className="pb-1">Fecha</th>
                                            <th className="pb-1">Anterior</th>
                                            <th className="pb-1">Nuevo</th>
                                            <th className="pb-1">Usuario</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historial.map((h) => (
                                            <tr key={h.id} className="border-t border-gray-200">
                                                <td className="py-1">{new Date(h.changed_at).toLocaleDateString()}</td>
                                                <td className="py-1">${Number(h.old_amount).toFixed(2)}</td>
                                                <td className="py-1">${Number(h.new_amount).toFixed(2)}</td>
                                                <td className="py-1">{h.changedByUser?.name || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
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