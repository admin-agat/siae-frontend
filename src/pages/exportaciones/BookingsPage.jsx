// Página principal del módulo Bookings
import { useState, useEffect } from 'react';
import { Plus, Pencil, Ban, RotateCcw, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import BookingModal from '../../components/BookingModal';
import { getBookings, deactivateBooking, reactivateBooking } from "../../api/bookings";
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

export default function BookingsPage() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [bookingEdit, setBookingEdit] = useState(null);
    const [filaSeleccionada, setFilaSeleccionada] = useState(null);
    const [confirmacion, setConfirmacion] = useState(null); // { booking, accion }
    const [toast, setToast] = useState(null);

    useEffect(() => {
        cargarBookings();
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2500);
        return () => clearTimeout(timer);
    }, [toast]);

    const cargarBookings = async () => {
        try {
            setLoading(true);
            const res = await getBookings();
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setBookings(data);
        } catch (error) {
            console.error('Error cargando bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const pedirConfirmacion = (booking, accion) => {
        setConfirmacion({ booking, accion });
    };

    const ejecutarConfirmacion = async () => {
        if (!confirmacion) return;
        const { booking, accion } = confirmacion;
        try {
            if (accion === 'desactivar') {
                await deactivateBooking(booking.id);
            } else {
                await reactivateBooking(booking.id);
            }
            cargarBookings();
            setToast({ tipo: 'exito', mensaje: getMensajeExito('booking', accion) });
        } catch (error) {
            console.error(`Error al ${accion} booking:`, error);
            setToast({ tipo: 'error', mensaje: getMensajeError('booking', accion) });
        } finally {
            setConfirmacion(null);
        }
    };

    const handleEditar = (booking) => {
        setBookingEdit(booking);
        setShowModal(true);
    };

    const handleNuevo = () => {
        setBookingEdit(null);
        setShowModal(true);
    };

    const handleGuardado = () => {
        setToast({ tipo: 'exito', mensaje: getMensajeExito('booking', bookingEdit ? 'actualizar' : 'crear') });
        cargarBookings();
    };

    const bookingsFiltrados = bookings.filter(b =>
        (b.booking_number || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (b.shipping_line?.name || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (b.vessel?.name || '').toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <div className="p-6">
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-[70] ${
                    toast.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'
                }`}>
                    {toast.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {toast.mensaje}
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Bookings</h1>
                    <p className="text-gray-500 text-sm">Reservas de espacio con las navieras</p>
                </div>
                <button
                    onClick={handleNuevo}
                    className="flex items-center gap-2 bg-[#3B5BDB] text-white px-4 py-2 rounded-lg hover:bg-[#2f49b0] transition"
                >
                    <Plus size={18} />
                    Nuevo booking
                </button>
            </div>

            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 mb-4 w-full max-w-md">
                <Search size={18} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por # booking, naviera o barco..."
                    className="outline-none w-full text-sm uppercase placeholder:normal-case"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                />
            </div>

            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-[#3B5BDB] text-white">
                        <tr>
                            <th className="text-left px-4 py-3"># Booking</th>
                            <th className="text-left px-4 py-3">Naviera</th>
                            <th className="text-left px-4 py-3">Barco</th>
                            <th className="text-left px-4 py-3"># Viaje</th>
                            <th className="text-left px-4 py-3">Sem. registro</th>
                            <th className="text-left px-4 py-3">Sem. zarpe</th>
                            <th className="text-left px-4 py-3">ETA</th>
                            <th className="text-left px-4 py-3">Estado</th>
                            <th className="text-left px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="9" className="text-center py-8 text-gray-400">
                                    Cargando bookings...
                                </td>
                            </tr>
                        ) : bookingsFiltrados.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="text-center py-8 text-gray-400">
                                    No hay bookings registrados
                                </td>
                            </tr>
                        ) : (
                            bookingsFiltrados.map((b, i) => (
                                <tr
                                    key={b.id}
                                    onClick={() => setFilaSeleccionada(b.id)}
                                    className={`cursor-pointer transition ${
                                        filaSeleccionada === b.id
                                            ? 'bg-blue-50'
                                            : i % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                                    } hover:bg-blue-50/60`}
                                >
                                    <td className="px-4 py-3 font-medium">{b.booking_number}</td>
                                    <td className="px-4 py-3">{b.shipping_line?.name || '—'}</td>
                                    <td className="px-4 py-3">{b.vessel?.name || '—'}</td>
                                    <td className="px-4 py-3">{b.voyage_number || '—'}</td>
                                    <td className="px-4 py-3">{b.week ? `S${b.week}/${b.year}` : '—'}</td>
                                    <td className="px-4 py-3">{b.departure_week ? `S${b.departure_week}/${b.departure_year}` : '—'}</td>
                                    <td className="px-4 py-3">{b.eta || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            b.status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {b.status ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => handleEditar(b)} className="text-blue-500 hover:text-blue-700">
                                            <Pencil size={16} />
                                        </button>
                                        {b.status ? (
                                            <button onClick={() => pedirConfirmacion(b, 'desactivar')} className="text-red-500 hover:text-red-700">
                                                <Ban size={16} />
                                            </button>
                                        ) : (
                                            <button onClick={() => pedirConfirmacion(b, 'reactivar')} className="text-green-600 hover:text-green-700">
                                                <RotateCcw size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <BookingModal
                    isOpen={showModal}
                    booking={bookingEdit}
                    onClose={() => setShowModal(false)}
                    onGuardado={handleGuardado}
                />
            )}

            {confirmacion && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                confirmacion.accion === 'desactivar' ? 'bg-red-100' : 'bg-green-100'
                            }`}>
                                <AlertTriangle
                                    size={20}
                                    className={confirmacion.accion === 'desactivar' ? 'text-red-600' : 'text-green-600'}
                                />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">
                                    {confirmacion.accion === 'desactivar' ? 'Desactivar booking' : 'Reactivar booking'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    ¿Estás seguro de {confirmacion.accion} <strong>{confirmacion.booking.booking_number}</strong>?
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmacion(null)}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={ejecutarConfirmacion}
                                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg ${
                                    confirmacion.accion === 'desactivar'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-green-600 hover:bg-green-700'
                                }`}
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}