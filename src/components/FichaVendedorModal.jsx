// FichaVendedorModal.jsx — 18/11/2026 (fase 2b, aprobada por Peter)
// Liquidaciones completa la ficha de un productor o comercializadora con los datos del tercero:
// cédula/RUC (solo si no la tiene), zona, teléfono, correo y dirección. Permiso "Ficha de vendedores".
// Nombre, tipo y estado no se cambian aquí: eso lo hace el ADMIN en Terceros.
import { useState } from 'react';
import { guardarFichaVendedor } from '../api/liquidacionBase';
import ModalShell from './common/ModalShell';

const label = 'block text-sm font-semibold text-gray-700 mb-1.5';
const input = 'w-full bg-gray-100 border border-gray-200 rounded-2xl px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario disabled:opacity-60';
const mensajeError = (err, texto) => {
    const errores = err.response?.data?.errors;
    return errores ? Object.values(errores).flat().join(' ') : (err.response?.data?.message || texto);
};

export default function FichaVendedorModal({ tercero, onClose, onGuardado }) {
    const tieneCedula = Boolean(tercero.identification);
    const [form, setForm] = useState({
        identification: tercero.identification || '', zone: tercero.zone || '', phone: tercero.phone || '',
        email: tercero.email || '', address: tercero.address || '',
    });
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const ced = form.identification.trim();
        if (!tieneCedula && ced && ced.length !== 10 && ced.length !== 13) return setError('LA CÉDULA TIENE 10 DÍGITOS Y EL RUC 13.');
        setGuardando(true);
        try {
            await guardarFichaVendedor(tercero.id, {
                identification: tieneCedula ? null : (ced || null),
                zone: form.zone.trim() || null, phone: form.phone.trim() || null,
                email: form.email.trim() || null, address: form.address.trim() || null,
            });
            onGuardado();
            onClose();
        } catch (err) {
            setError(mensajeError(err, 'No se pudo guardar la ficha.'));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ModalShell title={`Ficha — ${tercero.name}`} onClose={onClose} onSubmit={handleSubmit} esEdicion guardando={guardando} error={error}>
            <p className="text-sm text-gray-500 -mt-2">{tercero.type}. El nombre y el tipo los cambia el administrador en Terceros.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={label} htmlFor="fv-ced">Cédula / RUC {!tieneCedula && <span className="text-red-600">(FALTA)</span>}</label>
                    <input id="fv-ced" value={form.identification} disabled={tieneCedula} maxLength={13} inputMode="numeric"
                        onChange={(e) => cambiar('identification', e.target.value.replace(/\D/g, ''))} className={input} />
                    {tieneCedula && <p className="text-[11px] text-gray-500 mt-1">Ya registrada: para cambiarla, pídelo al administrador.</p>}
                </div>
                <div>
                    <label className={label} htmlFor="fv-zona">Zona</label>
                    <input id="fv-zona" value={form.zone} onChange={(e) => cambiar('zone', e.target.value.toUpperCase())} maxLength={100} className={input} />
                </div>
                <div>
                    <label className={label} htmlFor="fv-tel">Teléfono</label>
                    <input id="fv-tel" value={form.phone} onChange={(e) => cambiar('phone', e.target.value.toUpperCase())} maxLength={30} inputMode="tel" className={input} />
                </div>
                <div>
                    <label className={label} htmlFor="fv-correo">Correo</label>
                    <input id="fv-correo" type="email" value={form.email} onChange={(e) => cambiar('email', e.target.value)} maxLength={255} className={input} />
                </div>
                <div className="md:col-span-2">
                    <label className={label} htmlFor="fv-dir">Dirección</label>
                    <input id="fv-dir" value={form.address} onChange={(e) => cambiar('address', e.target.value.toUpperCase())} maxLength={255} className={input} />
                </div>
            </div>
        </ModalShell>
    );
}
