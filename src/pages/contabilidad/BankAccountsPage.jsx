// BankAccountsPage.jsx — 05/11/2026: cuentas bancarias de los proveedores (para pagarles por el banco).
// Solo Contabilidad y el ADMIN las ven (no salen en Terceros) y cada cambio queda en la bitácora.
// Pestaña BANCOS: el código de cada banco en el archivo de Banco Pichincha (lo da el banco en su tabla).
import { useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { getCuentasProveedores, guardarCuenta, getBancos, crearBanco, actualizarBanco } from '../../api/accounting';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import ModalShell from '../../components/common/ModalShell';
import ToastFlotante from '../../components/common/ToastFlotante';
import SelectBuscable from '../../components/common/SelectBuscable';

const TIPOS_ID = { C: 'CÉDULA', R: 'RUC', P: 'PASAPORTE' };
const label = 'block text-sm font-semibold text-gray-700 mb-1.5';
const input = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
const mensajeError = (err, texto) => {
    const errores = err.response?.data?.errors;
    return errores ? Object.values(errores).flat().join(' ') : (err.response?.data?.message || texto);
};

function CuentaModal({ tercero, bancos, onClose, onGuardado }) {
    const c = tercero.bank_account;
    const ident = (tercero.identification || '').replace(/\D/g, '');
    const [form, setForm] = useState({
        bank_id: c ? String(c.bank_id) : '', account_type: c?.account_type || 'AHORROS', account_number: c?.account_number || '',
        holder_id_type: c?.holder_id_type || (ident.length === 13 ? 'R' : 'C'), holder_id: c?.holder_id || ident,
        holder_name: c?.holder_name || tercero.name, email: c?.email || '',
    });
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [exito, setExito] = useState('');
    const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.bank_id || !form.account_number || !form.holder_id || !form.holder_name.trim()) return setError('Completa banco, número de cuenta, identificación y titular.');
        if (form.holder_id_type === 'C' && form.holder_id.length !== 10) return setError('La cédula tiene 10 dígitos.');
        if (form.holder_id_type === 'R' && form.holder_id.length !== 13) return setError('El RUC tiene 13 dígitos.');
        setGuardando(true);
        try {
            await guardarCuenta(tercero.id, { ...form, bank_id: Number(form.bank_id), email: form.email.trim() || null });
            setExito('Cuenta guardada.');
            setTimeout(() => { onGuardado(); onClose(); }, 900);
        } catch (err) {
            setError(mensajeError(err, 'No se pudo guardar la cuenta.'));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ModalShell title={`Cuenta bancaria — ${tercero.name}`} onClose={onClose} onSubmit={handleSubmit} esEdicion={Boolean(c)} guardando={guardando} error={error} toast={exito}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={label}>Banco *</label>
                    <SelectBuscable value={form.bank_id} onChange={(e) => cambiar('bank_id', e.target.value)} className={input}>
                        <option value="">SELECCIONAR...</option>
                        {bancos.filter((b) => b.status || String(b.id) === form.bank_id).map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
                    </SelectBuscable>
                </div>
                <div>
                    <label className={label}>Tipo de cuenta *</label>
                    <select value={form.account_type} onChange={(e) => cambiar('account_type', e.target.value)} className={input}>
                        <option value="AHORROS">AHORROS</option>
                        <option value="CORRIENTE">CORRIENTE</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className={label} htmlFor="cuenta-numero">Número de cuenta *</label>
                    <input id="cuenta-numero" value={form.account_number} onChange={(e) => cambiar('account_number', e.target.value.replace(/\D/g, ''))} maxLength={30} inputMode="numeric" className={input} />
                </div>
                <div>
                    <label className={label}>Identificación del titular *</label>
                    <select value={form.holder_id_type} onChange={(e) => cambiar('holder_id_type', e.target.value)} className={input}>
                        {Object.entries(TIPOS_ID).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                <div>
                    <label className={label} htmlFor="cuenta-ident">Número *</label>
                    <input id="cuenta-ident" value={form.holder_id} maxLength={form.holder_id_type === 'R' ? 13 : form.holder_id_type === 'C' ? 10 : 20}
                        onChange={(e) => cambiar('holder_id', form.holder_id_type === 'P' ? e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '') : e.target.value.replace(/\D/g, ''))}
                        inputMode={form.holder_id_type === 'P' ? 'text' : 'numeric'} className={input} />
                </div>
                <div className="md:col-span-2">
                    <label className={label} htmlFor="cuenta-titular">Titular de la cuenta *</label>
                    <input id="cuenta-titular" value={form.holder_name} onChange={(e) => cambiar('holder_name', e.target.value.toUpperCase())} maxLength={120} className={input} />
                </div>
                <div className="md:col-span-2">
                    <label className={label} htmlFor="cuenta-correo">Correo para el aviso del pago</label>
                    <input id="cuenta-correo" type="email" value={form.email} onChange={(e) => cambiar('email', e.target.value)} maxLength={120} className={input} />
                </div>
            </div>
        </ModalShell>
    );
}

function BancoModal({ banco, onClose, onGuardado }) {
    const [form, setForm] = useState({ name: banco?.name || '', code: banco?.code || '', status: banco ? banco.status : true });
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return setError('Escribe el nombre del banco.');
        setGuardando(true);
        try {
            const data = { name: form.name.trim(), code: form.code || null, status: form.status };
            if (banco) await actualizarBanco(banco.id, data);
            else await crearBanco(data);
            onGuardado();
            onClose();
        } catch (err) {
            setError(mensajeError(err, 'No se pudo guardar el banco.'));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ModalShell title={banco ? 'Editar banco' : 'Nuevo banco'} onClose={onClose} onSubmit={handleSubmit} esEdicion={Boolean(banco)} guardando={guardando} error={error} size="sm">
            <div>
                <label className={label} htmlFor="banco-nombre">Nombre *</label>
                <input id="banco-nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))} maxLength={80} className={input} />
            </div>
            <div>
                <label className={label} htmlFor="banco-codigo">Código en el archivo de Banco Pichincha</label>
                <input id="banco-codigo" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, '') }))} maxLength={10} inputMode="numeric" className={input} />
                <p className="text-xs text-gray-400 mt-1">Sale de la tabla de bancos que entrega Banco Pichincha para la carga masiva.</p>
            </div>
            {banco && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked }))} /> Activo
                </label>
            )}
        </ModalShell>
    );
}

