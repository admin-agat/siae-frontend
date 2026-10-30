// Modal para crear/editar un Cliente (cliente internacional comprador de banano, ej. GT, RVI).
// Cada Cliente está ligado a un Tercero ya existente (third_party_id).
// Cambios en esta versión:
//   1. Títulos y textos en español: "cliente" en vez de "customer".
//   2. Mensajes de toast usan la clave 'cliente', que es la registrada en toastMessages.js.
//   3. Carga defensiva de terceros (Array.isArray) para evitar el error ".map is not a function".
// 28/10/2026:
//   4. Se QUITÓ "Tipo de negociación": un cliente compra por CONTRATO y por SPOT a la vez.
//      La modalidad (y su precio) va en cada línea de pedido/embarque; el precio de contrato
//      con su vigencia está en Contratos de clientes.
//   5. El selector de tercero solo muestra terceros tipo CLIENTE que aún no tienen ficha
//      (antes salían todos, y elegir uno ya registrado daba "third party id has already been taken").
//   6. Marcas del cliente (varias): GT → GLOBAL VILLAGE y DOÑA ELENA; una marca puede ser de
//      varios clientes. Rusia no las escribe en el correo: Comercial elige entre estas al comprar.
import { useState, useEffect, useRef } from 'react';
import { createCustomer, updateCustomer } from '../api/customers';
import { getThirdParties } from '../api/thirdParties';
import { getBrands } from '../api/brands';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';
import DialogoConfirmacion from './common/DialogoConfirmacion';
import SelectBuscable from './common/SelectBuscable';

const formVacio = {
    third_party_id: '',
    country: '',
    contact_name: '',
    brand_ids: [],
};

