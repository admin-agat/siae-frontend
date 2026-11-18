// CuentaBancariaVendedorModal.jsx — 18/11/2026 (fase 2b, aprobada por Peter)
// Liquidaciones registra la cuenta bancaria de un productor o comercializadora (botón "+").
// Solo la CREA: si el vendedor ya tiene cuenta, se ve enmascarada (****1234) y cambiarla es de Contabilidad,
// que la ve completa en CONTABILIDAD → Cuentas bancarias. El número completo nunca vuelve del backend.
import { useEffect, useState } from 'react';
import { getCuentaVendedor, crearCuentaVendedor } from '../api/liquidacionBase';
import { getBancos } from '../api/accounting';
import ModalShell from './common/ModalShell';
import SelectBuscable from './common/SelectBuscable';

const TIPOS_ID = { C: 'CÉDULA', R: 'RUC', P: 'PASAPORTE' };
const label = 'block text-sm font-semibold text-gray-700 mb-1.5';
const input = 'w-full bg-gray-100 border border-gray-200 rounded-2xl px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
const mensajeError = (err, texto) => {
    const errores = err.response?.data?.errors;
    return errores ? Object.values(errores).flat().join(' ') : (err.response?.data?.message || texto);
};

export default function CuentaBancariaVendedorModal({ tercero, onClose, onGuardado }) {
    const ident = (tercero.identification || '').replace(/\D/g, '');
    const [cuenta, setCuenta] = useState(null);
    const [bancos, setBancos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [form, setForm] = useState({
        bank_id: '', account_type: 'AHORROS', account_number: '',
        holder_id_type: ident.length === 13 ? 'R' : 'C', holder_id: ident, holder_name: tercero.name || '', email: tercero.email || '',
    });
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [exito, setExito] = useState('');
    const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

    useEffect(() => {
        Promise.all([getCuentaVendedor(tercero.id), getBancos()])
            .then(([c, b]) => { setCuenta(c); setBancos(Array.isArray(b) ? b : []); })
            .catch((err) => setError(mensajeError(err, 'No se pudo cargar la cuenta del vendedor.')))
            .finally(() => setCargando(false));
    }, [tercero.id]);

    const yaTiene = Boolean(cuenta?.tiene_cuenta);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (yaTiene) return;
        setError('');
        if (!form.bank_id || !form.account_number || !form.holder_id || !form.holder_name.trim()) return setError('COMPLETA BANCO, NÚMERO DE CUENTA, IDENTIFICACIÓN Y TITULAR.');
        if (form.holder_id_type === 'C' && form.holder_id.length !== 10) return setError('LA CÉDULA TIENE 10 DÍGITOS.');
        if (form.holder_id_type === 'R' && form.holder_id.length !== 13) return setError('EL RUC TIENE 13 DÍGITOS.');
        setGuardando(true);
        try {
            const r = await crearCuentaVendedor(tercero.id, { ...form, bank_id: Number(form.bank_id), email: form.email.trim() || null });
            setExito('Cuenta registrada.');
            setTimeout(() => { onGuardado(r); onClose(); }, 900);
        } catch (err) {
            setError(mensajeError(err, 'No se pudo registrar la cuenta.'));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ModalShell title={`Cuenta bancaria — ${tercero.name}`} onClose={onClose} onSubmit={handleSubmit} guardando={guardando}
            deshabilitado={cargando || yaTiene} error={error} toast={exito}>
            {cargando ? (
                <p className="text-sm text-gray-500">Cargando...</p>
            ) : yaTiene ? (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><p className="text-xs font-semibold text-gray-500 uppercase">Banco</p><p className="font-semibold">{cuenta.banco}</p></div>
                        <div><p className="text-xs font-semibold text-gray-500 uppercase">Tipo</p><p className="font-semibold">{cuenta.account_type}</p></div>
                        <div><p className="text-xs font-semibold text-gray-500 uppercase">Número</p><p className="font-semibold font-mono">{cuenta.numero}</p></div>
                        <div><p className="text-xs font-semibold text-gray-500 uppercase">Titular</p><p className="font-semibold">{cuenta.holder_name}</p><p className="text-xs text-gray-500 font-mono">{TIPOS_ID[cuenta.holder_id_type]} {cuenta.holder_id}</p></div>
                    </div>
                    {cuenta.registrada_por && <p className="text-xs text-gray-500">Registrada por {cuenta.registrada_por}{cuenta.registrada_el && ` el ${cuenta.registrada_el.split('-').reverse().join('/')}`}.</p>}
                    <p className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm font-semibold px-3 py-2">PARA CAMBIARLA, PÍDELO A CONTABILIDAD.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p className="md:col-span-2 text-xs text-gray-500">Después de guardarla solo verás los 4 últimos dígitos. Revisa bien el número antes de guardar.</p>
                    <div>
                        <label className={label}>Banco *</label>
                        <SelectBuscable value={form.bank_id} onChange={(e) => cambiar('bank_id', e.target.value)} className={input}>
                            <option value="">SELECCIONAR...</option>
                            {bancos.filter((b) => b.status).map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
                        </SelectBuscable>
                    </div>
                    <div>
                        <label className={label} htmlFor="cv-tipo">Tipo de cuenta *</label>
                        <select id="cv-tipo" value={form.account_type} onChange={(e) => cambiar('account_type', e.target.value)} className={input}>
                            <option value="AHORROS">AHORROS</option>
                            <option value="CORRIENTE">CORRIENTE</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className={label} htmlFor="cv-numero">Número de cuenta *</label>
                        <input id="cv-numero" value={form.account_number} onChange={(e) => cambiar('account_number', e.target.value.replace(/\D/g, ''))} maxLength={30} inputMode="numeric" autoComplete="off" className={input} />
                    </div>
                    <div>
                        <label className={label} htmlFor="cv-tipo-id">Identificación del titular *</label>
                        <select id="cv-tipo-id" value={form.holder_id_type} onChange={(e) => cambiar('holder_id_type', e.target.value)} className={input}>
                            {Object.entries(TIPOS_ID).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={label} htmlFor="cv-ident">Número *</label>
                        <input id="cv-ident" value={form.holder_id} maxLength={form.holder_id_type === 'R' ? 13 : form.holder_id_type === 'C' ? 10 : 20}
                            onChange={(e) => cambiar('holder_id', form.holder_id_type === 'P' ? e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '') : e.target.value.replace(/\D/g, ''))}
                            inputMode={form.holder_id_type === 'P' ? 'text' : 'numeric'} autoComplete="off" className={input} />
                    </div>
                    <div className="md:col-span-2">
                        <label className={label} htmlFor="cv-titular">Titular de la cuenta *</label>
                        <input id="cv-titular" value={form.holder_name} onChange={(e) => cambiar('holder_name', e.target.value.toUpperCase())} maxLength={120} className={input} />
                    </div>
                    <div className="md:col-span-2">
                        <label className={label} htmlFor="cv-correo">Correo para el aviso del pago</label>
                        <input id="cv-correo" type="email" value={form.email} onChange={(e) => cambiar('email', e.target.value)} maxLength={120} className={input} />
                    </div>
                </div>
            )}
        </ModalShell>
    );
}
