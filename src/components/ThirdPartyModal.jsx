// Modal para crear y editar terceros (productores, comercializadoras, proveedores, clientes)
import { useState, useEffect } from 'react';
import { createThirdParty, updateThirdParty } from '../api/thirdParties';
import { X } from 'lucide-react';

export default function ThirdPartyModal({ thirdParty, onClose, onGuardado }) {
    const [form, setForm] = useState({
        name: '',
        type: 'PRODUCTOR',
        identification: '',
        zone: '',
        phone: '',
        email: '',
        status: true,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (thirdParty) {
            setForm(thirdParty);
        }
    }, [thirdParty]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (thirdParty) {
                await updateThirdParty(thirdParty.id, form);
            } else {
                await createThirdParty(form);
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

                {/* Header del modal */}
                <div className="flex justify-between items-center px-7 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-[#0a4f3e]">
                        {thirdParty ? 'Editar tercero' : 'Nuevo tercero'}
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

                    {/* Fila 1: Nombre + Tipo */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre *</label>
                            <input
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                maxLength={255}
                                placeholder="Ej: Hacienda La Esperanza"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipo *</label>
                            <select
                                name="type"
                                value={form.type}
                                onChange={handleChange}
                                required
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            >
                                <option value="PRODUCTOR">Productor</option>
                                <option value="COMERCIALIZADORA">Comercializadora</option>
                                <option value="PROVEEDOR">Proveedor</option>
                                <option value="CLIENTE">Cliente</option>
                            </select>
                        </div>
                    </div>

                    {/* Fila 2: Identificación + Zona */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">RUC / Identificación</label>
                            <input
                                name="identification"
                                value={form.identification || ''}
                                onChange={handleChange}
                                maxLength={50}
                                placeholder="Ej: 0912345678001"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Zona</label>
                            <input
                                name="zone"
                                value={form.zone || ''}
                                onChange={handleChange}
                                maxLength={100}
                                placeholder="Ej: Machala"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            />
                        </div>
                    </div>

                    {/* Fila 3: Teléfono + Email */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Teléfono</label>
                            <input
                                name="phone"
                                value={form.phone || ''}
                                onChange={handleChange}
                                maxLength={30}
                                placeholder="Ej: 0991234567"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                            <input
                                name="email"
                                type="email"
                                value={form.email || ''}
                                onChange={handleChange}
                                maxLength={255}
                                placeholder="Ej: contacto@ejemplo.com"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            />
                        </div>
                    </div>

                    {/* Activo */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            name="status"
                            checked={form.status}
                            onChange={handleChange}
                            id="status"
                            className="w-4 h-4 accent-[#3B5BDB]"
                        />
                        <label htmlFor="status" className="text-sm text-gray-700">Tercero activo</label>
                    </div>

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
                            className="px-5 py-2.5 text-sm font-semibold bg-[#3B5BDB] text-white rounded-lg hover:bg-[#2F49B8] disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : thirdParty ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
