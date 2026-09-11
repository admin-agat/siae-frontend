// Modal para crear y editar insumos individuales (los que se mueven en Ingresos/Egresos)
import { useState, useEffect, useRef } from 'react';
import { createSupply, updateSupply } from '../api/supplies';
import { getSupplies } from '../api/supplies';
import { getSupplyCategories } from '../api/supplyCategories';

// Estándar centralizado de mensajes toast (crear/actualizar/desactivar/reactivar)
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';

import ModalShell from './common/ModalShell';

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
    // Controla el modal propio de "¿seguro que deseas salir?" (mismo patrón que WarehouseModal/SupplyCategoryModal)
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    // Guardamos el estado inicial del formulario para poder comparar y saber
    // si el usuario realmente modificó algo antes de mostrarle la confirmación al cancelar
    const formInicialRef = useRef(null);

    useEffect(() => {
        cargarCategorias();
        cargarInsumosExistentes();
        // Estado inicial capturado apenas se monta el modal (antes de cualquier
        // autogeneración de código), tanto para crear como para editar.
        formInicialRef.current = {
            supply_category_id: supply?.supply_category_id || '',
            code: supply?.code || '',
            name: supply?.name || '',
            description: supply?.description || '',
            unit: supply?.unit || 'UNIDAD',
            cost: supply?.cost || '',
        };
    }, []);

    // Cada vez que cambia la categoría (y estamos creando, no editando),
    // calculamos el siguiente código disponible en el frontend.
    useEffect(() => {
        if (form.supply_category_id && !esEdicion) {
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

        if (name === 'cost') {
            // Solo dígitos y un punto decimal, nada de letras, signos ni notación científica
            const valorLimpio = value.replace(/[^0-9.]/g, '');
            // Evita más de un punto decimal (ej. "12.34.56")
            const partes = valorLimpio.split('.');
            const valorFinal = partes.length > 2
                ? `${partes[0]}.${partes.slice(1).join('')}`
                : valorLimpio;

            setForm(prev => ({ ...prev, cost: valorFinal }));
            return;
        }

        // Descripción es texto libre: no se fuerza a mayúsculas
        const camposMayuscula = ['code', 'name', 'description'];
        setForm(prev => ({
            ...prev,
            [name]: camposMayuscula.includes(name) ? value.toUpperCase() : value,
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
            // En vez del confirm() nativo del navegador, se abre el modal propio
            setMostrarConfirmarSalida(true);
            return;
        }
        onClose();
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
            // cerrar, mismo comportamiento que WarehouseModal
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
        <>
            <ModalShell
                title={esEdicion ? 'Editar insumo' : 'Nuevo insumo'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={loading}
                error={error}
                toast={mostrarExito ? getMensajeExito('insumo', esEdicion ? 'actualizar' : 'crear') : ''}
            >
            {/* Categoría (ya no depende de Grupo) */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Categoría *</label>
                <select
                    name="supply_category_id"
                    value={form.supply_category_id}
                    onChange={handleChange}
                    required
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
            </div>

            {/* Fila: Código + Unidad, en su propio grid (ModalShell no envuelve los children en grid) */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Código *
                        {!esEdicion && (
                            <span className="text-gray-400 font-normal ml-1">(generado automáticamente)</span>
                        )}
                    </label>
                    <input
                        disabled
                        name="code"
                        value={form.code}
                        onChange={handleChange}
                        required
                        readOnly={!esEdicion}
                        maxLength={255}
                        placeholder="Ej: CART-TAPA-001"
                        className={`w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 ${!esEdicion ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-100'
                            }`}
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unidad de medida *</label>
                    <select
                        name="unit"
                        value={form.unit}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
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
                    type="text"
                    inputMode="decimal"
                    value={form.cost}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            </ModalShell>

            {/* Modal propio de confirmación al salir (reemplaza el confirm() nativo del navegador) */}
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