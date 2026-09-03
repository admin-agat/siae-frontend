// Modal para crear y editar categorías de insumo (Cartón, Plásticos, Químicos, etc.)
import { useState, useEffect } from 'react';
import { createSupplyCategory, updateSupplyCategory } from '../api/supplyCategories';
import { X, CheckCircle } from 'lucide-react';
// Estándar centralizado de mensajes toast (crear/actualizar/desactivar/reactivar)
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';

const GRUPOS = ['CARTON', 'EMPAQUE', 'CONTENEDOR'];

export default function SupplyCategoryModal({ supplyCategory, onClose, onGuardado }) {
    const esEdicion = Boolean(supplyCategory?.id);

    const [form, setForm] = useState({
        name: '',
        group_label: '',
        chargeable_to_producer: false,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Toast de éxito — mismo patrón visual y mismo helper que WarehouseModal/SupplyModal
    const [mostrarExito, setMostrarExito] = useState(false);

    useEffect(() => {
        if (supplyCategory) {
            setForm({
                name: supplyCategory.name || '',
                group_label: supplyCategory.group_label || '',
                chargeable_to_producer: supplyCategory.chargeable_to_producer ?? false,
            });
        }
    }, [supplyCategory]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: name === 'name' ? value.toUpperCase() : value
        }));
    };

    const handleCheckboxChange = (e) => {
        setForm(prev => ({ ...prev, chargeable_to_producer: e.target.checked }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        // 'crear' o 'actualizar', usado tanto para el toast de éxito como el de error
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            if (esEdicion) {
                await updateSupplyCategory(supplyCategory.id, form);
            } else {
                await createSupplyCategory(form);
            }
            // Se muestra el toast de éxito y se espera un momento antes de
            // cerrar, mismo comportamiento que WarehouseModal/SupplyModal
            // (antes este modal cerraba de inmediato sin confirmación visual,
            // por eso el cambio se guardaba pero no se veía ningún mensaje)
            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            // Mensaje de error estandarizado (antes era un texto fijo genérico)
            setError(getMensajeError('categoria', accion));
            console.error(err);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto relative">

                {/* Toast de éxito — texto generado por el helper estandarizado,
                    distingue automáticamente "creada" vs "actualizada" */}
                {mostrarExito && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-10">
                        <CheckCircle size={18} />
                        {getMensajeExito('categoria', esEdicion ? 'actualizar' : 'crear')}
                    </div>
                )}

                <div className="flex justify-between items-center px-7 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-[#0a4f3e]">
                        {supplyCategory ? 'Editar categoría de insumo' : 'Nueva categoría de insumo'}
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

                    {/* Grupo (campo simple, sin tabla) */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Grupo *</label>
                        <select
                            name="group_label"
                            value={form.group_label}
                            onChange={handleChange}
                            required
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                        >
                            <option value="">Seleccionar grupo...</option>
                            {GRUPOS.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    {/* Nombre de la categoría */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre de la categoría *</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            required
                            maxLength={255}
                            placeholder="Ej: CARTÓN"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                        />
                    </div>

                    {/* Cobrable al productor */}
                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                        <input
                            type="checkbox"
                            id="chargeable_to_producer"
                            checked={form.chargeable_to_producer}
                            onChange={handleCheckboxChange}
                            className="w-4 h-4 accent-[#3B5BDB]"
                        />
                        <label htmlFor="chargeable_to_producer" className="text-sm text-gray-700">
                            <span className="font-semibold">Cobrable al productor</span>
                            <span className="block text-xs text-gray-500">
                                Se descuenta del saldo del productor en la liquidación
                            </span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-4 items-center pt-4 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-700 hover:text-gray-900 px-2">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold bg-[#3B5BDB] text-white rounded-lg hover:bg-[#2F49B8] disabled:opacity-50">
                            {loading ? 'Guardando...' : supplyCategory ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}