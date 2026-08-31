// Modal para crear y editar bodegas
import { useState, useEffect } from 'react';
import { createWarehouse, updateWarehouse } from '../api/warehouses';
import { X } from 'lucide-react';

export default function WarehouseModal({ warehouse, onClose, onGuardado }) {
    const [form, setForm] = useState({
        name: '',
        code: '',
        responsible_user_id: '',
        zone: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (warehouse) {
            setForm({
                name: warehouse.name || '',
                code: warehouse.code || '',
                responsible_user_id: warehouse.responsible_user_id || '',
                zone: warehouse.zone || '',
            });
        }
    }, [warehouse]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const camposMayuscula = ['name', 'code', 'zone'];
        setForm(prev => ({
            ...prev,
            [name]: camposMayuscula.includes(name) ? value.toUpperCase() : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (warehouse) {
                await updateWarehouse(warehouse.id, form);
            } else {
                await createWarehouse(form);
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex justify-between items-center px-7 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-[#0a4f3e]">
                        {warehouse ? 'Editar bodega' : 'Nueva bodega'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={22} />
                    </button>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Nombre de la bodega */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre de la Bodega *</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            required
                            maxLength={255}
                            placeholder="Ej: BODEGA PRINCIPAL"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                        />
                    </div>

                    {/* Fila: Código + Zona */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Código *</label>
                            <input
                                name="code"
                                value={form.code}
                                onChange={handleChange}
                                required
                                maxLength={255}
                                placeholder="Ej: 001"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Zona</label>
                            <input
                                name="zone"
                                value={form.zone}
                                onChange={handleChange}
                                maxLength={255}
                                placeholder="Ej: MACHALA"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                            />
                        </div>
                    </div>

                    {/* Nota: el selector de responsable (dropdown de users) se agrega
                        cuando tengamos el endpoint de usuarios listo para consumir aquí,
                        siguiendo el mismo patrón que el selector de productor en FarmModal */}

                    {/* Botones */}
                    <div className="flex justify-end gap-4 items-center pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-sm font-semibold text-gray-700 hover:text-gray-900 px-2"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 text-sm font-semibold bg-[#0F6E56] text-white rounded-lg hover:bg-[#0a5a45] disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : warehouse ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
