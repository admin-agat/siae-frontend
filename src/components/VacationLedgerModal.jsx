// Kárdex de VACACIONES de un empleado — LEGAL → Empleados y saldos. Vacaciones fase 1 (16/11/2026).
// Muestra saldo, años de servicio, próximo aniversario, proporcional y el aviso de días acumulados
// (más de 3 años sin gozar). Los movimientos no se editan ni se borran: se corrige con un AJUSTE
// (suma o resta, con motivo). El SALDO INICIAL se carga una sola vez, a una fecha de corte.
import { useCallback, useEffect, useState } from 'react';
import { X, AlertTriangle, Plus } from 'lucide-react';
import { getEmployeeLedger, addEmployeeMovement } from '../api/employees';
import CampoNumero from './common/CampoNumero';
import { hoyISO } from '../utils/fecha';

const fDias = (n) => Number(n || 0).toLocaleString('es-EC', { maximumFractionDigits: 3 });
const fFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');
const ETIQUETA = { SALDO_INICIAL: 'SALDO INICIAL', GANADO: 'GANADO', TOMADO: 'TOMADO', REVERSO: 'REVERSO', AJUSTE: 'AJUSTE', PAGADO: 'PAGADO' };

function Tarjeta({ titulo, valor, detalle }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs font-semibold text-gray-500 uppercase">{titulo}</p>
      <p className="text-xl font-bold text-gray-800">{valor}</p>
      {detalle && <p className="text-xs text-gray-500">{detalle}</p>}
    </div>
  );
}

