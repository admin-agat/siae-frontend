// Modal para crear y editar recetas de materiales (BOM por marca).
// Cada marca tiene su receta completa: no hay recetas compartidas.
// Sigue exactamente el mismo patrón que SupplyModal.jsx (ModalShell + confirmación de salida).
import { useState, useEffect, useRef } from 'react';
import {
    createMaterialRecipe,
    updateMaterialRecipe,
    getAvailableSupplies,
} from '../api/materialRecipes';
import { getBrands } from '../api/brands';

import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';

export default function MaterialRecipeModal({ recipe, marcaFiltro, onClose, onGuardado }) {
    const esEdicion = Boolean(recipe?.id);

    // base_cupo no está en el formulario: el backend siempre guarda MARCA
    const estadoInicial = {
        supply_id: recipe?.supply_id || '',
        brand: recipe?.brand || marcaFiltro || '',
        ratio_per_box: recipe?.ratio_per_box || '',
        unit: recipe?.unit || 'UNIDAD',
    };

    const [form, setForm] = useState(estadoInicial);

    // Marcas activas leídas de la tabla brands
    const [marcas, setMarcas] = useState([]);
    // TODOS los insumos activos; cada uno trae 'bloqueo' (null = se puede elegir)
    const [insumos, setInsumos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    // Copia del estado inicial para detectar cambios sin guardar al cancelar
    const formInicialRef = useRef(estadoInicial);

    // Marcas: se cargan una sola vez al abrir el modal
    useEffect(() => {
        cargarMarcas();
    }, []);

    // Insumos: se recargan al cambiar de marca, porque el 'bloqueo' depende de la marca
    useEffect(() => {
        if (form.brand) cargarInsumos(form.brand);
    }, [form.brand]);

    const cargarMarcas = async () => {
        try {
            const res = await getBrands();
            // Solo marcas activas (protegido por si no llega un arreglo)
            const lista = Array.isArray(res.data) ? res.data : [];
            setMarcas(lista.filter(m => m.status));
        } catch (error) {
            console.error('Error cargando marcas:', error);
        }
    };

    const cargarInsumos = async (brand) => {
        try {
            const res = await getAvailableSupplies(brand);
            let lista = Array.isArray(res.data) ? res.data : [];

            if (esEdicion) {
                // En edición, el insumo de esta receta viene como "YA ESTÁ EN ESTA MARCA"
                // (es la receta que estamos editando): se libera para que se vea seleccionado.
                lista = lista.map(s => (s.id === recipe.supply_id ? { ...s, bloqueo: null } : s));

                // Si el insumo fue desactivado, no viene en la lista: se agrega a mano
                if (recipe?.supply && !lista.some(s => s.id === recipe.supply_id)) {
                    lista = [...lista, { id: recipe.supply.id, name: recipe.supply.name, unit: recipe.supply.unit, bloqueo: null }];
                }
            }

            setInsumos(lista.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error('Error cargando insumos:', error);
        }
    };

    // Separación para el selector: elegibles arriba, ya cargados en esta marca abajo en gris
    const insumosDisponibles = insumos.filter(s => !s.bloqueo);
    const insumosAsignados = insumos.filter(s => s.bloqueo);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'ratio_per_box') {
            // Solo dígitos y un punto decimal (el campo es numeric(12,6) en BD)
            const valorLimpio = value.replace(/[^0-9.]/g, '');
            const partes = valorLimpio.split('.');
            const valorFinal = partes.length > 2
                ? `${partes[0]}.${partes.slice(1).join('')}`
                : valorLimpio;
            setForm(prev => ({ ...prev, ratio_per_box: valorFinal }));
            return;
        }

        if (name === 'supply_id') {
            // La unidad se autocompleta con la del insumo (FRASCOS, LIBRAS, UNIDAD...)
            const insumo = insumos.find(s => String(s.id) === String(value));
            setForm(prev => ({
                ...prev,
                supply_id: value,
                unit: insumo?.unit || prev.unit,
            }));
            return;
        }

        if (name === 'brand') {
            // Al cambiar de marca (solo al crear) se limpia el insumo elegido
            setForm(prev => ({
                ...prev,
                brand: value,
                supply_id: esEdicion ? prev.supply_id : '',
            }));
            return;
        }

        // Unidad en mayúsculas (política de datos del sistema)
        setForm(prev => ({ ...prev, [name]: name === 'unit' ? value.toUpperCase() : value }));
    };

    const hayCambiosSinGuardar = () => {
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
                await updateMaterialRecipe(recipe.id, form);
            } else {
                await createMaterialRecipe(form);
            }
            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            // Mensaje de validación del backend si existe; si no, el estándar
            const mensajeBackend = err.response?.data?.errors?.supply_id?.[0];
            setError(mensajeBackend || getMensajeError('receta', accion));
            console.error(err);
            setLoading(false);
        }
    };

    return (
        <>
            <ModalShell
                title={esEdicion ? 'Editar receta' : 'Nueva receta'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={loading}
                error={error}
                toast={mostrarExito ? getMensajeExito('receta', esEdicion ? 'actualizar' : 'crear') : ''}
            >
                {/* Marca (primero, porque define qué insumos ya están cargados) */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Marca *</label>
                    <select
                        name="brand"
                        value={form.brand}
                        onChange={handleChange}
                        required
                        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Seleccionar marca...</option>
                        {/* El value es el code de brands, que es lo que se guarda en material_recipes.brand */}
                        {marcas.map(m => (
                            <option key={m.id} value={m.code}>{m.name}</option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Se calcula sobre el CUPO PROPIO de esta marca.</p>
                </div>

                {/* Insumo: listado completo, separado en disponibles y ya cargados */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Insumo *</label>
                    <select
                        name="supply_id"
                        value={form.supply_id}
                        onChange={handleChange}
                        required
                        disabled={esEdicion}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 ${esEdicion ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-100'
                            }`}
                    >
                        <option value="">Seleccionar insumo...</option>

                        <optgroup label={`DISPONIBLES (${insumosDisponibles.length})`}>
                            {insumosDisponibles.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </optgroup>

                        {/* Se ven pero no se pueden elegir: ya tienen receta en esta marca */}
                        {insumosAsignados.length > 0 && (
                            <optgroup label={`YA EN ESTA MARCA (${insumosAsignados.length})`}>
                                {insumosAsignados.map(s => (
                                    <option key={s.id} value={s.id} disabled>{s.name}</option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                    {esEdicion && (
                        <p className="text-xs text-gray-400 mt-1">El insumo no se puede cambiar una vez creada la receta.</p>
                    )}
                </div>

                {/* Fila: Ratio por caja + Unidad */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ratio por caja *</label>
                        <input
                            name="ratio_per_box"
                            type="text"
                            inputMode="decimal"
                            value={form.ratio_per_box}
                            onChange={handleChange}
                            required
                            placeholder="Ej: 0.007407"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unidad *</label>
                        <input
                            name="unit"
                            value={form.unit}
                            onChange={handleChange}
                            required
                            maxLength={20}
                            placeholder="Se toma del insumo"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
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