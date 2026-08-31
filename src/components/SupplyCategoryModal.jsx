// Modal para crear y editar categorías de insumo (Cartón, Plásticos, Químicos, etc.)
import { useState, useEffect } from 'react';
import { createSupplyCategory, updateSupplyCategory } from '../api/supplyCategories';
import { X } from 'lucide-react';

const GRUPOS = ['CARTON', 'EMPAQUE', 'CONTENEDOR'];

export default function SupplyCategoryModal({ supplyCategory, onClose, onGuardado }) {
    const [form, setForm] = useState({
        name: '',
        group_label: '',
        chargeable_to_producer: false,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
        try {
            if (supplyCategory) {
                await updateSupplyCategory(supplyCategory.id, form);
            } else {
                await createSupplyCategory(form);
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
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
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
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                        />
                    </div>

                    {/* Cobrable al productor */}
                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                        <input
                            type="checkbox"
                            id="chargeable_to_producer"
                            checked={form.chargeable_to_producer}
                            onChange={handleCheckboxChange}
                            className="w-4 h-4 accent-[#0F6E56]"
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
                        <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold bg-[#0F6E56] text-white rounded-lg hover:bg-[#0a5a45] disabled:opacity-50">
                            {loading ? 'Guardando...' : supplyCategory ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}