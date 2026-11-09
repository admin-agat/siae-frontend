// Usuarios del sistema (CONFIGURACIÓN, solo ADMIN)
// Ubicación: src/pages/configuracion/UsersPage.jsx
//
// 29/10/2026: el ADMIN crea los usuarios de cada área (antes se creaban a mano en la base).
// Nunca se borran: se desactivan y salen del sistema al instante. El BODEGUERO lleva su
// bodega (la única que puede operar). El "usuario" puede ser un correo o un nombre corto (bquevedo1).
// 30/10/2026: permisos por persona. En vez de un rol fijo, cada usuario lleva un PERFIL (Perfiles y
// permisos), de quién es asistente y excepciones propias: pantallas de más o de menos que su perfil.
import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deactivateUser, reactivateUser } from '../../api/users';
import { getProfiles, getScreens } from '../../api/profiles';
import { getWarehouses } from '../../api/warehouses';
import { useAuth } from '../../context/AuthContext';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import ModalShell from '../../components/common/ModalShell';
import CampoClave from '../../components/common/CampoClave';
import SelectorPantallas from '../../components/common/SelectorPantallas';
import { pantallasDelTipo } from '../../routes/menu';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';
import SelectBuscable from '../../components/common/SelectBuscable';
import { soloTelefono } from '../../utils/telefono';

const formularioVacio = { name: '', email: '', password: '', profile_id: '', boss_id: '', phone: '', department: '', warehouse_id: '', warehouse_ids: [], screens_added: [], screens_removed: [] };

