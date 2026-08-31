// Modal para crear y editar motivos de movimiento (Compra a proveedor, Transferencia, etc.)
import { useState, useEffect } from 'react';
import { createMovementReason, updateMovementReason } from '../api/movementReasons';
import { X } from 'lucide-react';

const TIPOS = ['INGRESO', 'EGRESO'];

export default function MovementReasonModal({ reason, onClose, onGuardado }) {
    const [form, setForm] = useState({
        name: '',
        type: 'INGRESO',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Si nos pasan un motivo existente (edición), precargamos sus valores.
    useEffect(() => {
        if (reason) {
            setForm({
                name: reason.name || '',
                type: reason.type || 'INGRESO',
            });
        }
    }, [reason]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({
            ...prev,
            // El nombre siempre se guarda en mayúsculas (estándar de catálogos del sistema).
            [name]: name === 'name' ? value.toUpperCase() : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (reason) {
                await updateMovementReason(reason.id, form);
            } else {
                await createMovementReason(form);
            }
            onGuardado();
            onClose();
        } catch (err) {
            setError('Error al guardar. Verifica los datos.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center px-7 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-[#0a4f3e]">
                        {reason ? 'Editar motivo de movimiento' : 'Nuevo motivo de movimiento'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={22} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Nombre del motivo */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre del motivo *</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            required
                            maxLength={255}
                            placeholder="Ej: COMPRA A PROVEEDOR"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                        />
                    </div>

                    {/* Tipo (Ingreso / Egreso) */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipo *</label>
                        <select
                            name="type"
                            value={form.type}
                            onChange={handleChange}
                            required
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                        >
                            {TIPOS.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-4 items-center pt-4 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-700 hover:text-gray-900 px-2">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold bg-[#0F6E56] text-white rounded-lg hover:bg-[#0a5a45] disabled:opacity-50">
                            {loading ? 'Guardando...' : reason ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}