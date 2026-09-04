// Modal para crear y editar fincas
import { useState, useEffect, useRef } from 'react';
import { createFarm, updateFarm } from '../api/farms';
import { getThirdParties } from '../api/thirdParties';
import { X, CheckCircle } from 'lucide-react';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';

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
            const soloProductores = res.data.filter(t => t.type === 'PRODUCTOR');
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

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">

                {/* Toast de éxito */}
                {mostrarExito && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-10">
                        <CheckCircle size={18} />
                        {getMensajeExito('finca', esEdicion ? 'actualizar' : 'crear')}
                    </div>
                )}

                {/* Header */}
                <div className="flex justify-between items-center px-7 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-[#0a4f3e]">
                        {esEdicion ? 'Editar finca' : 'Nueva finca'}
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

                    {/* Productor */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Productor *</label>
                        <select
                            name="third_party_id"
                            value={form.third_party_id}
                            onChange={handleChange}
                            required
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                        >
                            <option value="">Seleccionar productor...</option>
                            {productores.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
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
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
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
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Zona *</label>
                            <select
                                name="zone"
                                value={form.zone}
                                onChange={handleChange}
                                required
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            >
                                <option value="">Seleccionar zona...</option>
                                <option value="GUAYAS">GUAYAS</option>
                                <option value="EL ORO">EL ORO</option>
                                <option value="LOS RÍOS">LOS RÍOS</option>
                            </select>
                        </div>
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