// Modal para crear/editar un Customer (cliente internacional comprador de banano).
// Cada Customer está ligado a un Tercero ya existente (third_party_id).
import { useState, useEffect, useRef } from 'react';
import { createCustomer, updateCustomer } from '../api/customers';
import { getThirdParties } from '../api/thirdParties'; // ajustar nombre real si difiere
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';

const formVacio = {
    third_party_id: '',
    country: '',
    contact_name: '',
    negotiation_type: '',
};

export default function CustomerModal({ customer, onClose, onGuardado }) {
    const esEdicion = Boolean(customer?.id);

    const [form, setForm] = useState(formVacio);
    const formInicialRef = useRef(null);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    const [terceros, setTerceros] = useState([]);

    useEffect(() => {
        getThirdParties({ status: true }).then((res) => setTerceros(res.data));

        const dataInicial = {
            third_party_id: customer?.third_party_id || '',
            country: customer?.country || '',
            contact_name: customer?.contact_name || '',
            negotiation_type: customer?.negotiation_type || '',
        };
        setForm(dataInicial);
        formInicialRef.current = dataInicial;
    }, [customer]);

    const hayCambiosSinGuardar = () => {
        if (formInicialRef.current === null) return false;
        return JSON.stringify(form) !== JSON.stringify(formInicialRef.current);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleTextUpperChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value.toUpperCase() }));
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
        setError('');

        if (!form.third_party_id) {
            setError('DEBES SELECCIONAR UN TERCERO');
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

            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('ERROR AL GUARDAR EL CUSTOMER:', err);
            setError(
                err.response?.data?.message || getMensajeError('customer', accion)
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
                title={esEdicion ? 'Editar customer' : 'Nuevo customer'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={guardando}
                error={error}
                toast={mostrarExito ? getMensajeExito('customer', esEdicion ? 'actualizar' : 'crear') : ''}
            >
                <div className="space-y-4">
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
                            <option value="">Seleccionar...</option>
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

                    <div>
                        <label className={labelClass}>Tipo de negociación</label>
                        <input
                            name="negotiation_type"
                            value={form.negotiation_type}
                            onChange={handleTextUpperChange}
                            placeholder="Ej: FOB, CIF..."
                            className={inputClass}
                        />
                    </div>
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