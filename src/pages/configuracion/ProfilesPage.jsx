// Perfiles y permisos (CONFIGURACIÓN, solo ADMIN)
// Ubicación: src/pages/configuracion/ProfilesPage.jsx
//
// 30/10/2026: permisos por persona. Un perfil = nombre (ej. ASISTENTE COMERCIAL) + tipo base +
// pantallas que ve. El tipo base conserva las reglas de su rol (el bodeguero opera solo su bodega,
// el coordinador corrige movimientos...). Las excepciones de cada persona se ponen en Usuarios.
// El perfil ADMINISTRADOR tiene todo y no se edita.
import { useState, useEffect } from 'react';
import { getProfiles, getScreens, createProfile, updateProfile, deactivateProfile, reactivateProfile } from '../../api/profiles';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import ModalShell from '../../components/common/ModalShell';
import SelectBuscable from '../../components/common/SelectBuscable';
import SelectorPantallas from '../../components/common/SelectorPantallas';
import { pantallasDelTipo } from '../../routes/menu';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

// Tipo base → reglas que hereda (se muestra al elegirlo)
const TIPOS_BASE = {
  EXPORTACIONES: 'Personal de exportaciones.',
  COMERCIAL: 'Personal comercial (compra de fruta).',
  COORDINADOR_INVENTARIO: 'Inventario: además corrige y anula movimientos ya registrados y anula despachos.',
  JEFE_BODEGA: 'Inventario: no corrige movimientos ya registrados.',
  BODEGUERO: 'Opera solo SU bodega (se le asigna en Usuarios) y solo los motivos permitidos al bodeguero.',
  GERENCIA: 'Gerencia: Tablero de operaciones y Ganancia por viaje.',
  FINANZAS: 'Finanzas / Contabilidad: gastos de cada viaje y ganancia.',
  // 05/11/2026
  CONTABILIDAD: 'Contabilidad: aprueba las órdenes de compra de todos los departamentos y genera el archivo de pagos del banco.',
  DEPARTAMENTO: 'Un departamento (Sistemas, Logística...): llena sus órdenes de compra y ve solo las de su departamento (se pone en Usuarios).',
  // 06/11/2026
  // 12/11/2026: los contratos de productores pasaron a LEGAL; Liquidaciones los ve
  LIQUIDACIONES: 'Departamento de Liquidaciones: retención de productores (ve los contratos), parámetros de la semana, tarjas, liquidaciones y pagos.',
  LEGAL: 'Departamento Legal: contratos de productores (cupo, precio, fechas, código bananero, finca, N° MAGAP) y cajas registradas en el MAG.',
};

const formularioVacio = { name: '', base_role: 'COMERCIAL', description: '', screens: [] };