export default function BankAccountsPage() {
    const [terceros, setTerceros] = useState([]);
    const [bancos, setBancos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [pestana, setPestana] = useState('CUENTAS');
    const [filtro, setFiltro] = useState('TODOS');
    const [modalCuenta, setModalCuenta] = useState(null);
    const [modalBanco, setModalBanco] = useState(null); // null | { banco }
    const [toast, setToast] = useState(null);

    const pedir = () =>
        Promise.all([getCuentasProveedores(), getBancos()])
            .then(([t, b]) => {
                setTerceros(Array.isArray(t) ? t : []);
                setBancos(Array.isArray(b) ? b : []);
            })
            .catch(() => setToast({ tipo: 'error', mensaje: 'No se pudo cargar la información.' }))
            .finally(() => setCargando(false));

    useEffect(() => {
        pedir();
    }, []);

    const conCuenta = terceros.filter((t) => t.bank_account);
    const sinCodigo = bancos.filter((b) => b.status && !b.code);
    const visibles = terceros.filter((t) => filtro === 'TODOS' || (filtro === 'CON' ? t.bank_account : !t.bank_account));
    const pestanaBoton = (activa) => `px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${activa ? 'bg-primario text-white' : 'text-gray-600 hover:bg-gray-100'}`;

    return (
        <div className="p-6 space-y-6">
            <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />
            <EncabezadoPagina
                titulo="Cuentas bancarias"
                subtitulo="Cuentas de los proveedores para pagarles por el banco (solo Contabilidad las ve)"
                textoBoton={pestana === 'BANCOS' ? 'Nuevo banco' : undefined}
                onNuevo={pestana === 'BANCOS' ? () => setModalBanco({ banco: null }) : undefined}
            />

            <div className="flex flex-wrap justify-between gap-3">
                <div className="flex gap-1 bg-white border rounded-lg p-1">
                    <button type="button" onClick={() => setPestana('CUENTAS')} className={pestanaBoton(pestana === 'CUENTAS')}>CUENTAS DE PROVEEDORES ({conCuenta.length}/{terceros.length})</button>
                    <button type="button" onClick={() => setPestana('BANCOS')} className={pestanaBoton(pestana === 'BANCOS')}>BANCOS{sinCodigo.length > 0 && ` (${sinCodigo.length} sin código)`}</button>
                </div>
                {pestana === 'CUENTAS' && (
                    <div className="flex gap-1 bg-white border rounded-lg p-1">
                        {[['TODOS', 'TODOS'], ['CON', 'CON CUENTA'], ['SIN', 'SIN CUENTA']].map(([k, v]) => (
                            <button key={k} type="button" onClick={() => setFiltro(k)} className={pestanaBoton(filtro === k)}>{v}</button>
                        ))}
                    </div>
                )}
            </div>

            {pestana === 'CUENTAS' && (
                <TablaEstandar key="cuentas" datos={visibles} cargando={cargando} nombreRegistros="proveedores" mostrarPestanas={false} porPagina={15}
                    placeholderBusqueda="Buscar por proveedor, RUC, banco o titular..."
                    textosBusqueda={(t) => [t.name, t.identification, t.bank_account?.bank?.name, t.bank_account?.holder_name, t.bank_account?.account_number]}
                    columnas={[
                        { titulo: 'Proveedor', render: (t) => t.name, className: 'font-medium' },
                        { titulo: 'RUC / Cédula', render: (t) => t.identification || '—' },
                        { titulo: 'Banco', render: (t) => t.bank_account?.bank?.name || <span className="text-red-600 text-xs font-semibold">SIN CUENTA</span> },
                        { titulo: 'Cuenta', render: (t) => (t.bank_account ? <span className="whitespace-nowrap">{t.bank_account.account_type === 'CORRIENTE' ? 'CTE' : 'AHO'} {t.bank_account.account_number}</span> : '—') },
                        { titulo: 'Titular', render: (t) => (t.bank_account ? <div><p>{t.bank_account.holder_name}</p><p className="text-xs text-gray-500">{TIPOS_ID[t.bank_account.holder_id_type]} {t.bank_account.holder_id}</p></div> : '—') },
                        {
                            titulo: 'Acciones',
                            render: (t) => (
                                <button type="button" onClick={() => setModalCuenta(t)} title={t.bank_account ? 'Editar cuenta' : 'Agregar cuenta'} aria-label={t.bank_account ? 'Editar cuenta' : 'Agregar cuenta'}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-primario">
                                    {t.bank_account ? <Pencil size={16} /> : <Plus size={16} />}
                                </button>
                            ),
                        },
                    ]}
                />
            )}

            {pestana === 'BANCOS' && (
                <>
                    {sinCodigo.length > 0 && (
                        <p className="bg-amber-50 text-amber-800 text-sm rounded-lg px-4 py-3">
                            Para pagar por el banco, cada banco necesita su <strong>código</strong> de la tabla que entrega Banco Pichincha para la carga masiva.
                        </p>
                    )}
                    <TablaEstandar key="bancos" datos={bancos} cargando={cargando} nombreRegistros="bancos" porPagina={25}
                        placeholderBusqueda="Buscar banco..." textosBusqueda={(b) => [b.name, b.code]}
                        columnas={[
                            { titulo: 'Banco', render: (b) => b.name, className: 'font-medium' },
                            { titulo: 'Código Pichincha', render: (b) => b.code || <span className="text-red-600 text-xs font-semibold">FALTA</span> },
                            {
                                titulo: 'Acciones',
                                render: (b) => (
                                    <button type="button" onClick={() => setModalBanco({ banco: b })} title="Editar" aria-label="Editar" className="p-1.5 rounded-lg hover:bg-gray-100 text-primario">
                                        <Pencil size={16} />
                                    </button>
                                ),
                            },
                        ]}
                    />
                </>
            )}

            {modalCuenta && <CuentaModal tercero={modalCuenta} bancos={bancos} onClose={() => setModalCuenta(null)} onGuardado={() => { pedir(); setToast({ tipo: 'exito', mensaje: 'Cuenta guardada.' }); }} />}
            {modalBanco && <BancoModal banco={modalBanco.banco} onClose={() => setModalBanco(null)} onGuardado={() => { pedir(); setToast({ tipo: 'exito', mensaje: 'Banco guardado.' }); }} />}
        </div>
    );
}