export default function VacationLedgerModal({ empleado, onClose, onCambio }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // { type, signo, days, movement_date, reason }
  const [guardando, setGuardando] = useState(false);
  // 18/11/2026 (Peter): fila elegida en verde, como en las demás listas
  const [filaSeleccionada, setFilaSeleccionada] = useState(null);

  const cargar = useCallback(() => getEmployeeLedger(empleado.id)
    .then((r) => setDatos(r.data))
    .catch(() => setError('NO SE PUDO CARGAR EL KÁRDEX.')), [empleado.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const tieneInicial = datos?.movements.some((m) => m.type === 'SALDO_INICIAL');

  const guardar = async () => {
    setError('');
    // El saldo inicial puede ser 0; el ajuste no
    if (form.days === '' || (form.type === 'AJUSTE' && !Number(form.days))) { setError('ESCRIBE LOS DÍAS.'); return; }
    if (form.reason.trim().length < 5) { setError('ESCRIBE EL MOTIVO (AL MENOS 5 LETRAS).'); return; }
    setGuardando(true);
    try {
      const r = await addEmployeeMovement(empleado.id, {
        type: form.type,
        days: (form.signo === '-' ? -1 : 1) * Number(form.days),
        movement_date: form.type === 'SALDO_INICIAL' ? form.movement_date : null,
        reason: form.reason.trim(),
      });
      setDatos(r.data);
      setForm(null);
      onCambio?.();
    } catch (err) {
      const errores = err.response?.data?.errors;
      setError(errores ? Object.values(errores).flat()[0] : 'NO SE PUDO GUARDAR EL MOVIMIENTO.');
    } finally {
      setGuardando(false);
    }
  };

  const input = 'w-full bg-gray-100 rounded-2xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primario';
  const r = datos?.resumen;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-7 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-primario">Kárdex de vacaciones</h2>
            <p className="text-sm text-gray-500">{empleado.full_name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        <div className="px-7 py-6 space-y-5">
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</div>}
          {!datos && !error && <p className="text-sm text-gray-400">Cargando…</p>}

          {r && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Tarjeta titulo="Saldo" valor={`${fDias(r.saldo)} días`} />
                <Tarjeta titulo="Años de servicio" valor={r.anios_servicio} />
                <Tarjeta titulo="Próximo aniversario" valor={fFecha(r.proximo_aniversario)} detalle={r.dias_proximo ? `+${r.dias_proximo} días` : ''} />
                <Tarjeta titulo="Proporcional en curso" valor={`${fDias(r.proporcional)} días`} detalle="Informativo (finiquito)" />
              </div>
              {r.acumulado_viejo > 0 && (
                <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  Tiene {fDias(r.acumulado_viejo)} días ganados hace más de 3 años sin gozar (Art. 74): conviene programarle vacaciones.
                </p>
              )}

              <div className="overflow-auto max-h-80 border border-gray-200 rounded-xl">
                {/* 18/11/2026 (Peter): estilo de las listas compactas (columna #, línea fina, filas alternadas) */}
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-primario text-white text-xs uppercase">
                    <tr>
                      <th className="px-2 py-2 text-center text-xs w-10">#</th>
                      <th className="text-left px-3 py-2">Fecha</th>
                      <th className="text-left px-3 py-2">Tipo</th>
                      <th className="text-left px-3 py-2">Detalle</th>
                      <th className="text-right px-3 py-2">Días</th>
                      <th className="text-right px-3 py-2">Saldo</th>
                      <th className="text-left px-3 py-2">Registró</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.movements.length === 0 ? (
                      <tr><td colSpan={7} className="text-center text-gray-400 py-6">Sin movimientos todavía (los días se acreditan al cumplir cada año).</td></tr>
                    ) : datos.movements.map((m, i) => (
                      <tr key={m.id} onClick={() => setFilaSeleccionada(m.id)} className={`cursor-pointer ${filaSeleccionada === m.id ? 'fila-elegida bg-green-600 text-white' : (i % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-violet-50 hover:bg-yellow-50')}`}>
                        <td className="bg-gray-200 border border-gray-300 px-1 py-1.5 text-center text-sm font-bold text-gray-700">{i + 1}</td>
                        <td className="px-3 py-1.5 border border-gray-200 whitespace-nowrap">{fFecha(m.movement_date)}</td>
                        <td className="px-3 py-1.5 border border-gray-200 font-semibold">{ETIQUETA[m.type] || m.type}</td>
                        <td className="px-3 py-1.5 border border-gray-200">{m.reason || '—'}</td>
                        <td className={`px-3 py-1.5 border border-gray-200 text-right font-semibold ${m.days < 0 ? 'text-red-700' : 'text-green-700'}`}>{m.days > 0 ? '+' : ''}{fDias(m.days)}</td>
                        <td className="px-3 py-1.5 border border-gray-200 text-right">{fDias(m.saldo)}</td>
                        <td className="px-3 py-1.5 border border-gray-200 text-xs text-gray-500">{m.created_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!form ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm({ type: 'AJUSTE', signo: '+', days: '', movement_date: '', reason: '' })}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover">
                    <Plus size={16} /> Ajuste
                  </button>
                  {!tieneInicial && (
                    <button type="button" onClick={() => setForm({ type: 'SALDO_INICIAL', signo: '+', days: '', movement_date: hoyISO(), reason: 'SALDO MIGRADO' })}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-primario text-primario hover:bg-primario-claro">
                      <Plus size={16} /> Saldo inicial
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <p className="md:col-span-4 font-semibold text-gray-700">{form.type === 'AJUSTE' ? 'Nuevo ajuste' : 'Saldo inicial (una sola vez)'}</p>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Días</label>
                    <div className="flex gap-2">
                      <div className="inline-flex rounded-lg border border-primario/30 overflow-hidden text-xs font-semibold shrink-0">
                        {[['+', 'SUMA'], ['-', 'RESTA']].map(([v, t]) => (
                          <button key={v} type="button" aria-pressed={form.signo === v} onClick={() => setForm((f) => ({ ...f, signo: v }))}
                            className={`px-2 py-2 ${form.signo === v ? 'bg-primario text-white' : 'bg-white text-primario hover:bg-primario-claro'}`}>{t}</button>
                        ))}
                      </div>
                      <CampoNumero decimales={3} value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))} className={input} />
                    </div>
                  </div>
                  {form.type === 'SALDO_INICIAL' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Fecha de corte</label>
                      <input type="date" value={form.movement_date} max={hoyISO()} onChange={(e) => setForm((f) => ({ ...f, movement_date: e.target.value }))} className={input} />
                    </div>
                  )}
                  <div className={form.type === 'SALDO_INICIAL' ? 'md:col-span-2' : 'md:col-span-3'}>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Motivo *</label>
                    <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value.toUpperCase() }))} maxLength={300} className={input}
                      placeholder="EJ: CORRECCIÓN SEGÚN ROL DE VACACIONES 2025" />
                  </div>
                  <div className="md:col-span-4 flex justify-end gap-2">
                    <button type="button" onClick={() => { setForm(null); setError(''); }}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-cancelar text-cancelar-texto hover:bg-cancelar-hover"><X size={16} /> Cancelar</button>
                    <button type="button" onClick={guardar} disabled={guardando}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50">
                      {guardando ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