function PerfilModal({ perfil, catalogo, onClose, onGuardado }) {
  const esEdicion = Boolean(perfil?.id);
  const [form, setForm] = useState(() => (perfil ? {
    name: perfil.name, base_role: perfil.base_role, description: perfil.description || '', screens: perfil.screens || [],
  } : formularioVacio));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const permitidas = pantallasDelTipo(catalogo, form.base_role);
  const marcadas = form.screens.filter((k) => permitidas.some((p) => p.key === k));

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: campo === 'name' ? e.target.value.toUpperCase() : e.target.value }));
  const alternar = (key) => setForm((f) => ({
    ...f, screens: f.screens.includes(key) ? f.screens.filter((k) => k !== key) : [...f.screens, key],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('ESCRIBE EL NOMBRE DEL PERFIL.');
    if (marcadas.length === 0) return setError('MARCA AL MENOS UNA PANTALLA.');

    setGuardando(true);
    const accion = esEdicion ? 'actualizar' : 'crear';
    try {
      // Las claves se mandan en el orden del menú
      const data = { ...form, name: form.name.trim(), description: form.description.trim() || null, screens: permitidas.map((p) => p.key).filter((k) => marcadas.includes(k)) };
      if (esEdicion) await updateProfile(perfil.id, data);
      else await createProfile(data);
      setExito(getMensajeExito('perfil', accion));
      setTimeout(() => { onGuardado(); onClose(); }, 900);
    } catch (err) {
      console.error('ERROR AL GUARDAR EL PERFIL:', err);
      const errores = err.response?.data?.errors;
      setError(errores ? Object.values(errores).flat().join(' ') : (err.response?.data?.message || getMensajeError('perfil', accion)));
    } finally {
      setGuardando(false);
    }
  };

  const label = 'block text-sm font-semibold text-gray-700 mb-1.5';
  const input = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';

  return (
    <ModalShell
      title={esEdicion ? 'Editar perfil' : 'Nuevo perfil'}
      onClose={onClose}
      onSubmit={handleSubmit}
      esEdicion={esEdicion}
      guardando={guardando}
      error={error}
      toast={exito}
      size="lg"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Nombre *</label>
          <input value={form.name} onChange={cambiar('name')} maxLength={100} placeholder="EJ. ASISTENTE COMERCIAL" className={input} />
        </div>
        <div>
          <label className={label}>Tipo base *</label>
          <SelectBuscable value={form.base_role} onChange={cambiar('base_role')} disabled={esEdicion && perfil.users_count > 0} className={input}
            title={esEdicion && perfil.users_count > 0 ? 'Tiene usuarios: para otro tipo base crea otro perfil' : ''}>
            {Object.keys(TIPOS_BASE).map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </SelectBuscable>
        </div>
        <p className="col-span-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          <strong>Tipo base {form.base_role.replace('_', ' ')}:</strong> {TIPOS_BASE[form.base_role]} Las pantallas que ve se marcan abajo.
        </p>
        <div className="col-span-2">
          <label className={label}>Descripción</label>
          <input value={form.description} onChange={cambiar('description')} maxLength={255} placeholder="EJ. AYUDA A LA JEFA COMERCIAL CON LAS COMPRAS" className={input} />
        </div>
        <div className="col-span-2">
          <label className={label}>Pantallas que ve ({marcadas.length}) *</label>
          <SelectorPantallas catalogo={permitidas} marcadas={marcadas} onAlternar={alternar} />
          <p className="text-xs text-gray-500 mt-2">
            Quien tiene una pantalla la ve y puede hacer todo en ella. Usuarios, Perfiles y Bitácora son solo del administrador.
            {esEdicion && ' Los cambios se aplican a todos los usuarios con este perfil al abrir el sistema.'}
          </p>
        </div>
      </div>
    </ModalShell>
  );
}

export default function ProfilesPage() {
  const [perfiles, setPerfiles] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null); // null | { perfil }
  const [confirmacion, setConfirmacion] = useState(null); // { perfil, accion }
  const [toast, setToast] = useState(null);

  const cargar = () => Promise.all([getProfiles(), getScreens()])
    .then(([resPerfiles, resPantallas]) => {
      setPerfiles(Array.isArray(resPerfiles.data) ? resPerfiles.data : []);
      setCatalogo(Array.isArray(resPantallas.data) ? resPantallas.data : []);
    })
    .catch((err) => {
      console.error('ERROR AL CARGAR PERFILES:', err);
      setPerfiles([]);
    })
    .finally(() => setCargando(false));

  useEffect(() => { cargar(); }, []);

  const handleConfirmarAccion = async () => {
    const { perfil, accion } = confirmacion;
    try {
      if (accion === 'desactivar') await deactivateProfile(perfil.id);
      else await reactivateProfile(perfil.id);
      await cargar();
      setToast({ tipo: 'exito', mensaje: getMensajeExito('perfil', accion) });
    } catch (err) {
      console.error('ERROR AL CAMBIAR ESTADO DEL PERFIL:', err);
      setToast({ tipo: 'error', mensaje: err.response?.data?.message || getMensajeError('perfil', accion) });
    } finally {
      setConfirmacion(null);
    }
  };

  const nombrePantalla = (key) => catalogo.find((p) => p.key === key)?.nombre || key;
  const esAdmin = (p) => p.base_role === 'ADMIN';

  const columnas = [
    { titulo: 'Perfil', render: (p) => <div><div className="font-medium">{p.name}</div>{p.description && <div className="text-xs text-gray-500">{p.description}</div>}</div> },
    { titulo: 'Tipo base', render: (p) => <span className="text-xs font-semibold bg-primario-claro text-primario px-2 py-1 rounded-full whitespace-nowrap">{p.base_role.replace('_', ' ')}</span> },
    {
      titulo: 'Pantallas',
      render: (p) => esAdmin(p)
        ? <span className="text-xs font-semibold text-gray-600">TODO EL SISTEMA</span>
        : <span className="text-xs text-gray-600" title={(p.screens || []).map(nombrePantalla).join(', ')}>
            {(p.screens || []).length} · {(p.screens || []).slice(0, 3).map(nombrePantalla).join(', ')}{(p.screens || []).length > 3 ? '…' : ''}
          </span>,
    },
    { titulo: 'Usuarios', render: (p) => p.users_count },
    { titulo: 'Estado', render: (p) => <EstadoBadge activo={p.status} /> },
    {
      titulo: 'Acciones',
      render: (p) => esAdmin(p)
        ? <span className="text-xs text-gray-400">No se edita</span>
        : (
          <AccionesFila
            activo={p.status}
            onEditar={() => setModal({ perfil: p })}
            onDesactivar={() => setConfirmacion({ perfil: p, accion: 'desactivar' })}
            onReactivar={() => setConfirmacion({ perfil: p, accion: 'reactivar' })}
          />
        ),
    },
  ];

  const esDesactivar = confirmacion?.accion === 'desactivar';

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

      <EncabezadoPagina
        titulo="Perfiles y permisos"
        subtitulo="Qué pantallas ve cada tipo de usuario. Las excepciones de una persona se ponen en Usuarios."
        textoBoton="Nuevo perfil"
        onNuevo={() => setModal({ perfil: null })}
      />

      <TablaEstandar
        columnas={columnas}
        datos={perfiles}
        cargando={cargando}
        nombreRegistros="perfiles"
        placeholderBusqueda="Buscar perfil..."
        textosBusqueda={(p) => [p.name, p.base_role, p.description]}
      />

      {modal && (
        <PerfilModal perfil={modal.perfil} catalogo={catalogo} onClose={() => setModal(null)} onGuardado={cargar} />
      )}

      {confirmacion && (
        <DialogoConfirmacion
          titulo={esDesactivar ? 'Desactivar perfil' : 'Reactivar perfil'}
          peligro={esDesactivar}
          onCancelar={() => setConfirmacion(null)}
          onAceptar={handleConfirmarAccion}
        >
          ¿Estás seguro de {esDesactivar ? 'desactivar' : 'reactivar'} el perfil <strong>{confirmacion.perfil.name}</strong>?
          {esDesactivar && ' Solo se puede si no tiene usuarios activos.'}
        </DialogoConfirmacion>
      )}
    </div>
  );
}
