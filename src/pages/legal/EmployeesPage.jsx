// Empleados y saldos de vacaciones — src/pages/legal/EmployeesPage.jsx
//
// 16/11/2026: VACACIONES Y PERMISOS, fase 1 (docs/modulos/vacaciones-permisos.md). Pantalla de LEGAL
// (empleados_saldos) con tres pestañas:
//   EMPLEADOS      ficha del personal (cédula enmascarada en la lista), jefe inmediato, usuario, años de
//                  servicio, saldo y aviso de días acumulados; kárdex con ajustes y saldo inicial.
//   DEPARTAMENTOS  catálogo (se elige con búsqueda en la ficha).
//   FERIADOS       por año, con el día ya trasladado por decreto (sirven para los permisos de la fase 2).
// Las solicitudes y la aprobación del jefe llegan en la fase 2.
import { useCallback, useEffect, useState } from 'react';
import { BookOpen, AlertTriangle } from 'lucide-react';
import {
  getEmployees, getEmployeeOptions, deactivateEmployee, reactivateEmployee,
  getDepartments, createDepartment, updateDepartment, deactivateDepartment, reactivateDepartment,
  getHolidays, createHoliday, updateHoliday, deactivateHoliday, reactivateHoliday,
} from '../../api/employees';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import ModalShell from '../../components/common/ModalShell';
import EmployeeModal from '../../components/EmployeeModal';
import VacationLedgerModal from '../../components/VacationLedgerModal';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';
import { hoyISO } from '../../utils/fecha';

const fDias = (n) => Number(n || 0).toLocaleString('es-EC', { maximumFractionDigits: 2 });
const fFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');
const PESTANAS = [['EMPLEADOS', 'EMPLEADOS'], ['DEPARTAMENTOS', 'DEPARTAMENTOS'], ['FERIADOS', 'FERIADOS']];
const ANIO = new Date().getFullYear();

