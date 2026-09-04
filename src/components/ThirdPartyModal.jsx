// Modal para crear y editar terceros (productores, comercializadoras, proveedores, clientes)
import { useState, useEffect, useRef } from 'react';
import { createThirdParty, updateThirdParty } from '../api/thirdParties';
import { X, CheckCircle } from 'lucide-react';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';

const FORM_VACIO = {
    name: '',
    type: 'PRODUCTOR',
    identification: '',
    zone: '',
    phone: '',
    email: '',
    status: true,
};

export default function ThirdPartyModal({ thirdParty, onClose, onGuardado }) {
    const esEdicion = Boolean(thirdParty?.id);

    const [form, setForm] = useState(FORM_VACIO);
    const formInicialRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    useEffect(() => {
        const datosIniciales = thirdParty ? { ...FORM_VACIO, ...thirdParty } : FORM_VACIO;
        setForm(datosIniciales);
        formInicialRef.current = datosIniciales;
    }, [thirdParty]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const hayCambiosSinGuardar = () => {
        if (!formInicialRef.current) return false;
        return JSON.stringify(form) !== JSON.stringify(formInicialRef.current);
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
        setLoading(true);
        setError('');
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            if (esEdicion) {
                await updateThirdParty(thirdParty.id, form);
            } else {
                await createThirdParty(form);
            }
            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            setError(getMensajeError('tercero', accion));
            console.error(err);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">

                {/* Toast de éxito */}
                {mostrarExito && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-10">
                        <CheckCircle size={18} />
                        {getMensajeExito('tercero', esEdicion ? 'actualizar' : 'crear')}
                    </div>
                )}

                {/* Header del modal */}
                <div className="flex justify-between items-center px-7 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-[#0a4f3e]">
                        {esEdicion ? 'Editar tercero' : 'Nuevo tercero'}
                    </h2>
                    <button onClick={handleCancelar} className="text-gray-400 hover:text-gray-600">
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
                            onClick={handleCancelar}
                            className="px-5 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                        >
                            {loading ? 'Guardando...' : esEdicion ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Modal propio de confirmación al salir */}
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
        </div>
    );
}