function UserModal({ usuario, perfiles, usuarios, catalogo, bodegas, departamentos, onClose, onGuardado }) {
  const esEdicion = Boolean(usuario?.id);
  const [form, setForm] = useState(() => (usuario ? {
    name: usuario.name || '', email: usuario.email || '', password: '',
    profile_id: usuario.profile_id ? String(usuario.profile_id) : '', boss_id: usuario.boss_id ? String(usuario.boss_id) : '',
    phone: usuario.phone || '', department: usuario.department || '', warehouse_id: usuario.warehouse_id ? String(usuario.warehouse_id) : '',
    warehouse_ids: usuario.warehouse_ids || [],
    screens_added: usuario.screens_added || [], screens_removed: usuario.screens_removed || [],
  } : formularioVacio));
  const [verExcepciones, setVerExcepciones] = useState(() => Boolean(usuario?.screens_added?.length || usuario?.screens_removed?.length));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const perfil = perfiles.find((p) => String(p.id) === form.profile_id);
  const tipo = perfil?.base_role;
  const permitidas = pantallasDelTipo(catalogo, tipo);
  const esPermitida = (k) => permitidas.some((p) => p.key === k);
  const delPerfil = (perfil?.screens || []).filter(esPermitida);
  // Lo que verá: perfil + agregadas − quitadas
  const efectivas = tipo === 'ADMIN'
    ? catalogo.map((p) => p.key)
    : [...new Set([...delPerfil, ...form.screens_added])].filter((k) => esPermitida(k) && !form.screens_removed.includes(k));

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: campo === 'name' || campo === 'department' ? e.target.value.toUpperCase() : campo === 'phone' ? soloTelefono(e.target.value) : e.target.value }));
  // Marcar/desmarcar una pantalla respecto a su perfil: lo que no es del perfil queda como EXTRA,
  // lo que es del perfil y se desmarca queda como QUITADA
  const alternar = (key) => setForm((f) => {
    const sin = (lista) => lista.filter((k) => k !== key);
    if (delPerfil.includes(key)) {
      return { ...f, screens_removed: f.screens_removed.includes(key) ? sin(f.screens_removed) : [...f.screens_removed, key] };
    }
    return { ...f, screens_added: f.screens_added.includes(key) ? sin(f.screens_added) : [...f.screens_added, key] };
  });
  const etiqueta = (key) => {
    if (form.screens_added.includes(key) && !delPerfil.includes(key)) return { texto: 'EXTRA', clase: 'bg-green-100 text-green-700' };
    if (form.screens_removed.includes(key) && delPerfil.includes(key)) return { texto: 'QUITADA', clase: 'bg-red-100 text-red-700' };
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) return setError('ESCRIBE EL NOMBRE Y EL USUARIO.');
    if (!esEdicion && form.password.length < 8) return setError('LA CONTRASEÑA DEBE TENER AL MENOS 8 CARACTERES.');
    if (esEdicion && form.password && form.password.length < 8) return setError('LA CONTRASEÑA DEBE TENER AL MENOS 8 CARACTERES.');
    if (!form.profile_id) return setError('ELIGE EL PERFIL DEL USUARIO.');
    if (tipo === 'BODEGUERO' && !form.warehouse_id) return setError('UN BODEGUERO DEBE TENER SU BODEGA.');
    if (tipo === 'DEPARTAMENTO' && !form.department.trim()) return setError('ESCRIBE EL DEPARTAMENTO DEL USUARIO (EJ. SISTEMAS).');

    setGuardando(true);
    const accion = esEdicion ? 'actualizar' : 'crear';
    try {
      // Solo se guardan las excepciones que de verdad cambian algo respecto al perfil
      const data = {
        name: form.name.trim(),
        email: form.email.trim(),
        profile_id: Number(form.profile_id),
        boss_id: form.boss_id ? Number(form.boss_id) : null,
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        warehouse_id: tipo === 'BODEGUERO' ? Number(form.warehouse_id) : null,
        // 03/11/2026: bodegas que opera (ninguna = todas); el BODEGUERO y el ADMIN no llevan
        warehouse_ids: ['ADMIN', 'BODEGUERO'].includes(tipo) ? [] : form.warehouse_ids,
        screens_added: form.screens_added.filter((k) => esPermitida(k) && !delPerfil.includes(k)),
        screens_removed: form.screens_removed.filter((k) => delPerfil.includes(k)),
        ...(form.password ? { password: form.password } : {}),
      };
      if (esEdicion) await updateUser(usuario.id, data);
      else await createUser(data);
      setExito(getMensajeExito('usuario', accion));
      setTimeout(() => { onGuardado(); onClose(); }, 900);
    } catch (err) {
      console.error('ERROR AL GUARDAR EL USUARIO:', err);
      const errores = err.response?.data?.errors;
      setError(errores ? Object.values(errores).flat().join(' ') : (err.response?.data?.message || getMensajeError('usuario', accion)));
    } finally {
      setGuardando(false);
    }
  };

  const label = 'block text-sm font-semibold text-gray-700 mb-1.5';
  const input = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
  const nExcepciones = form.screens_added.filter((k) => esPermitida(k) && !delPerfil.includes(k)).length + form.screens_removed.filter((k) => delPerfil.includes(k)).length;

  return (
    <ModalShell
      title={esEdicion ? 'Editar usuario' : 'Nuevo usuario'}
      onClose={onClose}
      onSubmit={handleSubmit}
      esEdicion={esEdicion}
      guardando={guardando}
      error={error}
      toast={exito}
      size="lg"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={label}>Nombre *</label>
          <input value={form.name} onChange={cambiar('name')} maxLength={255} placeholder="EJ. MARÍA PÉREZ" className={input} />
        </div>
        <div>
          <label className={label}>Usuario o correo *</label>
          <input value={form.email} onChange={cambiar('email')} maxLength={255} placeholder="mperez@agat-ecuagreen.com" autoComplete="off" className={input} />
        </div>
        <div>
          <label className={label}>{esEdicion ? 'Nueva contraseña' : 'Contraseña *'}</label>
          {/* 09/11/2026: con ojo para ver lo que se escribe */}
          <CampoClave value={form.password} onChange={cambiar('password')} maxLength={100} placeholder={esEdicion ? 'Déjala vacía para no cambiarla' : 'Mínimo 8, con letras y números'} autoComplete="new-password" className={input} aria-label={esEdicion ? 'Nueva contraseña' : 'Contraseña'} />
        </div>
        <div>
          <label className={label}>Perfil *</label>
          <SelectBuscable value={form.profile_id} onChange={cambiar('profile_id')} className={input}>
            <option value="">SELECCIONAR...</option>
            {perfiles.filter((p) => p.status || String(p.id) === form.profile_id).map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </SelectBuscable>
        </div>
        <div>
          <label className={label}>Asistente de</label>
          <SelectBuscable value={form.boss_id} onChange={cambiar('boss_id')} className={input}>
            <option value="">NADIE (ES JEFE O TRABAJA SOLO)</option>
            {usuarios.filter((u) => u.status && u.id !== usuario?.id).map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
          </SelectBuscable>
        </div>
        <div>
          <label className={label}>Teléfono</label>
          <input value={form.phone} onChange={cambiar('phone')} maxLength={20} className={input} />
        </div>
        {tipo && tipo !== 'ADMIN' && (
          <div>
            {/* 05/11/2026: sus órdenes de compra llevan este departamento (obligatorio para el tipo DEPARTAMENTO) */}
            <label className={label} htmlFor="usuario-departamento">Departamento{tipo === 'DEPARTAMENTO' && ' *'}</label>
            <input id="usuario-departamento" list="lista-departamentos" value={form.department} onChange={cambiar('department')} maxLength={60}
              placeholder="EJ. SISTEMAS, LOGÍSTICA, COMPRAS" className={input} />
            <datalist id="lista-departamentos">
              {departamentos.map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>
        )}
        {tipo === 'BODEGUERO' && (
          <div>
            <label className={label}>Bodega *</label>
            <SelectBuscable value={form.warehouse_id} onChange={cambiar('warehouse_id')} className={input}>
              <option value="">SELECCIONAR...</option>
              {bodegas.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </SelectBuscable>
          </div>
        )}
        {tipo && !['ADMIN', 'BODEGUERO'].includes(tipo) && (
          <div className="col-span-2">
            <label className={label}>Bodegas que opera</label>
            <div className="flex flex-wrap gap-2">
              {bodegas.map((b) => {
                const marcada = form.warehouse_ids.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={marcada}
                    onClick={() => setForm((f) => ({ ...f, warehouse_ids: marcada ? f.warehouse_ids.filter((x) => x !== b.id) : [...f.warehouse_ids, b.id] }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${marcada ? 'bg-primario text-white border-primario' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    {b.name}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {form.warehouse_ids.length
                ? 'Solo podrá despachar, registrar y ver movimientos de las bodegas marcadas.'
                : 'Sin ninguna marcada puede operar todas las bodegas.'}
            </p>
          </div>
        )}

        {perfil && (
          <div className="col-span-2 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
            {tipo === 'ADMIN'
              ? <><strong>{perfil.name}:</strong> todo el sistema, usuarios, perfiles y bitácora.</>
              : <><strong>Verá {efectivas.length} pantalla(s):</strong> {catalogo.filter((p) => efectivas.includes(p.key)).map((p) => p.nombre).join(', ') || 'ninguna'}.</>}
            {esEdicion && ' Si cambias el usuario, la contraseña o el tipo base, deberá volver a iniciar sesión.'}
          </div>
        )}

        {perfil && tipo !== 'ADMIN' && (
          <div className="col-span-2">
            <button type="button" onClick={() => setVerExcepciones((v) => !v)} className="text-sm font-semibold text-primario hover:underline">
              {verExcepciones ? '▾' : '▸'} Excepciones solo para esta persona {nExcepciones > 0 && `(${nExcepciones})`}
            </button>
            {verExcepciones && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-2">
                  Marca una pantalla que su perfil no tiene para dársela (<span className="font-semibold text-green-700">EXTRA</span>) o
                  desmarca una del perfil para quitársela (<span className="font-semibold text-red-700">QUITADA</span>). No cambia a los demás del perfil.
                </p>
                <SelectorPantallas catalogo={permitidas} marcadas={efectivas} onAlternar={alternar} etiqueta={etiqueta} />
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null); // null | { usuario }
  const [confirmacion, setConfirmacion] = useState(null); // { usuario, accion }
  const [toast, setToast] = useState(null);

  // El primer "Cargando..." sale del estado inicial; al recargar tras guardar, la tabla queda visible
  const cargar = () => Promise.all([getUsers(), getWarehouses(), getProfiles(), getScreens()])
    .then(([resUsuarios, resBodegas, resPerfiles, resPantallas]) => {
      setUsuarios(Array.isArray(resUsuarios.data) ? resUsuarios.data : []);
      setBodegas((Array.isArray(resBodegas.data) ? resBodegas.data : []).filter((b) => b.status));
      setPerfiles(Array.isArray(resPerfiles.data) ? resPerfiles.data : []);
      setCatalogo(Array.isArray(resPantallas.data) ? resPantallas.data : []);
    })
    .catch((err) => {
      console.error('ERROR AL CARGAR USUARIOS:', err);
      setUsuarios([]);
    })
    .finally(() => setCargando(false));

  useEffect(() => { cargar(); }, []);

  const handleConfirmarAccion = async () => {
    const { usuario, accion } = confirmacion;
    try {
      if (accion === 'desactivar') await deactivateUser(usuario.id);
      else await reactivateUser(usuario.id);
      await cargar();
      setToast({ tipo: 'exito', mensaje: getMensajeExito('usuario', accion) });
    } catch (err) {
      console.error('ERROR AL CAMBIAR ESTADO DEL USUARIO:', err);
      setToast({ tipo: 'error', mensaje: err.response?.data?.message || getMensajeError('usuario', accion) });
    } finally {
      setConfirmacion(null);
    }
  };

  const nombrePantalla = (key) => catalogo.find((p) => p.key === key)?.nombre || key;

  const columnas = [
    { titulo: 'Nombre', render: (u) => u.name, className: 'font-medium' },
    { titulo: 'Usuario', render: (u) => u.email },
    { titulo: 'Perfil', render: (u) => <span className="text-xs font-semibold bg-primario-claro text-primario px-2 py-1 rounded-full whitespace-nowrap">{u.profile_name || u.role.replace('_', ' ')}</span> },
    { titulo: 'Departamento', render: (u) => u.department || <span className="text-gray-400">—</span> },
    { titulo: 'Asistente de', render: (u) => u.boss_name || <span className="text-gray-400">—</span> },
    {
      titulo: 'Excepciones',
      render: (u) => {
        const mas = u.screens_added || [];
        const menos = u.screens_removed || [];
        if (!mas.length && !menos.length) return <span className="text-gray-400">—</span>;
        return (
          <div className="text-xs space-y-0.5">
            {mas.length > 0 && <div className="text-green-700">+ {mas.map(nombrePantalla).join(', ')}</div>}
            {menos.length > 0 && <div className="text-red-700 line-through">{menos.map(nombrePantalla).join(', ')}</div>}
          </div>
        );
      },
    },
    { titulo: 'Bodega', render: (u) => u.warehouse_name || (u.warehouse_names?.length ? u.warehouse_names.join(', ') : <span className="text-gray-400">—</span>) },
    {
      titulo: 'Estado',
      render: (u) => (
        <div className="flex flex-col items-start gap-1">
          <EstadoBadge activo={u.status} />
          {/* 09/11/2026: aún no cambia la contraseña que le dio el ADMIN, o le venció (3 meses) */}
          {u.status && u.cambiar_clave && (
            <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full whitespace-nowrap"
              title={u.cambiar_clave === 'VENCIDA' ? 'Pasaron 3 meses desde su último cambio' : 'Debe cambiar la contraseña al entrar'}>
              {u.cambiar_clave === 'VENCIDA' ? 'CONTRASEÑA VENCIDA' : 'FALTA CAMBIAR CONTRASEÑA'}
            </span>
          )}
        </div>
      ),
    },
    {
      titulo: 'Acciones',
      render: (u) => (
        <AccionesFila
          activo={u.status}
          onEditar={() => setModal({ usuario: u })}
          // El ADMIN no puede desactivarse a sí mismo (el backend también lo impide)
          onDesactivar={u.id === user?.id ? undefined : () => setConfirmacion({ usuario: u, accion: 'desactivar' })}
          onReactivar={() => setConfirmacion({ usuario: u, accion: 'reactivar' })}
        />
      ),
    },
  ];

  const esDesactivar = confirmacion?.accion === 'desactivar';

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

      <EncabezadoPagina
        titulo="Usuarios"
        subtitulo="Quién entra al sistema, su perfil y las pantallas que ve cada uno"
        textoBoton="Nuevo usuario"
        onNuevo={() => setModal({ usuario: null })}
      />

      <TablaEstandar
        columnas={columnas}
        datos={usuarios}
        cargando={cargando}
        nombreRegistros="usuarios"
        placeholderBusqueda="Buscar por nombre, usuario, perfil o jefe..."
        textosBusqueda={(u) => [u.name, u.email, u.profile_name, u.boss_name, u.warehouse_name, u.department]}
      />

      {modal && (
        <UserModal usuario={modal.usuario} perfiles={perfiles} usuarios={usuarios} catalogo={catalogo} bodegas={bodegas}
          departamentos={[...new Set(usuarios.map((u) => u.department).filter(Boolean))].sort()}
          onClose={() => setModal(null)} onGuardado={cargar} />
      )}

      {confirmacion && (
        <DialogoConfirmacion
          titulo={esDesactivar ? 'Desactivar usuario' : 'Reactivar usuario'}
          peligro={esDesactivar}
          onCancelar={() => setConfirmacion(null)}
          onAceptar={handleConfirmarAccion}
        >
          ¿Estás seguro de {esDesactivar ? 'desactivar' : 'reactivar'} a <strong>{confirmacion.usuario.name}</strong>?
          {esDesactivar && ' No podrá iniciar sesión y saldrá del sistema de inmediato.'}
        </DialogoConfirmacion>
      )}
    </div>
  );
}
