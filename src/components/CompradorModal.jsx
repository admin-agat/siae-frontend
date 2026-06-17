// Modal para crear y editar compradores
import { useState, useEffect } from 'react';
import { createComprador, updateComprador } from '../api/compradores';
import { X } from 'lucide-react';

export default function CompradorModal({ comprador, onClose, onGuardado }) {
    // Si viene un comprador, es edición; si no, es nuevo
    const [form, setForm] = useState({
        razon_social: '',
        pais: '',
        ciudad: '',
        contacto_nombre: '',
        contacto_email: '',
        contacto_telefono: '',
        tipo: 'spot',
        moneda: 'USD',
        condicion_pago: '',
        activo: true,
        observaciones: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Si estamos editando, cargar los datos del comprador
    useEffect(() => {
        if (comprador) {
            setForm(comprador);
        }
    }, [comprador]);

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
            if (comprador) {
                await updateComprador(comprador.id, form);
            } else {
                await createComprador(form);
            }
            onGuardado();  // Recargar la lista
            onClose();     // Cerrar el modal
        } catch (err) {
            setError('Error al guardar. Verifica los datos.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        // Fondo oscuro
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

                {/* Header del modal */}
                <div className="flex justify-between items-center px-6 py-4 border-b">
                    <h2 className="text-lg font-bold text-gray-800">
                        {comprador ? 'Editar comprador' : 'Nuevo comprador'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Fila 1 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Razón Social *</label>
                            <input
                                name="razon_social"
                                value={form.razon_social}
                                onChange={handleChange}
                                required
                                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6E56]"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">País *</label>
                            <input
                                name="pais"
                                value={form.pais}
                                onChange={handleChange}
                                required
                                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6E56]"
                            />
                        </div>
                    </div>

                    {/* Fila 2 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Ciudad</label>
                            <input
                                name="ciudad"
                                value={form.ciudad}
                                onChange={handleChange}
                                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6E56]"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Tipo *</label>
                            <select
                                name="tipo"
                                value={form.tipo}
                                onChange={handleChange}
                                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6E56]"
                            >
                                <option value="spot">Spot</option>
                                <option value="contractual">Contractual</option>
                            </select>
                        </div>
                    </div>

                    {/* Fila 3 — Contacto */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Nombre contacto</label>
                            <input
                                name="contacto_nombre"
                                value={form.contacto_nombre}
                                onChange={handleChange}
                                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6E56]"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Email contacto</label>
                            <input
                                name="contacto_email"
                                value={form.contacto_email}
                                onChange={handleChange}
                                type="email"
                                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6E56]"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Teléfono</label>
                            <input
                                name="contacto_telefono"
                                value={form.contacto_telefono}
                                onChange={handleChange}
                                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6E56]"
                            />
                        </div>
                    </div>

                    {/* Fila 4 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Moneda</label>
                            <select
                                name="moneda"
                                value={form.moneda}
                                onChange={handleChange}
                                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6E56]"
                            >
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="RUB">RUB</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Condición de pago</label>
                            <input
                                name="condicion_pago"
                                value={form.condicion_pago}
                                onChange={handleChange}
                                placeholder="Ej: 30 días"
                                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6E56]"
                            />
                        </div>
                    </div>

                    {/* Observaciones */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">Observaciones</label>
                        <textarea
                            name="observaciones"
                            value={form.observaciones}
                            onChange={handleChange}
                            rows={3}
                            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0F6E56]"
                        />
                    </div>

                    {/* Activo */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            name="activo"
                            checked={form.activo}
                            onChange={handleChange}
                            id="activo"
                            className="w-4 h-4 accent-[#0F6E56]"
                        />
                        <label htmlFor="activo" className="text-sm text-gray-700">Comprador activo</label>
                    </div>

                    {/* Botones */}
                    <div className="flex justify-end gap-3 pt-2 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm bg-[#0F6E56] text-white rounded-lg hover:bg-[#0a5a45] disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : comprador ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}