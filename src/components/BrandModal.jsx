// Modal para crear y editar marcas (GLOBAL VILLAGE, PALMS BANANAS, etc.)
// Mismo patrón que SupplyModal.jsx: ModalShell + confirmación de salida.
import { useState, useEffect, useRef } from 'react';
import { createBrand, updateBrand } from '../api/brands';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';

// CAMBIO: saca el mensaje real que devuelve Laravel.
// - 422 de validación → viene en data.errors ({ campo: ['MENSAJE'] })
// - 422 propio (ej. código bloqueado por cupos) → viene en data.message
// - Cualquier otro error (500, red caída) → mensaje genérico de toastMessages
const extraerMensajeError = (err, accion) => {
    const respuesta = err?.response;
    if (respuesta?.status === 422 && respuesta.data) {
        if (respuesta.data.errors) {
            // Junta todos los mensajes (ej. nombre Y código duplicados a la vez)
            const mensajes = Object.values(respuesta.data.errors).flat();
            if (mensajes.length > 0) return mensajes.join(' ');
        }
        if (respuesta.data.message) return respuesta.data.message;
    }
    return getMensajeError('marca', accion);
};

// CAMBIO: normaliza el código mientras se escribe, igual que el backend:
// mayúsculas, espacios → guion bajo, y fuera todo lo que no sea A-Z, 0-9, Ñ o _.
// Así el usuario ve exactamente lo que se va a guardar.
const normalizarCodigo = (valor) =>
    valor
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9Ñ_]/g, '');

export default function BrandModal({ brand, onClose, onGuardado }) {
    // Boolean(brand?.id): evita tratar como edición un objeto parcial
    const esEdicion = Boolean(brand?.id);

    const [form, setForm] = useState({
        name: '',
        code: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    // Foto del formulario al abrir, para detectar cambios sin guardar
    const formInicialRef = useRef(null);

    useEffect(() => {
        if (brand) {
            setForm({
                name: brand.name || '',
                code: brand.code || '',
            });
        }

        formInicialRef.current = {
            name: brand?.name || '',
            code: brand?.code || '',
        };
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Nombre: solo mayúsculas (puede llevar espacios).
        // Código: mayúsculas + guion bajo + caracteres permitidos.
        const valorFinal = name === 'code' ? normalizarCodigo(value) : value.toUpperCase();
        setForm(prev => ({ ...prev, [name]: valorFinal }));
        // Si había un error visible, se limpia apenas el usuario corrige
        if (error) setError('');
    };

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
        // Se envía sin espacios sobrantes; el backend vuelve a normalizar igual
        const datos = { name: form.name.trim(), code: form.code };
        try {
            if (esEdicion) {
                await updateBrand(brand.id, datos);
            } else {
                await createBrand(datos);
            }
            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            // CAMBIO: antes siempre mostraba el genérico; ahora el real del backend
            setError(extraerMensajeError(err, accion));
            console.error(err);
            setLoading(false);
        }
    };

    return (
        <>
            <ModalShell
                title={esEdicion ? 'Editar marca' : 'Nueva marca'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={loading}
                error={error}
                toast={mostrarExito ? getMensajeExito('marca', esEdicion ? 'actualizar' : 'crear') : ''}
            >
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre de la marca *</label>
                    <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        maxLength={255}
                        placeholder="Ej: PALMS CON BANDA"
                        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Código *
                        <span className="text-gray-400 font-normal ml-1">(los espacios se convierten en _)</span>
                    </label>
                    <input
                        name="code"
                        value={form.code}
                        onChange={handleChange}
                        required
                        maxLength={30}
                        placeholder="Ej: PALMS_CON_BANDA"
                        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {/* CAMBIO: aviso en edición, porque el code enlaza recetas y cupos */}
                    {esEdicion && (
                        <p className="text-xs text-amber-600 mt-1.5">
                            Si la marca ya tiene cupos asignados, el código no se puede cambiar.
                        </p>
                    )}
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