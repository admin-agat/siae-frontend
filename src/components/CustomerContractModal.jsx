// Modal para crear/editar un Contrato de CLIENTE — src/components/CustomerContractModal.jsx
// Un contrato = cliente + incoterm (opcional) + vigencia (inicio/fin) + precio por caja.
// Usa ModalShell (mismas props que CustomerModal.jsx).
import { useState, useEffect, useRef } from 'react';
import { createCustomerContract, updateCustomerContract } from '../api/customerContracts';
import { getCustomers } from '../api/customers';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';
import SelectBuscable from './common/SelectBuscable';

// Incoterms permitidos (vacío = aplica a cualquiera)
const INCOTERMS = ['FOB', 'CFR', 'CIF'];

const formVacio = {
    contract_number: '',
    customer_id: '',
    incoterm: '',
    start_date: '',
    end_date: '',
    box_price: '',
    weekly_boxes: '',
    comment: '',
};

// Extrae el mensaje real del backend (422 de Laravel o message del servidor)
const extraerMensajeError = (err, porDefecto) => {
    const data = err?.response?.data;
    if (data?.errors) {
        const primero = Object.values(data.errors)[0];
        if (Array.isArray(primero) && primero.length) return primero[0];
    }
    return data?.message || porDefecto;
};

export default function CustomerContractModal({ contract, onClose, onGuardado }) {
    // Es edición solo si el contrato tiene id real
    const esEdicion = Boolean(contract?.id);

    const [form, setForm] = useState(formVacio);
    const formInicialRef = useRef(null);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    const [clientes, setClientes] = useState([]);

    useEffect(() => {
        // Carga clientes activos para el selector (defensivo si la API no devuelve arreglo)
        getCustomers({ status: true })
            .then((res) => setClientes(Array.isArray(res.data) ? res.data : []))
            .catch(() => setClientes([]));

        // Datos iniciales: los del contrato si es edición; vacíos si es nuevo
        const dataInicial = {
            contract_number: contract?.contract_number || '',
            customer_id: contract?.customer_id || '',
            incoterm: contract?.incoterm || '',
            start_date: contract?.start_date || '',
            end_date: contract?.end_date || '',
            box_price: contract?.box_price ?? '',
            weekly_boxes: contract?.weekly_boxes ?? '',
            comment: contract?.comment || '',
        };
        setForm(dataInicial);
        formInicialRef.current = dataInicial;
    }, [contract]);

    // ¿Hay cambios respecto a lo inicial?
    const hayCambiosSinGuardar = () => {
        if (formInicialRef.current === null) return false;
        return JSON.stringify(form) !== JSON.stringify(formInicialRef.current);
    };

    // Cambio normal (selectores y fechas)
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // Texto en MAYÚSCULAS
    const handleTextUpperChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value.toUpperCase() }));
    };

    // Numérico: type="text" + regex (type="number" descarta caracteres antes del onChange)
    const handleDecimalChange = (e) => {
        const { name, value } = e.target;
        if (/^\d*\.?\d{0,2}$/.test(value)) setForm((prev) => ({ ...prev, [name]: value }));
    };
    const handleEnteroChange = (e) => {
        const { name, value } = e.target;
        if (/^\d*$/.test(value)) setForm((prev) => ({ ...prev, [name]: value }));
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

        // Validaciones rápidas en pantalla (el backend vuelve a validar)
        if (!form.customer_id) return setError('DEBES SELECCIONAR UN CLIENTE');
        if (!form.start_date || !form.end_date) return setError('INGRESA LA FECHA DE INICIO Y DE FIN');
        if (form.end_date < form.start_date) return setError('LA FECHA DE FIN NO PUEDE SER ANTERIOR A LA DE INICIO');
        if (form.box_price === '') return setError('INGRESA EL PRECIO POR CAJA');

        setGuardando(true);
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            // Vacíos → null para que la base los guarde como NULL
            const data = {
                contract_number: form.contract_number.trim() || null,
                customer_id: form.customer_id,
                incoterm: form.incoterm || null,
                start_date: form.start_date,
                end_date: form.end_date,
                box_price: form.box_price,
                weekly_boxes: form.weekly_boxes === '' ? null : form.weekly_boxes,
                comment: form.comment.trim() || null,
            };

            if (esEdicion) {
                await updateCustomerContract(contract.id, data);
            } else {
                await createCustomerContract(data);
            }

            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('ERROR AL GUARDAR EL CONTRATO:', err?.response?.data || err);
            setError(extraerMensajeError(err, getMensajeError('contrato', accion)));
            setGuardando(false);
        }
    };

    const inputClass =
        'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500';
    const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5';

    return (
        <>
            <ModalShell
                title={esEdicion ? 'Editar contrato' : 'Nuevo contrato'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={guardando}
                error={error}
                toast={mostrarExito ? getMensajeExito('contrato', esEdicion ? 'actualizar' : 'crear') : ''}
            >
                <div className="grid grid-cols-2 gap-4">
                    {/* Cliente */}
                    <div className="col-span-2">
                        <label className={labelClass}>Cliente *</label>
                        <SelectBuscable name="customer_id" value={form.customer_id} onChange={handleChange} required className={inputClass}>
                            <option value="">SELECCIONAR...</option>
                            {clientes.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.third_party?.name || c.customer_code}
                                </option>
                            ))}
                        </SelectBuscable>
                    </div>

                    {/* N° contrato */}
                    <div>
                        <label className={labelClass}>N° contrato</label>
                        <input name="contract_number" value={form.contract_number} onChange={handleTextUpperChange}
                            placeholder="Ej: GT-2026-01" className={inputClass} />
                    </div>

                    {/* Incoterm (opcional) */}
                    <div>
                        <label className={labelClass}>Incoterm</label>
                        <SelectBuscable name="incoterm" value={form.incoterm} onChange={handleChange} className={inputClass}>
                            <option value="">TODOS</option>
                            {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
                        </SelectBuscable>
                    </div>

                    {/* Vigencia */}
                    <div>
                        <label className={labelClass}>Fecha inicio *</label>
                        <input type="date" name="start_date" value={form.start_date} onChange={handleChange} required className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Fecha fin *</label>
                        <input type="date" name="end_date" value={form.end_date} onChange={handleChange} required className={inputClass} />
                    </div>

                    {/* Precio y volumen */}
                    <div>
                        <label className={labelClass}>Precio por caja (USD) *</label>
                        <input type="text" inputMode="decimal" name="box_price" value={form.box_price}
                            onChange={handleDecimalChange} placeholder="Ej: 7.50" className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Cajas por semana</label>
                        <input type="text" inputMode="numeric" name="weekly_boxes" value={form.weekly_boxes}
                            onChange={handleEnteroChange} placeholder="Opcional" className={inputClass} />
                    </div>

                    {/* Comentario */}
                    <div className="col-span-2">
                        <label className={labelClass}>Comentario</label>
                        <input name="comment" value={form.comment} onChange={handleTextUpperChange}
                            placeholder="Opcional" className={inputClass} />
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
                            <button type="button" onClick={() => setMostrarConfirmarSalida(false)}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 rounded-lg transition">
                                Seguir editando
                            </button>
                            <button type="button" onClick={onClose}
                                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                                Salir sin guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
