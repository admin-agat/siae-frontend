// Modal para crear y editar fincas
import { useState, useEffect, useRef } from 'react';
import { createFarm, updateFarm } from '../api/farms';
import { getThirdParties } from '../api/thirdParties';
import ModalShell from './common/ModalShell';
import DialogoConfirmacion from './common/DialogoConfirmacion';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import SelectBuscable from './common/SelectBuscable';

export default function FarmModal({ farm, onClose, onGuardado }) {
    const esEdicion = Boolean(farm?.id);

    const [form, setForm] = useState({
        third_party_id: '',
        name: '',
        magap_code: '',
        zone: '',
    });

    // Guarda el estado inicial del formulario para comparar y saber si
    // el usuario modificó algo antes de mostrar la confirmación al cancelar
    const formInicialRef = useRef(null);

    const [productores, setProductores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    // Modal propio de "¿seguro que deseas salir?" (reemplaza el confirm() nativo)
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    useEffect(() => {
        cargarProductores();
    }, []);

    useEffect(() => {
        const datosIniciales = {
            third_party_id: farm?.third_party_id || '',
            name: farm?.name || '',
            magap_code: farm?.magap_code || '',
            zone: farm?.zone || '',
        };
        setForm(datosIniciales);
        formInicialRef.current = datosIniciales;
    }, [farm]);

    const cargarProductores = async () => {
        try {
            const res = await getThirdParties();
            // Solo productores activos; si la finca ya tiene un productor inactivo, se mantiene en la lista
            const soloProductores = res.data.filter(t => t.type === 'PRODUCTOR'
                && (t.status !== false || String(t.id) === String(farm?.third_party_id)));
            setProductores(soloProductores);
        } catch (error) {
            console.error('Error cargando productores:', error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const camposMayuscula = ['name', 'magap_code', 'zone'];
        setForm(prev => ({
            ...prev,
            [name]: camposMayuscula.includes(name) ? value.toUpperCase() : value
        }));
    };

    // Compara el formulario actual contra el estado con el que abrió,
    // para saber si hay cambios sin guardar
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
                await updateFarm(farm.id, form);
            } else {
                await createFarm(form);
            }
            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            setError(getMensajeError('finca', accion));
            console.error(err);
            setLoading(false);
        }
    };

    // 28/10/2026: usa ModalShell (paleta oficial: título primario, Cancelar gris, Guardar primario).
    // Cancelar y la X pasan por handleCancelar para avisar si hay cambios sin guardar.
    return (
        <>
            <ModalShell
                title={esEdicion ? 'Editar finca' : 'Nueva finca'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={loading}
                error={error}
                toast={mostrarExito ? getMensajeExito('finca', esEdicion ? 'actualizar' : 'crear') : ''}
            >
                    {/* Productor */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Productor *</label>
                        <SelectBuscable
                            name="third_party_id"
                            value={form.third_party_id}
                            onChange={handleChange}
                            required
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario"
                        >
                            <option value="">Seleccionar productor...</option>
                            {productores.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </SelectBuscable>
                    </div>

                    {/* Nombre de la finca */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre de la Finca *</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            required
                            maxLength={255}
                            placeholder="Ej: NUEVA ESPERANZA"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario"
                        />
                    </div>

                    {/* Fila: Código MAGAP + Zona */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Código MAGAP</label>
                            <input
                                name="magap_code"
                                value={form.magap_code}
                                onChange={handleChange}
                                maxLength={50}
                                placeholder="Ej: 09815"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Zona *</label>
                            <SelectBuscable
                                name="zone"
                                value={form.zone}
                                onChange={handleChange}
                                required
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario"
                            >
                                <option value="">Seleccionar zona...</option>
                                <option value="GUAYAS">GUAYAS</option>
                                <option value="EL ORO">EL ORO</option>
                                <option value="LOS RÍOS">LOS RÍOS</option>
                            </SelectBuscable>
                        </div>
                    </div>

            </ModalShell>

            {/* Modal propio de confirmación al salir */}
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
