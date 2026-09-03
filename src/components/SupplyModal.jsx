// Modal para crear y editar insumos individuales (los que se mueven en Ingresos/Egresos)
import { useState, useEffect } from 'react';
import { createSupply, updateSupply } from '../api/supplies';
import { getSupplies } from '../api/supplies';
import { getSupplyCategories } from '../api/supplyCategories';
import { X, CheckCircle } from 'lucide-react';
// Estándar centralizado de mensajes toast (crear/actualizar/desactivar/reactivar)
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';

const UNIDADES = ['CAJAS', 'LIBRAS', 'ROLLOS', 'SACOS', 'UNIDAD'];

export default function SupplyModal({ supply, onClose, onGuardado }) {
    const esEdicion = Boolean(supply?.id);

    const [form, setForm] = useState({
        supply_category_id: '',
        code: '',
        name: '',
        description: '',
        unit: 'UNIDAD',
        cost: '',
    });

    const [categorias, setCategorias] = useState([]);
    // Todos los insumos existentes, cargados una sola vez, para calcular el
    // siguiente código disponible sin depender de un endpoint de backend.
    const [insumosExistentes, setInsumosExistentes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Toast de éxito — mismo patrón visual y mismo helper que WarehouseModal
    const [mostrarExito, setMostrarExito] = useState(false);

    useEffect(() => {
        cargarCategorias();
        cargarInsumosExistentes();
    }, []);

    // Cada vez que cambia la categoría (y estamos creando, no editando),
    // calculamos el siguiente código disponible en el frontend.
    useEffect(() => {
        if (form.supply_category_id && !supply) {
            calcularSiguienteCodigo(form.supply_category_id);
        }
    }, [form.supply_category_id, categorias, insumosExistentes]);

    // Calcula CODE_PREFIX-NNN en base al code_prefix de la categoría y el
    // número más alto ya usado entre los insumos de esa misma categoría.
    const calcularSiguienteCodigo = (categoryId) => {
        const categoria = categorias.find(c => String(c.id) === String(categoryId));
        if (!categoria || !categoria.code_prefix) {
            // La categoría todavía no tiene prefijo asignado: no autocompletamos,
            // el usuario escribe el código a mano.
            return;
        }

        const prefijo = categoria.code_prefix;
        const insumosDeCategoria = insumosExistentes.filter(
            i => String(i.supply_category_id) === String(categoryId)
        );

        // Extrae el número de cada código con ese prefijo (ej. "CRT-024" -> 24)
        // y se queda con el más alto para saber cuál sigue.
        const maxNum = insumosDeCategoria.reduce((max, i) => {
            const match = i.code?.match(new RegExp(`^${prefijo}-(\\d+)$`));
            const num = match ? parseInt(match[1], 10) : 0;
            return num > max ? num : max;
        }, 0);

        const siguienteCodigo = `${prefijo}-${String(maxNum + 1).padStart(3, '0')}`;
        setForm(prev => ({ ...prev, code: siguienteCodigo }));
    };

    useEffect(() => {
        if (supply) {
            setForm({
                supply_category_id: supply.supply_category_id || '',
                code: supply.code || '',
                name: supply.name || '',
                description: supply.description || '',
                unit: supply.unit || 'UNIDAD',
                cost: supply.cost || '',
            });
        }
    }, [supply]);

    const cargarCategorias = async () => {
        try {
            const res = await getSupplyCategories();
            setCategorias(res.data);
        } catch (error) {
            console.error('Error cargando categorías de insumo:', error);
        }
    };

    const cargarInsumosExistentes = async () => {
        try {
            const res = await getSupplies();
            setInsumosExistentes(res.data);
        } catch (error) {
            console.error('Error cargando insumos existentes:', error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Descripción es texto libre: no se fuerza a mayúsculas
        const camposMayuscula = ['code', 'name','description'];
        setForm(prev => ({
            ...prev,
            [name]: camposMayuscula.includes(name) ? value.toUpperCase() : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        // 'crear' o 'actualizar', usado tanto para el toast de éxito como el de error
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            if (esEdicion) {
                await updateSupply(supply.id, form);
            } else {
                await createSupply(form);
            }
            // Se muestra el toast de éxito y se espera un momento antes de
            // cerrar, mismo comportamiento que WarehouseModal (antes este
            // modal cerraba de inmediato sin ninguna confirmación visual)
            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            // Mensaje de error estandarizado (antes era un texto fijo genérico)
            setError(getMensajeError('insumo', accion));
            console.error(err);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">

                {/* Toast de éxito — texto generado por el helper estandarizado,
                    distingue automáticamente "creado" vs "actualizado" */}
                {mostrarExito && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-10">
                        <CheckCircle size={18} />
                        {getMensajeExito('insumo', esEdicion ? 'actualizar' : 'crear')}
                    </div>
                )}

                {/* Header */}
                <div className="flex justify-between items-center px-7 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-[#0a4f3e]">
                        {supply ? 'Editar insumo' : 'Nuevo insumo'}
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

                    {/* Categoría (ya no depende de Grupo) */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Categoría *</label>
                        <select
                            name="supply_category_id"
                            value={form.supply_category_id}
                            onChange={handleChange}
                            required
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                        >
                            <option value="">Seleccionar categoría...</option>
                            {categorias.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Nombre del insumo */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre del insumo *</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            required
                            maxLength={255}
                            placeholder="Ej: TAPA CARTÓN ESTÁNDAR"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                        />
                    </div>

                    {/* Descripción */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Descripción</label>
                        <textarea
                            name="description"
                            value={form.description}
                            onChange={handleChange}
                            rows={2}
                            placeholder="Detalle adicional del insumo (opcional)"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB] resize-none"
                        />
                    </div>

                    {/* Fila: Código + Unidad */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Código *
                                {!supply && (
                                    <span className="text-gray-400 font-normal ml-1">(autogenerado, editable)</span>
                                )}
                            </label>
                            <input
                                name="code"
                                value={form.code}
                                onChange={handleChange}
                                required
                                maxLength={255}
                                placeholder="Ej: CART-TAPA-001"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unidad de medida *</label>
                            <select
                                name="unit"
                                value={form.unit}
                                onChange={handleChange}
                                required
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            >
                                {UNIDADES.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Costo */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Costo unitario de referencia</label>
                        <input
                            name="cost"
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.cost}
                            onChange={handleChange}
                            placeholder="0.00"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                        />
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
                            className="px-5 py-2.5 text-sm font-semibold bg-[#3B5BDB] text-white rounded-lg hover:bg-[#2F49B8] disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : supply ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}