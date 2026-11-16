// Ficha de EMPLEADO (crear/editar) — LEGAL → Empleados y saldos. Vacaciones fase 1 (16/11/2026).
// Cédula (validada con dígito verificador en el backend) o pasaporte; departamento del catálogo y jefe
// inmediato con búsqueda; usuario del SIAE opcional (nunca uno compartido de DEPARTAMENTO).
// Al crear se puede cargar el SALDO INICIAL de vacaciones a una fecha de corte (los aniversarios
// anteriores al corte ya van incluidos en ese saldo).
import { useEffect, useRef, useState } from 'react';
import { createEmployee, updateEmployee, getEmployee } from '../api/employees';
import { getMensajeExito, getMensajeError } from '../utils/toastMessages';
import { hoyISO } from '../utils/fecha';
import ModalShell from './common/ModalShell';
import DialogoConfirmacion from './common/DialogoConfirmacion';
import SelectBuscable from './common/SelectBuscable';
import CampoNumero from './common/CampoNumero';

const VACIO = {
  full_name: '', id_type: 'CEDULA', id_card: '', department_id: '', position: '', hire_date: '',
  supervisor_id: '', user_id: '', workweek_days: '5', vacation_cutoff_date: '', notes: '', initial_balance: '',
};

export default function EmployeeModal({ empleado, opciones, onClose, onGuardado }) {
  const esEdicion = Boolean(empleado?.id);
  const [form, setForm] = useState(VACIO);
  const inicial = useRef(null);
  const [cargando, setCargando] = useState(esEdicion);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  useEffect(() => {
    const llenar = (e) => {
      const datos = e ? {
        full_name: e.full_name || '', id_type: e.id_type || 'CEDULA', id_card: e.id_card || '',
        department_id: e.department_id ? String(e.department_id) : '', position: e.position || '',
        hire_date: e.hire_date || '', supervisor_id: e.supervisor_id ? String(e.supervisor_id) : '',
        user_id: e.user_id ? String(e.user_id) : '', workweek_days: String(e.workweek_days || 5),
        vacation_cutoff_date: e.vacation_cutoff_date || '', notes: e.notes || '', initial_balance: '',
      } : VACIO;
      setForm(datos);
      inicial.current = datos;
    };
    if (!esEdicion) { llenar(null); return; }
    // La cédula completa solo viene en la ficha (la lista la trae enmascarada)
    getEmployee(empleado.id)
      .then((r) => llenar(r.data))
      .catch(() => setError('NO SE PUDO CARGAR LA FICHA DEL EMPLEADO.'))
      .finally(() => setCargando(false));
  }, [empleado, esEdicion]);

  const cambiar = (e) => {
    const { name, value } = e.target;
    const mayus = ['full_name', 'id_card', 'position', 'notes'].includes(name);
    setForm((f) => ({ ...f, [name]: mayus ? value.toUpperCase() : value }));
  };

  const cancelar = () => {
    if (JSON.stringify(form) !== JSON.stringify(inicial.current)) { setConfirmarSalida(true); return; }
    onClose();
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.full_name.trim() || !form.id_card.trim() || !form.department_id || !form.hire_date) {
      setError('COMPLETA APELLIDOS Y NOMBRES, CÉDULA O PASAPORTE, DEPARTAMENTO Y FECHA DE INGRESO.');
      return;
    }
    const data = {
      ...form,
      department_id: Number(form.department_id),
      supervisor_id: form.supervisor_id ? Number(form.supervisor_id) : null,
      user_id: form.user_id ? Number(form.user_id) : null,
      workweek_days: Number(form.workweek_days),
      vacation_cutoff_date: form.vacation_cutoff_date || null,
      position: form.position.trim() || null,
      notes: form.notes.trim() || null,
      initial_balance: !esEdicion && form.initial_balance !== '' ? Number(form.initial_balance) : null,
    };
    if (esEdicion) delete data.initial_balance;
    setGuardando(true);
    try {
      if (esEdicion) await updateEmployee(empleado.id, data);
      else await createEmployee(data);
      setExito(getMensajeExito('empleado', esEdicion ? 'actualizar' : 'crear'));
      onGuardado?.();
      setTimeout(onClose, 900);
    } catch (err) {
      const errores = err.response?.data?.errors;
      setError(errores ? Object.values(errores).flat()[0] : (err.response?.data?.message || getMensajeError('empleado', esEdicion ? 'actualizar' : 'crear')));
      setGuardando(false);
    }
  };

  const input = 'w-full bg-gray-100 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primario';
  const label = 'block text-sm font-semibold text-gray-700 mb-1.5';
  const jefes = (opciones.supervisors || []).filter((s) => s.id !== empleado?.id);
  // Usuarios libres + el que ya tiene este empleado
  const usuarios = (opciones.users || []).filter((u) => !u.employee_id || u.employee_id === empleado?.id);

  return (
    <>
      <ModalShell title={esEdicion ? 'Editar empleado' : 'Nuevo empleado'} onClose={cancelar} onSubmit={guardar}
        esEdicion={esEdicion} guardando={guardando} deshabilitado={cargando} error={error} toast={exito} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={label}>Apellidos y nombres *</label>
            <input name="full_name" value={form.full_name} onChange={cambiar} className={input} placeholder="EJ: PÉREZ LÓPEZ JUAN CARLOS" />
          </div>
          <div>
            <label className={label}>Documento *</label>
            <div className="flex gap-2">
              <div className="inline-flex rounded-lg border border-primario/30 overflow-hidden text-xs font-semibold shrink-0">
                {['CEDULA', 'PASAPORTE'].map((t) => (
                  <button key={t} type="button" aria-pressed={form.id_type === t} onClick={() => setForm((f) => ({ ...f, id_type: t }))}
                    className={`px-2.5 py-2 ${form.id_type === t ? 'bg-primario text-white' : 'bg-white text-primario hover:bg-primario-claro'}`}>
                    {t === 'CEDULA' ? 'CÉDULA' : 'PASAPORTE'}
                  </button>
                ))}
              </div>
              <input name="id_card" value={form.id_card} onChange={cambiar} className={input} maxLength={20} autoComplete="off"
                inputMode={form.id_type === 'CEDULA' ? 'numeric' : 'text'} placeholder={form.id_type === 'CEDULA' ? '10 DÍGITOS' : 'LETRAS Y NÚMEROS'} />
            </div>
          </div>
          <div>
            <label className={label}>Departamento *</label>
            <SelectBuscable name="department_id" value={form.department_id} onChange={cambiar} className={input}>
              <option value="">ELEGIR...</option>
              {(opciones.departments || []).map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </SelectBuscable>
          </div>
          <div>
            <label className={label}>Cargo</label>
            <input name="position" value={form.position} onChange={cambiar} className={input} />
          </div>
          <div>
            <label className={label}>Fecha de ingreso *</label>
            <input type="date" name="hire_date" value={form.hire_date} max={hoyISO()} onChange={cambiar} className={input} />
          </div>
          <div>
            <label className={label}>Jefe inmediato</label>
            <SelectBuscable name="supervisor_id" value={form.supervisor_id} onChange={cambiar} className={input}>
              <option value="">SIN JEFE (APRUEBA GERENCIA)</option>
              {jefes.map((s) => <option key={s.id} value={String(s.id)}>{s.full_name}</option>)}
            </SelectBuscable>
          </div>
          <div>
            <label className={label}>Usuario del SIAE</label>
            <SelectBuscable name="user_id" value={form.user_id} onChange={cambiar} className={input}>
              <option value="">SIN USUARIO</option>
              {usuarios.map((u) => <option key={u.id} value={String(u.id)}>{u.name} · {u.email}</option>)}
            </SelectBuscable>
          </div>
          <div>
            <label className={label}>Días de trabajo a la semana</label>
            <div className="inline-flex rounded-lg border border-primario/30 overflow-hidden text-xs font-semibold">
              {[['5', 'LUNES A VIERNES'], ['6', 'LUNES A SÁBADO']].map(([v, t]) => (
                <button key={v} type="button" aria-pressed={form.workweek_days === v} onClick={() => setForm((f) => ({ ...f, workweek_days: v }))}
                  className={`px-3 py-2 ${form.workweek_days === v ? 'bg-primario text-white' : 'bg-white text-primario hover:bg-primario-claro'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={label}>Fecha de corte del saldo</label>
            <input type="date" name="vacation_cutoff_date" value={form.vacation_cutoff_date} max={hoyISO()} onChange={cambiar} className={input} />
            <p className="text-xs text-gray-500 mt-1">Solo si se migra un saldo: los aniversarios hasta esta fecha ya van en el saldo inicial.</p>
          </div>
          {!esEdicion && (
            <div>
              <label className={label}>Saldo inicial (días a la fecha de corte)</label>
              <CampoNumero decimales={3} name="initial_balance" value={form.initial_balance} onChange={cambiar} className={input} placeholder="EJ: 12" />
            </div>
          )}
          <div className="md:col-span-2">
            <label className={label}>Notas</label>
            <input name="notes" value={form.notes} onChange={cambiar} className={input} maxLength={300} />
          </div>
        </div>
      </ModalShell>

      {confirmarSalida && (
        <DialogoConfirmacion titulo="¿Seguro que deseas salir?" textoAceptar="Salir sin guardar" textoCancelar="Seguir editando"
          onCancelar={() => setConfirmarSalida(false)} onAceptar={onClose}>
          Tienes cambios sin guardar que se perderán.
        </DialogoConfirmacion>
      )}
    </>
  );
}
