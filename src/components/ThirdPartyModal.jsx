// Modal MAESTRO de terceros: productores, comercializadoras, proveedores y clientes extranjeros.
// Solo ADMIN entra aquí (RutaSoloAdmin + middleware admin en el backend).
// Cambios en esta versión:
//   1. Si el tipo es CLIENTE aparecen País y Contacto; el backend crea la ficha de cliente
//      (CUST-0000X) en el mismo guardado. Ya no se registra el cliente dos veces.
//   2. Muestra el error REAL del backend (ej. "YA EXISTE UN CLIENTE CON EL NOMBRE GT").
//   3. Nombre, identificación, zona, país y contacto en MAYÚSCULAS mientras se escribe.
//   4. (02/11/2026) Se quitó la pantalla Clientes: las MARCAS del cliente se eligen aquí
//      (GT → GLOBAL VILLAGE y DOÑA ELENA; una marca puede ser de varios clientes).
import { useState, useEffect, useRef } from 'react';
import { createThirdParty, updateThirdParty } from '../api/thirdParties';
import { getBrands } from '../api/brands';
import ModalShell from './common/ModalShell';
import DialogoConfirmacion from './common/DialogoConfirmacion';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import SelectBuscable from './common/SelectBuscable';

const FORM_VACIO = {
    name: '',
    type: 'PRODUCTOR',
    identification: '',
    zone: '',
    phone: '',
    email: '',
    address: '', // dirección (columna nueva de third_parties)
    status: true,
    // Solo para CLIENTE (se guardan en la tabla customers)
    country: '',
    contact_name: '',
    brand_ids: [],
};

// Campos que se guardan siempre en mayúsculas (email y teléfono NO)
const CAMPOS_MAYUSCULAS = ['name', 'identification', 'zone', 'country', 'contact_name', 'address'];

// Extrae el mensaje más útil de un error de Axios/Laravel
const extraerMensajeError = (err, mensajePorDefecto) => {
    const data = err?.response?.data;
    if (data?.errors && typeof data.errors === 'object') {
        const primerCampo = Object.values(data.errors)[0];
        if (Array.isArray(primerCampo) && primerCampo.length > 0) return primerCampo[0];
    }
    if (data?.message) return data.message;
    return mensajePorDefecto;
};

const inputClass =
    'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5';

