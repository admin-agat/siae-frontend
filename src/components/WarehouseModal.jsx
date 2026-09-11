// Modal para crear y editar bodegas
import { useState, useEffect, useRef } from 'react';
import { createWarehouse, updateWarehouse, getWarehouses } from '../api/warehouses';
// Estándar centralizado de mensajes toast (crear/actualizar/desactivar/reactivar)
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';

import ModalShell from './common/ModalShell';

// Prefijo fijo de código para bodegas (igual patrón que CRT-/PLA-/QUI- en Insumos)
const PREFIJO_CODIGO = 'BOG-';

// Calcula el siguiente código disponible (BOG-0001, BOG-0002, ...) a partir
// de las bodegas ya existentes. Ignora códigos que no siguen el patrón
// numérico (ej. "BOG-PRINCIPAL") porque esos son casos especiales manuales.
function calcularSiguienteCodigo(bodegas) {
    let maxNumero = 0;

    bodegas.forEach((b) => {
        const match = (b.code || '').match(new RegExp(`^${PREFIJO_CODIGO}(\\d+)$`, 'i'));
        if (match) {
            const numero = parseInt(match[1], 10);
            if (numero > maxNumero) maxNumero = numero;
        }
    });

    const siguiente = maxNumero + 1;
    // Se rellena con ceros a la izquierda hasta 4 dígitos: BOG-0001, BOG-0012, etc.
    return `${PREFIJO_CODIGO}${String(siguiente).padStart(4, '0')}`;
}

export default function WarehouseModal({ warehouse, onClose, onGuardado }) {
    const esEdicion = Boolean(warehouse?.id);

    const [form, setForm] = useState({
        name: '',
        code: '',
        responsible_user_id: '',
        zone: '',
    });

    // Guardamos el estado inicial del formulario para poder comparar y saber
    // si el usuario realmente modificó algo antes de mostrarle la confirmación al cancelar
    const formInicialRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [cargandoCodigo, setCargandoCodigo] = useState(false);
    const [mostrarExito, setMostrarExito] = useState(false);
    // Controla el modal propio de "¿seguro que deseas salir?" (reemplaza el confirm() nativo del navegador)
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    useEffect(() => {
        if (esEdicion) {
            // Modo edición: se precarga con los datos reales de la bodega, código incluido
            const datosIniciales = {
                name: warehouse.name || '',
                code: warehouse.code || '',
                responsible_user_id: warehouse.responsible_user_id || '',
                zone: warehouse.zone || '',
            };
            setForm(datosIniciales);
            formInicialRef.current = datosIniciales;
        } else {
            // Modo creación: se calcula el código automático antes de mostrar el formulario
            const cargarCodigoAutomatico = async () => {
                try {
                    setCargandoCodigo(true);
                    const res = await getWarehouses();
                    const siguienteCodigo = calcularSiguienteCodigo(res.data);
                    const datosIniciales = {
                        name: '',
                        code: siguienteCodigo,
                        responsible_user_id: '',
                        zone: '',
                    };
                    setForm(datosIniciales);
                    formInicialRef.current = datosIniciales;
                } catch (err) {
                    console.error('Error calculando el siguiente código de bodega:', err);
                } finally {
                    setCargandoCodigo(false);
                }
            };
            cargarCodigoAutomatico();
        }
    }, [warehouse, esEdicion]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const camposMayuscula = ['name', 'zone'];
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
                await updateWarehouse(warehouse.id, form);
            } else {
                await createWarehouse(form);
            }
            // Se muestra el mensaje de éxito y se espera un momento antes
            // de cerrar el modal, para que el usuario alcance a leerlo
            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            // Mensaje de error estandarizado (antes era un texto fijo genérico)
            setError(getMensajeError('bodega', accion));
            console.error(err);
            setLoading(false);
        }
    };

    return (
        <>
            <ModalShell
    title={esEdicion ? 'Editar bodega' : 'Nueva bodega'}
    onClose={handleCancelar}
    onSubmit={handleSubmit}
    esEdicion={esEdicion}
    guardando={loading}
    deshabilitado={cargandoCodigo}
    error={error}
    toast={mostrarExito ? getMensajeExito('bodega', esEdicion ? 'actualizar' : 'crear') : ''}
>
                {/* Nombre de la bodega */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre de la Bodega *</label>
                    <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        maxLength={255}
                        placeholder="Ej: BODEGA PRINCIPAL"
                        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* Fila: Código + Zona */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Código *</label>
                        <input
                            disabled
                            name="code"
                            value={cargandoCodigo ? 'Calculando...' : form.code}
                            readOnly
                            required
                            maxLength={255}
                            className="w-full bg-gray-200 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 outline-none cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-400 mt-1">Generado automáticamente</p>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Zona *</label>
                        <input
                            name="zone"
                            value={form.zone}
                            onChange={handleChange}
                            required
                            maxLength={255}
                            placeholder="Ej: MACHALA"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                {/* Nota: el selector de responsable (dropdown de users) se agrega
                    cuando tengamos el endpoint de usuarios listo para consumir aquí,
                    siguiendo el mismo patrón que el selector de productor en FarmModal */}
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