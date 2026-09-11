// Modal para crear y editar categorías de insumo (Cartón, Plásticos, Químicos, etc.)
import { useState, useEffect, useRef } from 'react';
import { createSupplyCategory, updateSupplyCategory } from '../api/supplyCategories';
// Estándar centralizado de mensajes toast (crear/actualizar/desactivar/reactivar)
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';

import ModalShell from './common/ModalShell';

const GRUPOS = ['CARTON', 'EMPAQUE', 'CONTENEDOR'];

export default function SupplyCategoryModal({ supplyCategory, onClose, onGuardado }) {
    const esEdicion = Boolean(supplyCategory?.id);

    const [form, setForm] = useState({
        name: '',
        group_label: '',
        chargeable_to_producer: false,
    });

    // Guardamos el estado inicial del formulario para poder comparar y saber
    // si el usuario realmente modificó algo antes de mostrarle la confirmación al cancelar
    const formInicialRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Toast de éxito — mismo patrón visual y mismo helper que WarehouseModal/SupplyModal
    const [mostrarExito, setMostrarExito] = useState(false);
    // Controla el modal propio de "¿seguro que deseas salir?" (reemplaza el confirm() nativo del navegador)
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    useEffect(() => {
        const datosIniciales = {
            name: supplyCategory?.name || '',
            group_label: supplyCategory?.group_label || '',
            chargeable_to_producer: supplyCategory?.chargeable_to_producer ?? false,
        };
        setForm(datosIniciales);
        formInicialRef.current = datosIniciales;
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

    // Compara el formulario actual contra el estado con el que abrió,
    // para saber si hay cambios sin guardar
    const hayCambiosSinGuardar = () => {
        if (!formInicialRef.current) return false;
        return JSON.stringify(form) !== JSON.stringify(formInicialRef.current);
    };

    const handleCancelar = () => {
        if (hayCambiosSinGuardar()) {
            // En vez del confirm() nativo del navegador, se abre el modal propio
            setMostrarConfirmarSalida(true);
            return;
        }
        onClose();
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
        <>
            <ModalShell
                title={esEdicion ? 'Editar categoría de insumo' : 'Nueva categoría de insumo'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={loading}
                error={error}
                toast={mostrarExito ? getMensajeExito('categoria', esEdicion ? 'actualizar' : 'crear') : ''}
                size="sm"
            >
                {/* Grupo (campo simple, sin tabla) */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Grupo *</label>
                    <select
                        name="group_label"
                        value={form.group_label}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Cobrable al productor */}
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <input
                        type="checkbox"
                        id="chargeable_to_producer"
                        checked={form.chargeable_to_producer}
                        onChange={handleCheckboxChange}
                        style={{ accentColor: '#2563eb' }}
                        className="w-4 h-4"
                    />
                    <label htmlFor="chargeable_to_producer" className="text-sm text-gray-700">
                        <span className="font-semibold">Cobrable al productor</span>
                        <span className="block text-xs text-gray-500">
                            Se descuenta del saldo del productor en la liquidación
                        </span>
                    </label>
                </div>
            </ModalShell>

            {/* Modal propio de confirmación al salir (reemplaza el confirm() nativo del navegador) */}
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