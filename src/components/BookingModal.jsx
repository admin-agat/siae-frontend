// Modal para crear/editar un Booking.
// Layout en filas de 3: [Naviera, Barco, Booking] / [Cliente, Destino, Puerto de Salida] / resto.
import { useState, useEffect, useRef } from 'react';
import { createBooking, updateBooking } from '../api/bookings'; // ajustar nombre real si difiere
import { getShippingLines } from '../api/shippingLines';
import { getVessels } from '../api/vessels';
import { getPorts } from '../api/ports';
import { getDestinations } from '../api/destinations';
import { getCustomers } from '../api/customers';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';

const formVacio = {
    booking_number: '',
    shipping_line_id: '',
    vessel_id: '',
    client_id: '',
    destination_id: '',
    port_id: '',
    weekly_quota: '',
    boxes_quantity: '',
    estimated_departure: '',
    eta: '',
    voyage_number: '',
    departure_week: '',
    departure_year: '',
};

export default function BookingModal({ booking, onClose, onGuardado }) {
    const esEdicion = Boolean(booking?.id);

    const [form, setForm] = useState(formVacio);
    const formInicialRef = useRef(null);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    const [navieras, setNavieras] = useState([]);
    const [barcos, setBarcos] = useState([]);
    const [puertos, setPuertos] = useState([]);
    const [destinos, setDestinos] = useState([]);
    const [clientes, setClientes] = useState([]);

    useEffect(() => {
        (async () => {
            const [resNavieras, resPuertos, resDestinos, resClientes] = await Promise.all([
                getShippingLines({ status: true }),
                getPorts({ status: true }),
                getDestinations({ status: true }),
                getCustomers({ status: true }),
            ]);
            setNavieras(resNavieras.data);
            setPuertos(resPuertos.data);
            setDestinos(resDestinos.data);
            setClientes(resClientes.data);
        })();

        const dataInicial = {
            booking_number: booking?.booking_number || '',
            shipping_line_id: booking?.shipping_line_id || '',
            vessel_id: booking?.vessel_id || '',
            client_id: booking?.client_id || '',
            destination_id: booking?.destination_id || '',
            port_id: booking?.port_id || '',
            weekly_quota: booking?.weekly_quota || '',
            boxes_quantity: booking?.boxes_quantity || '',
            estimated_departure: booking?.estimated_departure || '',
            eta: booking?.eta || '',
            voyage_number: booking?.voyage_number || '',
            departure_week: booking?.departure_week || '',
            departure_year: booking?.departure_year || '',
        };
        setForm(dataInicial);
        formInicialRef.current = dataInicial;
    }, [booking]);

    // Carga los barcos de la naviera seleccionada
    useEffect(() => {
        if (!form.shipping_line_id) {
            setBarcos([]);
            return;
        }
        getVessels({ shipping_line_id: form.shipping_line_id, status: true }).then((res) => setBarcos(res.data));
    }, [form.shipping_line_id]);

    const hayCambiosSinGuardar = () => {
        if (formInicialRef.current === null) return false;
        return JSON.stringify(form) !== JSON.stringify(formInicialRef.current);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: value,
            ...(name === 'shipping_line_id' ? { vessel_id: '' } : {}),
        }));
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

        if (!form.booking_number.trim()) {
            setError('EL NÚMERO DE BOOKING ES OBLIGATORIO');
            return;
        }
        if (!form.shipping_line_id) {
            setError('LA NAVIERA ES OBLIGATORIA');
            return;
        }

        setGuardando(true);
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            const data = {
                ...form,
                vessel_id: form.vessel_id || null,
                client_id: form.client_id || null,
                destination_id: form.destination_id || null,
                port_id: form.port_id || null,
                weekly_quota: form.weekly_quota || null,
                boxes_quantity: form.boxes_quantity || null,
                estimated_departure: form.estimated_departure || null,
                eta: form.eta || null,
                departure_week: form.departure_week || null,
                departure_year: form.departure_year || null,
            };

            if (esEdicion) {
                await updateBooking(booking.id, data);
            } else {
                await createBooking(data);
            }

            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('ERROR AL GUARDAR EL BOOKING:', err);
            setError(
                err.response?.data?.message || getMensajeError('booking', accion)
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
                title={esEdicion ? 'Editar booking' : 'Nuevo booking'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={guardando}
                error={error}
                toast={mostrarExito ? getMensajeExito('booking', esEdicion ? 'actualizar' : 'crear') : ''}
            >
                <div className="grid grid-cols-3 gap-4">
                    {/* Fila 1: Naviera, Barco, Booking */}
                    <div>
                        <label className={labelClass}>Naviera *</label>
                        <select name="shipping_line_id" value={form.shipping_line_id} onChange={handleChange} required className={inputClass}>
                            <option value="">Seleccionar...</option>
                            {navieras.map((n) => (
                                <option key={n.id} value={n.id}>{n.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Barco</label>
                        <select
                            name="vessel_id"
                            value={form.vessel_id}
                            onChange={handleChange}
                            disabled={!form.shipping_line_id}
                            className={`${inputClass} disabled:opacity-50`}
                        >
                            <option value="">Seleccionar...</option>
                            {barcos.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}># Booking *</label>
                        <input
                            name="booking_number"
                            value={form.booking_number}
                            onChange={handleTextUpperChange}
                            required
                            className={inputClass}
                        />
                    </div>

                    {/* Fila 2: Cliente, Destino, Puerto de Salida */}
                    <div>
                        <label className={labelClass}>Cliente</label>
                        <select name="client_id" value={form.client_id} onChange={handleChange} className={inputClass}>
                            <option value="">Seleccionar...</option>
                            {clientes.map((c) => (
                                <option key={c.id} value={c.id}>{c.customer_code} — {c.thirdParty?.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Destino</label>
                        <select name="destination_id" value={form.destination_id} onChange={handleChange} className={inputClass}>
                            <option value="">Seleccionar...</option>
                            {destinos.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Puerto de Salida</label>
                        <select name="port_id" value={form.port_id} onChange={handleChange} className={inputClass}>
                            <option value="">Seleccionar...</option>
                            {puertos.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Fila 3: Cupo semana, # de cajas, Salida estimada */}
                    <div>
                        <label className={labelClass}>Cupo Semana (cajas)</label>
                        <input type="number" min="0" name="weekly_quota" value={form.weekly_quota} onChange={handleChange} className={inputClass} />
                    </div>

                    <div>
                        <label className={labelClass}># de Cajas</label>
                        <input type="number" min="0" name="boxes_quantity" value={form.boxes_quantity} onChange={handleChange} className={inputClass} />
                    </div>

                    <div>
                        <label className={labelClass}>Salida Estimada</label>
                        <input type="date" name="estimated_departure" value={form.estimated_departure} onChange={handleChange} className={inputClass} />
                    </div>

                    {/* Fila 4: Llegada estimada (ETA), # Viaje, Semana salida */}
                    <div>
                        <label className={labelClass}>Llegada Estimada (ETA)</label>
                        <input type="date" name="eta" value={form.eta} onChange={handleChange} className={inputClass} />
                    </div>

                    <div>
                        <label className={labelClass}># Viaje</label>
                        <input name="voyage_number" value={form.voyage_number} onChange={handleTextUpperChange} className={inputClass} />
                    </div>

                    <div>
                        <label className={labelClass}>Semana Salida</label>
                        <input type="number" min="1" max="53" name="departure_week" value={form.departure_week} onChange={handleChange} className={inputClass} />
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