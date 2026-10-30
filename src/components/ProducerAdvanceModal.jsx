// Modal para crear y editar anticipos/préstamos al productor (Liquidación)
// Ubicación: src/components/ProducerAdvanceModal.jsx
// Solo se edita un anticipo que aún no se descontó en ninguna liquidación (lo valida el backend).
import { useState, useEffect, useRef } from 'react';
import { createProducerAdvance, updateProducerAdvance } from '../api/settlements';
import { getThirdParties } from '../api/thirdParties';
import { getMensajeExito } from '../utils/toastMessages';
import ModalShell from './common/ModalShell';
import DialogoConfirmacion from './common/DialogoConfirmacion';
import SelectBuscable from './common/SelectBuscable';

const hoy = () => new Date().toISOString().slice(0, 10);

export default function ProducerAdvanceModal({ anticipo, onClose, onGuardado }) {
  const esEdicion = Boolean(anticipo?.id);
  // El modal se monta de nuevo cada vez que se abre: el estado inicial sale directo del anticipo
  const [form, setForm] = useState(() => ({
    third_party_id: anticipo?.third_party_id ? String(anticipo.third_party_id) : '',
    date: anticipo?.date || hoy(),
    type: anticipo?.type || 'ANTICIPO',
    amount: anticipo?.amount ?? '',
    concept: anticipo?.concept || '',
    reference: anticipo?.reference || '',
  }));
  const formInicialRef = useRef(form);
  const [vendedores, setVendedores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

  useEffect(() => {
    getThirdParties({ status: true })
      .then((res) => {
        const lista = Array.isArray(res.data) ? res.data : [];
        setVendedores(lista.filter((t) => ['PRODUCTOR', 'COMERCIALIZADORA'].includes(t.type)));
      })
      .catch((err) => console.error('Error cargando productores:', err));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: ['concept', 'reference'].includes(name) ? value.toUpperCase() : value }));
  };

  const handleCancelar = () => {
    if (JSON.stringify(form) !== JSON.stringify(formInicialRef.current)) {
      setMostrarConfirmarSalida(true);
      return;
    }
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.third_party_id || !form.date || !(Number(form.amount) > 0)) {
      setError('ELIGE EL PRODUCTOR, LA FECHA Y UN MONTO MAYOR A CERO.');
      return;
    }
    setGuardando(true);
    const data = { ...form, third_party_id: Number(form.third_party_id), amount: Number(form.amount) };
    try {
      if (esEdicion) await updateProducerAdvance(anticipo.id, data);
      else await createProducerAdvance(data);
      setToast(getMensajeExito('anticipo', esEdicion ? 'actualizar' : 'crear'));
      onGuardado();
      setTimeout(onClose, 900);
    } catch (err) {
      console.error('Error al guardar anticipo:', err);
      const errs = err.response?.data?.errors;
      setError(errs ? Object.values(errs).flat().join(' ') : (err.response?.data?.message || 'Error al guardar el anticipo'));
    } finally {
      setGuardando(false);
    }
  };

  const inputClass = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
  const labelClass = 'block text-xs font-semibold text-gray-600 uppercase mb-1';

  return (
    <>
      <ModalShell
        title={esEdicion ? 'Editar anticipo / préstamo' : 'Nuevo anticipo / préstamo'}
        onClose={handleCancelar}
        onSubmit={handleSubmit}
        esEdicion={esEdicion}
        guardando={guardando}
        error={error}
        toast={toast}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>Productor / Comercializadora *</label>
            <SelectBuscable name="third_party_id" value={form.third_party_id} onChange={handleChange} className={inputClass}>
              <option value="">SELECCIONAR...</option>
              {vendedores.map((v) => <option key={v.id} value={String(v.id)}>{v.name} ({v.type})</option>)}
            </SelectBuscable>
          </div>
          <div>
            <label className={labelClass}>Tipo *</label>
            <SelectBuscable name="type" value={form.type} onChange={handleChange} className={inputClass}>
              <option value="ANTICIPO">ANTICIPO</option>
              <option value="PRESTAMO">PRÉSTAMO</option>
            </SelectBuscable>
          </div>
          <div>
            <label className={labelClass}>Fecha *</label>
            <input type="date" name="date" value={form.date} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Monto ($) *</label>
            <input type="number" name="amount" min="0.01" step="0.01" value={form.amount} onChange={handleChange} className={`${inputClass} text-right`} />
          </div>
          <div>
            <label className={labelClass}>Comprobante / transferencia</label>
            <input name="reference" maxLength={60} value={form.reference} onChange={handleChange} className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Concepto</label>
            <input name="concept" maxLength={255} value={form.concept} onChange={handleChange} placeholder="EJ. ADELANTO PARA COSECHA" className={inputClass} />
          </div>
        </div>
        <p className="text-xs text-gray-500">Se descuenta en las liquidaciones del productor (todo o en partes) hasta quedar en saldo cero.</p>
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