export default function CustomerModal({ customer, onClose, onGuardado }) {
    // Es edición solo si el cliente tiene id real (no si llega un objeto parcial)
    const esEdicion = Boolean(customer?.id);

    const [form, setForm] = useState(formVacio);
    const formInicialRef = useRef(null);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

    const [terceros, setTerceros] = useState([]);
    const [marcas, setMarcas] = useState([]);

    useEffect(() => {
        // Marcas activas + las que el cliente ya tenga aunque estén inactivas (para poder quitarlas)
        const idsCliente = (customer?.brands || []).map((b) => b.id);
        getBrands()
            .then((res) => {
                const lista = Array.isArray(res.data) ? res.data : [];
                setMarcas(lista.filter((b) => b.status || idsCliente.includes(b.id)));
            })
            .catch(() => setMarcas([]));

        // Terceros activos tipo CLIENTE. El backend los envía con su ficha "customer" (o null):
        // al crear solo se ofrecen los que aún NO tienen ficha; al editar, el del propio cliente.
        getThirdParties({ status: true, type: 'CLIENTE' })
            .then((res) => {
                const lista = Array.isArray(res.data) ? res.data : [];
                setTerceros(lista.filter((t) => !t.customer || t.id === customer?.third_party_id));
            })
            .catch(() => setTerceros([]));

        // Datos iniciales: los del cliente si es edición, vacíos si es nuevo
        const dataInicial = {
            third_party_id: customer?.third_party_id || '',
            country: customer?.country || '',
            contact_name: customer?.contact_name || '',
            brand_ids: idsCliente.sort((a, b) => a - b),
        };
        setForm(dataInicial);
        formInicialRef.current = dataInicial; // referencia para detectar cambios sin guardar
    }, [customer]);

    // Compara el formulario actual con el inicial para saber si hay cambios
    const hayCambiosSinGuardar = () => {
        if (formInicialRef.current === null) return false;
        return JSON.stringify(form) !== JSON.stringify(formInicialRef.current);
    };

    // Cambio normal (selectores)
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // Cambio en campos de texto: convierte a MAYÚSCULAS mientras se escribe
    const handleTextUpperChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value.toUpperCase() }));
    };

    // Marca/desmarca una marca (se mantiene ordenado para comparar cambios sin guardar)
    const toggleMarca = (id) => {
        setForm((prev) => ({
            ...prev,
            brand_ids: prev.brand_ids.includes(id)
                ? prev.brand_ids.filter((x) => x !== id)
                : [...prev.brand_ids, id].sort((a, b) => a - b),
        }));
    };

    // Cancelar: si hay cambios, pide confirmación antes de cerrar
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

        // Validación mínima en el frontend (el backend vuelve a validar)
        if (!form.third_party_id) {
            setError('DEBES SELECCIONAR UN TERCERO');
            return;
        }

        setGuardando(true);
        const accion = esEdicion ? 'actualizar' : 'crear';
        try {
            const data = {
                third_party_id: form.third_party_id,
                country: form.country.trim(),
                contact_name: form.contact_name.trim(),
                brand_ids: form.brand_ids,
            };

            if (esEdicion) {
                await updateCustomer(customer.id, data);
            } else {
                await createCustomer(data);
            }

            // Muestra el toast de éxito y cierra después de 1.2 s
            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            console.error('ERROR AL GUARDAR EL CLIENTE:', err);
            setError(
                err.response?.data?.message || getMensajeError('cliente', accion)
            );
            setGuardando(false);
        }
    };

    const inputClass =
        'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
    const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5';

    return (
        <>
            <ModalShell
                title={esEdicion ? 'Editar cliente' : 'Nuevo cliente'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={guardando}
                error={error}
                toast={mostrarExito ? getMensajeExito('cliente', esEdicion ? 'actualizar' : 'crear') : ''}
            >
                <div className="space-y-4">
                    {/* Tercero base: no se puede cambiar al editar */}
                    <div>
                        <label className={labelClass}>Tercero *</label>
                        <SelectBuscable
                            name="third_party_id"
                            value={form.third_party_id}
                            onChange={handleChange}
                            required
                            disabled={esEdicion}
                            className={`${inputClass} disabled:opacity-50`}
                        >
                            <option value="">SELECCIONAR...</option>
                            {terceros.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </SelectBuscable>
                        {esEdicion ? (
                            <p className="text-xs text-gray-400 mt-1">El tercero base no se puede cambiar al editar.</p>
                        ) : terceros.length === 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                                Todos los terceros tipo CLIENTE ya tienen ficha. Crea el tercero primero en Terceros.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className={labelClass}>País</label>
                        <input
                            name="country"
                            value={form.country}
                            onChange={handleTextUpperChange}
                            placeholder="Ej: RUSIA"
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Nombre de contacto</label>
                        <input
                            name="contact_name"
                            value={form.contact_name}
                            onChange={handleTextUpperChange}
                            placeholder="Ej: IVAN PETROV"
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Marcas del cliente</label>
                        {marcas.length === 0 ? (
                            <p className="text-xs text-gray-400">No hay marcas registradas. Créalas en Exportaciones → Marcas.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 bg-gray-100 border border-gray-200 rounded-lg p-3">
                                {marcas.map((m) => (
                                    <label key={m.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.brand_ids.includes(m.id)}
                                            onChange={() => toggleMarca(m.id)}
                                            className="accent-primario"
                                        />
                                        {m.name}
                                        {!m.status && <span className="text-xs text-red-500">(inactiva)</span>}
                                    </label>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                            Una marca puede ser de varios clientes. Comercial elige entre estas al comprar la fruta.
                        </p>
                    </div>

                    {/* CONTRATO / SPOT ya no va aquí: se elige en cada pedido/embarque */}
                    <p className="text-xs text-gray-500 bg-primario-claro rounded-lg px-3 py-2">
                        El cliente puede comprar por <strong>CONTRATO</strong> y por <strong>SPOT</strong>.
                        El precio de contrato se registra en <strong>Contratos de clientes</strong>; el precio spot, en cada pedido.
                    </p>
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
