// Modal para crear/editar un Cliente (cliente internacional comprador de banano, ej. GT, RVI).
// Cada Cliente está ligado a un Tercero ya existente (third_party_id).
// Cambios en esta versión:
//   1. "Tipo de negociación" pasa de texto libre a selector CONTRATO / SPOT
//      (el backend y el CHECK constraint de customers solo aceptan esos dos valores).
//   2. Títulos y textos en español: "cliente" en vez de "customer".
//   3. Mensajes de toast usan la clave 'cliente', que es la registrada en toastMessages.js.
//   4. Carga defensiva de terceros (Array.isArray) para evitar el error ".map is not a function".
import { useState, useEffect, useRef } from 'react';
import { createCustomer, updateCustomer } from '../api/customers';
import { getThirdParties } from '../api/thirdParties';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';

// Únicos valores válidos para la modalidad comercial (mismos del CHECK en la base)
const TIPOS_NEGOCIACION = ['CONTRATO', 'SPOT'];

const formVacio = {
    third_party_id: '',
    country: '',
    contact_name: '',
    negotiation_type: '',
};

export default function CustomerModal({ customer, onClose, onGuardado }) {
    // Es edición solo si el cliente tiene id real (no si llega un objeto parcial)
    const esEdicion = Boolean(customer?.id);

    const [form, setForm] = useState(formVacio);
    const formInicialRef = useRef(null);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    const [terceros, setTerceros] = useState([]);

    useEffect(() => {
        // Carga terceros activos; si la API no devuelve un arreglo, deja la lista vacía
        getThirdParties({ status: true })
            .then((res) => setTerceros(Array.isArray(res.data) ? res.data : []))
            .catch(() => setTerceros([]));

        // Datos iniciales: los del cliente si es edición, vacíos si es nuevo
        const dataInicial = {
            third_party_id: customer?.third_party_id || '',
            country: customer?.country || '',
            contact_name: customer?.contact_name || '',
            negotiation_type: customer?.negotiation_type || '',
        };
        setForm(dataInicial);
        formInicialRef.current = dataInicial; // referencia para detectar cambios sin guardar
    }, [customer]);

    // Compara el formulario actual con el inicial para saber si hay cambios
    const hayCambiosSinGuardar = () => {
        if (formInicialRef.current === null) return false;
        return JSON.stringify(form) !== JSON.stringify(formInicialRef.current);
    };

    // Cambio normal (selectores)
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // Cambio en campos de texto: convierte a MAYÚSCULAS mientras se escribe
    const handleTextUpperChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value.toUpperCase() }));
    };

    // Cancelar: si hay cambios, pide confirmación antes de cerrar
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

        // Validaciones mínimas en el frontend (el backend vuelve a validar)
        if (!form.third_party_id) {
            setError('DEBES SELECCIONAR UN TERCERO');
            return;
        }
        if (!TIPOS_NEGOCIACION.includes(form.negotiation_type)) {
            setError('DEBES SELECCIONAR EL TIPO DE NEGOCIACIÓN (CONTRATO O SPOT)');
            return;
        }

        setGuardando(true);
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            const data = {
                third_party_id: form.third_party_id,
                country: form.country.trim(),
                contact_name: form.contact_name.trim(),
                negotiation_type: form.negotiation_type,
            };

            if (esEdicion) {
                await updateCustomer(customer.id, data);
            } else {
                await createCustomer(data);
            }

            // Muestra el toast de éxito y cierra después de 1.2 s
            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('ERROR AL GUARDAR EL CLIENTE:', err);
            setError(
                err.response?.data?.message || getMensajeError('cliente', accion)
            );
            setGuardando(false);
        }
    };

    const inputClass =
        'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500';
    const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5';

    return (
        <>
            <ModalShell
                title={esEdicion ? 'Editar cliente' : 'Nuevo cliente'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={guardando}
                error={error}
                toast={mostrarExito ? getMensajeExito('cliente', esEdicion ? 'actualizar' : 'crear') : ''}
            >
                <div className="space-y-4">
                    {/* Tercero base: no se puede cambiar al editar */}
                    <div>
                        <label className={labelClass}>Tercero *</label>
                        <select
                            name="third_party_id"
                            value={form.third_party_id}
                            onChange={handleChange}
                            required
                            disabled={esEdicion}
                            className={`${inputClass} disabled:opacity-50`}
                        >
                            <option value="">SELECCIONAR...</option>
                            {terceros.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        {esEdicion && (
                            <p className="text-xs text-gray-400 mt-1">El tercero base no se puede cambiar al editar.</p>
                        )}
                    </div>

                    <div>
                        <label className={labelClass}>País</label>
                        <input
                            name="country"
                            value={form.country}
                            onChange={handleTextUpperChange}
                            placeholder="Ej: RUSIA"
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Nombre de contacto</label>
                        <input
                            name="contact_name"
                            value={form.contact_name}
                            onChange={handleTextUpperChange}
                            placeholder="Ej: IVAN PETROV"
                            className={inputClass}
                        />
                    </div>

                    {/* Modalidad comercial: solo CONTRATO o SPOT (no confundir con incoterm FOB/CIF) */}
                    <div>
                        <label className={labelClass}>Tipo de negociación *</label>
                        <select
                            name="negotiation_type"
                            value={form.negotiation_type}
                            onChange={handleChange}
                            required
                            className={inputClass}
                        >
                            <option value="">SELECCIONAR...</option>
                            {TIPOS_NEGOCIACION.map((tipo) => (
                                <option key={tipo} value={tipo}>{tipo}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </ModalShell>

            {/* Confirmación de salida con cambios sin guardar */}
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