// Modal para crear y editar fincas
import { useState, useEffect } from 'react';
import { createFarm, updateFarm } from '../api/farms';
import { getThirdParties } from '../api/thirdParties';
import { X } from 'lucide-react';

export default function FarmModal({ farm, onClose, onGuardado }) {
    const [form, setForm] = useState({
        third_party_id: '',
        name: '',
        magap_code: '',
        zone: '',
    });

    const [productores, setProductores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        cargarProductores();
    }, []);

    useEffect(() => {
        if (farm) {
            setForm({
                third_party_id: farm.third_party_id || '',
                name: farm.name || '',
                magap_code: farm.magap_code || '',
                zone: farm.zone || '',
            });
        }
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (farm) {
                await updateFarm(farm.id, form);
            } else {
                await createFarm(form);
            }
            onGuardado();
            onClose();
        } catch (err) {
            setError('Error al guardar. Verifica los datos.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex justify-between items-center px-7 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-[#0a4f3e]">
                        {farm ? 'Editar finca' : 'Nueva finca'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
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
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
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
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Zona</label>
                            <input
                                name="zone"
                                value={form.zone}
                                onChange={handleChange}
                                maxLength={100}
                                placeholder="Ej: MACHALA"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                            />
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex justify-end gap-4 items-center pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-sm font-semibold text-gray-700 hover:text-gray-900 px-2"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 text-sm font-semibold bg-[#0F6E56] text-white rounded-lg hover:bg-[#0a5a45] disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : farm ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}