// Modal pequeño para departamento o feriado
function ModalCatalogo({ tipo, registro, onClose, onGuardado }) {
  const esEdicion = Boolean(registro?.id);
  const [form, setForm] = useState(tipo === 'departamento'
    ? { name: registro?.name || '' }
    : { holiday_date: registro?.holiday_date?.slice(0, 10) || '', name: registro?.name || '', scope: registro?.scope || 'NACIONAL' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState('');

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      if (tipo === 'departamento') await (esEdicion ? updateDepartment(registro.id, form) : createDepartment(form));
      else await (esEdicion ? updateHoliday(registro.id, form) : createHoliday(form));
      setExito(getMensajeExito(tipo, esEdicion ? 'actualizar' : 'crear'));
      onGuardado();
      setTimeout(onClose, 800);
    } catch (err) {
      const errores = err.response?.data?.errors;
      setError(errores ? Object.values(errores).flat()[0] : getMensajeError(tipo, esEdicion ? 'actualizar' : 'crear'));
      setGuardando(false);
    }
  };

  const input = 'w-full bg-gray-100 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primario';
  const label = 'block text-sm font-semibold text-gray-700 mb-1.5';
  const titulo = `${esEdicion ? 'Editar' : 'Nuevo'} ${tipo === 'departamento' ? 'departamento' : 'feriado'}`;

  return (
    <ModalShell title={titulo} onClose={onClose} onSubmit={guardar} esEdicion={esEdicion} guardando={guardando} error={error} toast={exito} size="sm">
      {tipo === 'departamento' ? (
        <div>
          <label className={label}>Nombre *</label>
          <input value={form.name} onChange={(e) => setForm({ name: e.target.value.toUpperCase() })} maxLength={60} className={input} placeholder="EJ: LOGÍSTICA" />
        </div>
      ) : (
        <>
          <div>
            <label className={label}>Fecha (ya trasladada) *</label>
            <input type="date" value={form.holiday_date} onChange={(e) => setForm((f) => ({ ...f, holiday_date: e.target.value }))} className={input} />
          </div>
          <div>
            <label className={label}>Nombre *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))} maxLength={100} className={input} placeholder="EJ: NAVIDAD" />
          </div>
          <div>
            <label className={label}>Alcance</label>
            <div className="inline-flex rounded-lg border border-primario/30 overflow-hidden text-xs font-semibold">
              {['NACIONAL', 'LOCAL'].map((s) => (
                <button key={s} type="button" aria-pressed={form.scope === s} onClick={() => setForm((f) => ({ ...f, scope: s }))}
                  className={`px-3 py-2 ${form.scope === s ? 'bg-primario text-white' : 'bg-white text-primario hover:bg-primario-claro'}`}>{s}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </ModalShell>
  );
}

export default function EmployeesPage() {
  const [pestana, setPestana] = useState('EMPLEADOS');
  const [empleados, setEmpleados] = useState([]);
  const [opciones, setOpciones] = useState({});
  const [departamentos, setDepartamentos] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [anioFeriados, setAnioFeriados] = useState(ANIO);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState(null);

  const [modalEmpleado, setModalEmpleado] = useState(null); // {} nuevo · empleado editar
  const [kardex, setKardex] = useState(null);
  const [modalCatalogo, setModalCatalogo] = useState(null); // { tipo, registro }
  // { tipo: 'empleado'|'departamento'|'feriado', registro, accion }
  const [confirmacion, setConfirmacion] = useState(null);
  const [fechaSalida, setFechaSalida] = useState(hoyISO());

  const cargarEmpleados = useCallback(() => Promise.all([getEmployees(), getEmployeeOptions()])
    .then(([e, o]) => { setEmpleados(e.data); setOpciones(o.data); })
    .catch(() => setToast({ tipo: 'error', mensaje: 'NO SE PUDIERON CARGAR LOS EMPLEADOS.' })), []);
  const cargarDepartamentos = useCallback(() => getDepartments().then((r) => setDepartamentos(r.data)).catch(() => {}), []);
  const cargarFeriados = useCallback(() => getHolidays({ year: anioFeriados }).then((r) => setFeriados(r.data)).catch(() => {}), [anioFeriados]);

  useEffect(() => {
    Promise.all([cargarEmpleados(), cargarDepartamentos()]).finally(() => setCargando(false));
  }, [cargarEmpleados, cargarDepartamentos]);
  useEffect(() => { cargarFeriados(); }, [cargarFeriados]);

  const ejecutar = async () => {
    const { tipo, registro, accion } = confirmacion;
    const llamadas = {
      empleado: [() => deactivateEmployee(registro.id, fechaSalida), () => reactivateEmployee(registro.id), cargarEmpleados],
      departamento: [() => deactivateDepartment(registro.id), () => reactivateDepartment(registro.id), () => Promise.all([cargarDepartamentos(), cargarEmpleados()])],
      feriado: [() => deactivateHoliday(registro.id), () => reactivateHoliday(registro.id), cargarFeriados],
    }[tipo];
    try {
      await (accion === 'desactivar' ? llamadas[0]() : llamadas[1]());
      await llamadas[2]();
      setToast({ tipo: 'exito', mensaje: getMensajeExito(tipo, accion) });
    } catch (err) {
      const errores = err.response?.data?.errors;
      setToast({ tipo: 'error', mensaje: errores ? Object.values(errores).flat()[0] : getMensajeError(tipo, accion) });
    } finally {
      setConfirmacion(null);
    }
  };

  const colsEmpleados = [
    { titulo: 'Empleado', className: 'font-medium', render: (e) => (
      <div>
        {e.full_name}
        <span className="block text-xs text-gray-400">{e.id_type === 'PASAPORTE' ? 'PAS.' : 'C.I.'} {e.id_card_masked}</span>
      </div>
    ) },
    { titulo: 'Departamento', render: (e) => <div>{e.department}<span className="block text-xs text-gray-400">{e.position || ''}</span></div> },
    { titulo: 'Jefe inmediato', render: (e) => e.supervisor || <span className="text-xs text-gray-400">GERENCIA</span> },
    { titulo: 'Usuario', render: (e) => e.user?.email || <span className="text-xs text-gray-400">—</span> },
    { titulo: 'Ingreso', render: (e) => <div className="whitespace-nowrap">{fFecha(e.hire_date)}<span className="block text-xs text-gray-400">{e.anios_servicio} años</span></div> },
    { titulo: 'Saldo', render: (e) => (
      <div className="whitespace-nowrap">
        <strong>{fDias(e.saldo)}</strong> días
        {e.acumulado_viejo > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-700" title="Días ganados hace más de 3 años sin gozar">
            <AlertTriangle size={12} /> {fDias(e.acumulado_viejo)} viejos
          </span>
        )}
      </div>
    ) },
    { titulo: 'Estado', render: (e) => <EstadoBadge activo={e.status} /> },
    { titulo: 'Acciones', render: (e) => (
      <div className="flex gap-2" onClick={(ev) => ev.stopPropagation()}>
        <button type="button" onClick={() => setKardex(e)} title="Kárdex de vacaciones"
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover">
          <BookOpen size={14} /> Kárdex
        </button>
        <AccionesFila activo={e.status} onEditar={() => setModalEmpleado(e)}
          onDesactivar={() => { setFechaSalida(hoyISO()); setConfirmacion({ tipo: 'empleado', registro: e, accion: 'desactivar' }); }}
          onReactivar={() => setConfirmacion({ tipo: 'empleado', registro: e, accion: 'reactivar' })} />
      </div>
    ) },
  ];

  const colsDepartamentos = [
    { titulo: 'Departamento', className: 'font-medium', render: (d) => d.name },
    { titulo: 'Empleados activos', render: (d) => d.employees_count },
    { titulo: 'Estado', render: (d) => <EstadoBadge activo={d.status} /> },
    { titulo: 'Acciones', render: (d) => (
      <AccionesFila activo={d.status} onEditar={() => setModalCatalogo({ tipo: 'departamento', registro: d })}
        onDesactivar={() => setConfirmacion({ tipo: 'departamento', registro: d, accion: 'desactivar' })}
        onReactivar={() => setConfirmacion({ tipo: 'departamento', registro: d, accion: 'reactivar' })} />
    ) },
  ];

  const colsFeriados = [
    { titulo: 'Fecha', render: (h) => fFecha(h.holiday_date?.slice(0, 10)) },
    { titulo: 'Feriado', className: 'font-medium', render: (h) => h.name },
    { titulo: 'Alcance', render: (h) => h.scope },
    { titulo: 'Estado', render: (h) => <EstadoBadge activo={h.status} /> },
    { titulo: 'Acciones', render: (h) => (
      <AccionesFila activo={h.status} onEditar={() => setModalCatalogo({ tipo: 'feriado', registro: h })}
        onDesactivar={() => setConfirmacion({ tipo: 'feriado', registro: h, accion: 'desactivar' })}
        onReactivar={() => setConfirmacion({ tipo: 'feriado', registro: h, accion: 'reactivar' })} />
    ) },
  ];

  const boton = {
    EMPLEADOS: ['Nuevo empleado', () => setModalEmpleado({})],
    DEPARTAMENTOS: ['Nuevo departamento', () => setModalCatalogo({ tipo: 'departamento', registro: null })],
    FERIADOS: ['Nuevo feriado', () => setModalCatalogo({ tipo: 'feriado', registro: null })],
  }[pestana];
  const nombreDe = (c) => (c.tipo === 'empleado' ? c.registro.full_name : c.registro.name);
  const esDesactivar = confirmacion?.accion === 'desactivar';

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />
      <EncabezadoPagina titulo="Empleados y saldos de vacaciones"
        subtitulo="Ficha del personal, jefe inmediato y kárdex de días (15 por año, +1 desde el 5.º año)"
        textoBoton={boton[0]} onNuevo={boton[1]} />

      <div className="flex flex-wrap gap-2 mb-3">
        {PESTANAS.map(([clave, etiqueta]) => (
          <button key={clave} type="button" onClick={() => setPestana(clave)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${pestana === clave ? 'bg-primario text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {etiqueta}
          </button>
        ))}
        {pestana === 'FERIADOS' && (
          <select value={anioFeriados} onChange={(e) => setAnioFeriados(Number(e.target.value))} aria-label="Año de los feriados"
            className="ml-auto bg-gray-100 border border-gray-200 rounded-2xl px-3 py-1 text-sm">
            {[ANIO - 1, ANIO, ANIO + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      {pestana === 'EMPLEADOS' && (
        <TablaEstandar columnas={colsEmpleados} datos={empleados} cargando={cargando} nombreRegistros="empleados"
          placeholderBusqueda="Buscar por nombre, departamento, cargo o jefe..."
          textosBusqueda={(e) => [e.full_name, e.department, e.position, e.supervisor, e.user?.email]} />
      )}
      {pestana === 'DEPARTAMENTOS' && (
        <TablaEstandar columnas={colsDepartamentos} datos={departamentos} cargando={cargando} nombreRegistros="departamentos"
          placeholderBusqueda="Buscar departamento..." textosBusqueda={(d) => [d.name]} />
      )}
      {pestana === 'FERIADOS' && (
        <TablaEstandar columnas={colsFeriados} datos={feriados} nombreRegistros="feriados"
          placeholderBusqueda="Buscar feriado..." textosBusqueda={(h) => [h.name]} />
      )}

      {modalEmpleado && (
        <EmployeeModal empleado={modalEmpleado.id ? modalEmpleado : null} opciones={opciones}
          onClose={() => setModalEmpleado(null)} onGuardado={cargarEmpleados} />
      )}
      {kardex && <VacationLedgerModal empleado={kardex} onClose={() => setKardex(null)} onCambio={cargarEmpleados} />}
      {modalCatalogo && (
        <ModalCatalogo tipo={modalCatalogo.tipo} registro={modalCatalogo.registro} onClose={() => setModalCatalogo(null)}
          onGuardado={modalCatalogo.tipo === 'departamento' ? () => Promise.all([cargarDepartamentos(), cargarEmpleados()]) : cargarFeriados} />
      )}

      {confirmacion && (
        <DialogoConfirmacion titulo={`${esDesactivar ? 'Desactivar' : 'Reactivar'} ${confirmacion.tipo}`} peligro={esDesactivar}
          onCancelar={() => setConfirmacion(null)} onAceptar={ejecutar}>
          ¿Estás seguro de {esDesactivar ? 'desactivar' : 'reactivar'} <strong>{nombreDe(confirmacion)}</strong>?
          {esDesactivar && confirmacion.tipo === 'empleado' && (
            <span className="block mt-3">
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Fecha de salida *</label>
              <input type="date" value={fechaSalida} onChange={(e) => setFechaSalida(e.target.value)}
                className="w-full bg-gray-100 rounded-2xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primario" />
            </span>
          )}
          {!esDesactivar && confirmacion.tipo === 'empleado' && ' Se borra su fecha de salida.'}
        </DialogoConfirmacion>
      )}
    </div>
  );
}
