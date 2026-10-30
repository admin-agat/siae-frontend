// Modal para crear/editar un Puerto (SALIDA en Ecuador o DESTINO). CONFIGURACIÓN → Puertos.
import { useState, useEffect, useRef } from 'react';
import { createPort, updatePort } from '../api/ports';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';
import DialogoConfirmacion from './common/DialogoConfirmacion';
import SelectBuscable from './common/SelectBuscable';

export default function PortModal({ puerto, onClose, onGuardado }) {
    const esEdicion = Boolean(puerto?.id);

    // port_type: SALIDA (Ecuador, se usa en el pedido semanal) | DESTINO (llegada)
    const [form, setForm] = useState({ name: '', code: '', city: '', country: '', port_type: 'DESTINO' });
    const formInicialRef = useRef(null);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    useEffect(() => {
        const dataInicial = {
            name: puerto?.name || '',
            code: puerto?.code || '',
            city: puerto?.city || '',
            country: puerto?.country || '',
            port_type: puerto?.port_type || 'DESTINO',
        };
        setForm(dataInicial);
        formInicialRef.current = dataInicial;
    }, [puerto]);

    const hayCambiosSinGuardar = () => {
        if (formInicialRef.current === null) return false;
        return JSON.stringify(form) !== JSON.stringify(formInicialRef.current);
    };

    const handleChange = (e) => {
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

        if (!form.name.trim()) {
            setError('EL NOMBRE DEL PUERTO ES OBLIGATORIO');
            return;
        }

        setGuardando(true);
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            const data = {
                name: form.name.trim(),
                code: form.code.trim(),
                city: form.city.trim(),
                country: form.country.trim(),
                port_type: form.port_type,
            };

            if (esEdicion) {
                await updatePort(puerto.id, data);
            } else {
                await createPort(data);
            }

            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('ERROR AL GUARDAR EL PUERTO:', err);
            setError(
                err.response?.data?.message || getMensajeError('puerto', accion)
            );
            setGuardando(false);
        }
    };

    return (
        <>
            <ModalShell
                title={esEdicion ? 'Editar puerto' : 'Nuevo puerto'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={guardando}
                error={error}
                toast={mostrarExito ? getMensajeExito('puerto', esEdicion ? 'actualizar' : 'crear') : ''}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre *</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="Ej: GUAYAQUIL"
                            required
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Código</label>
                        <input
                            name="code"
                            value={form.code}
                            onChange={handleChange}
                            placeholder="Ej: GYE"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ciudad</label>
                        <input
                            name="city"
                            value={form.city}
                            onChange={handleChange}
                            placeholder="Ej: GUAYAQUIL"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">País</label>
                        <input
                            name="country"
                            value={form.country}
                            onChange={handleChange}
                            placeholder="Ej: ECUADOR"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipo *</label>
                        <SelectBuscable
                            name="port_type"
                            value={form.port_type}
                            onChange={handleChange}
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario"
                        >
                            <option value="SALIDA">SALIDA (ECUADOR)</option>
                            <option value="DESTINO">DESTINO</option>
                        </SelectBuscable>
                    </div>
                </div>
            </ModalShell>

            {mostrarConfirmarSalida && (
                <DialogoConfirmacion
                    titulo="¿Seguro que deseas salir?"
                    textoAceptar="Salir sin guardar"
                    textoCancelar="Seguir editando"
                    onCancelar={() => setMostrarConfirmarSalida(false)}
                    onAceptar={onClose}
                >
                    Tienes cambios sin guardar que se perderán.
                </DialogoConfirmacion>
            )}
        </>
    );
}