export default function ThirdPartyModal({ thirdParty, onClose, onGuardado }) {
    const esEdicion = Boolean(thirdParty?.id);

    const [form, setForm] = useState(FORM_VACIO);
    const formInicialRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mostrarExito, setMostrarExito] = useState(false);
    const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);
    const [marcas, setMarcas] = useState([]);

    // ¿El tipo elegido es CLIENTE? → muestra País, Contacto y Marcas
    const esCliente = form.type === 'CLIENTE';

    // Marcas activas + las que el cliente ya tenga aunque estén inactivas (para poder quitarlas)
    useEffect(() => {
        const idsCliente = (thirdParty?.customer?.brands || []).map((b) => b.id);
        getBrands()
            .then((res) => {
                const lista = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                setMarcas(lista.filter((b) => b.status || idsCliente.includes(b.id)));
            })
            .catch(() => setMarcas([]));
    }, [thirdParty]);

    useEffect(() => {
        // Se arma el estado campo por campo (no se copia el objeto entero,
        // porque trae relaciones anidadas como customer que no van en el formulario)
        const datosIniciales = thirdParty
            ? {
                name: thirdParty.name || '',
                type: thirdParty.type || 'PRODUCTOR',
                identification: thirdParty.identification || '',
                zone: thirdParty.zone || '',
                phone: thirdParty.phone || '',
                email: thirdParty.email || '',
                address: thirdParty.address || '',
                status: thirdParty.status ?? true,
                country: thirdParty.customer?.country || '',
                contact_name: thirdParty.customer?.contact_name || '',
                brand_ids: (thirdParty.customer?.brands || []).map((b) => b.id).sort((a, b) => a - b),
            }
            : FORM_VACIO;
        setForm(datosIniciales);
        formInicialRef.current = datosIniciales;
    }, [thirdParty]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let nuevoValor = type === 'checkbox' ? checked : value;
        if (CAMPOS_MAYUSCULAS.includes(name)) nuevoValor = nuevoValor.toUpperCase();
        setForm(prev => ({ ...prev, [name]: nuevoValor }));
    };

    // Marca/desmarca una marca (ordenado, para comparar cambios sin guardar)
    const toggleMarca = (id) => setForm((prev) => ({
        ...prev,
        brand_ids: prev.brand_ids.includes(id)
            ? prev.brand_ids.filter((x) => x !== id)
            : [...prev.brand_ids, id].sort((a, b) => a - b),
    }));

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

        // País y contacto solo viajan si es CLIENTE.
        // CLIENTE: no usa zona (es extranjero).
        // Otros tipos: no usan país, contacto ni dirección (por ahora no se muestran).
        const payload = { ...form };
        if (esCliente) {
            delete payload.zone;
        } else {
            delete payload.country;
            delete payload.contact_name;
            delete payload.address;
            delete payload.brand_ids;
        }

        try {
            if (esEdicion) {
                await updateThirdParty(thirdParty.id, payload);
            } else {
                await createThirdParty(payload);
            }
            setMostrarExito(true);
            setTimeout(() => {
                onGuardado();
                onClose();
            }, 1200);
        } catch (err) {
            setError(extraerMensajeError(err, getMensajeError('tercero', accion)));
            console.error('ERROR AL GUARDAR EL TERCERO:', err?.response?.data || err);
            setLoading(false);
        }
    };

    // 28/10/2026: usa ModalShell (paleta oficial: título primario, Cancelar gris, Guardar primario).
    // Cancelar y la X pasan por handleCancelar para avisar si hay cambios sin guardar.
    return (
        <>
            <ModalShell
                title={esEdicion ? 'Editar tercero' : 'Nuevo tercero'}
                onClose={handleCancelar}
                onSubmit={handleSubmit}
                esEdicion={esEdicion}
                guardando={loading}
                error={error}
                toast={mostrarExito ? getMensajeExito('tercero', esEdicion ? 'actualizar' : 'crear') : ''}
            >
                    {/* Fila 1: Nombre + Tipo */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Nombre *</label>
                            <input name="name" value={form.name} onChange={handleChange} required maxLength={255}
                                placeholder="Ej: HACIENDA LA ESPERANZA" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Tipo *</label>
                            <SelectBuscable name="type" value={form.type} onChange={handleChange} required className={inputClass}>
                                <option value="PRODUCTOR">PRODUCTOR</option>
                                <option value="COMERCIALIZADORA">COMERCIALIZADORA</option>
                                <option value="PROVEEDOR">PROVEEDOR</option>
                                <option value="CLIENTE">CLIENTE (EXTRANJERO)</option>
                            </SelectBuscable>
                        </div>
                    </div>

                    {esCliente ? (
                        // CLIENTE EXTRANJERO: Identificación*, País*, Contacto, Email, Teléfono, Dirección.
                        // No usa Zona (es de Ecuador). País y contacto van a customers; el resto a third_parties.
                        <div className="grid grid-cols-2 gap-4 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                            <div>
                                <label className={labelClass}>Identificación *</label>
                                <input name="identification" value={form.identification} onChange={handleChange} maxLength={50}
                                    required placeholder="Ej: RUC / INN / TAX ID" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>País *</label>
                                <input name="country" value={form.country} onChange={handleChange} maxLength={255}
                                    required placeholder="Ej: RUSIA" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Nombre de contacto</label>
                                <input name="contact_name" value={form.contact_name} onChange={handleChange} maxLength={255}
                                    placeholder="Ej: IVAN PETROV" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Email</label>
                                <input name="email" type="email" value={form.email} onChange={handleChange} maxLength={255}
                                    placeholder="Ej: contacto@empresa.ru" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Teléfono</label>
                                <input name="phone" value={form.phone} onChange={handleChange} maxLength={30}
                                    placeholder="Ej: +7 495 123 4567" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Dirección</label>
                                <input name="address" value={form.address} onChange={handleChange} maxLength={255}
                                    placeholder="Ej: MOSCÚ, CALLE TVERSKAYA 10" className={inputClass} />
                            </div>
                            <div className="col-span-2">
                                <label className={labelClass}>Marcas del cliente</label>
                                {marcas.length === 0 ? (
                                    <p className="text-xs text-gray-500">No hay marcas registradas. Créalas en Configuración → Marcas y recetas.</p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {marcas.map((m) => (
                                            <label key={m.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                                <input type="checkbox" checked={form.brand_ids.includes(m.id)} onChange={() => toggleMarca(m.id)}
                                                    className="w-4 h-4 accent-primario" />
                                                {m.name}{!m.status && <span className="text-xs text-gray-400">(inactiva)</span>}
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-gray-500 mt-1">Comercial elige entre estas marcas al comprar la fruta para este cliente.</p>
                            </div>
                            <p className="col-span-2 text-xs text-indigo-700">
                                Al guardar se crea automáticamente su ficha de cliente (código CUST-0000X).
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Fila 2: Identificación + Zona (productor, comercializadora, proveedor) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>RUC / Identificación</label>
                                    <input name="identification" value={form.identification} onChange={handleChange} maxLength={50}
                                        placeholder="Ej: 0912345678001" className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Zona</label>
                                    <input name="zone" value={form.zone} onChange={handleChange} maxLength={100}
                                        placeholder="Ej: MACHALA" className={inputClass} />
                                </div>
                            </div>

                            {/* Fila 3: Teléfono + Email */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Teléfono</label>
                                    <input name="phone" value={form.phone} onChange={handleChange} maxLength={30}
                                        placeholder="Ej: 0991234567" className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Email</label>
                                    <input name="email" type="email" value={form.email} onChange={handleChange} maxLength={255}
                                        placeholder="Ej: contacto@ejemplo.com" className={inputClass} />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Activo */}
                    <div className="flex items-center gap-2">
                        <input type="checkbox" name="status" checked={form.status} onChange={handleChange}
                            id="status" className="w-4 h-4 accent-primario" />
                        <label htmlFor="status" className="text-sm text-gray-700">Tercero activo</label>
                    </div>

            </ModalShell>

            {/* Confirmación al salir con cambios sin guardar */}
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
