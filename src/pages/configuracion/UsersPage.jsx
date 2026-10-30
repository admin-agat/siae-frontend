// Usuarios del sistema (CONFIGURACIÓN, solo ADMIN)
// Ubicación: src/pages/configuracion/UsersPage.jsx
//
// 29/10/2026: el ADMIN crea los usuarios de cada área con su rol (antes se creaban a mano en la
// base). Nunca se borran: se desactivan y salen del sistema al instante. El BODEGUERO lleva su
// bodega (la única que puede operar). El "usuario" puede ser un correo o un nombre corto (bquevedo1).
import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deactivateUser, reactivateUser } from '../../api/users';
import { getWarehouses } from '../../api/warehouses';
import { useAuth } from '../../context/AuthContext';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import ModalShell from '../../components/common/ModalShell';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';
import SelectBuscable from '../../components/common/SelectBuscable';

// Rol → qué ve en el sistema (se muestra al elegirlo)
const ROLES = {
  ADMIN: 'Todo el sistema, configuración, liquidación y pagos.',
  EXPORTACIONES: 'Pedido semanal, distribución en barcos, cierre de embarque, navieras y bookings.',
  COMERCIAL: 'Compra de fruta: bloques, compras, precios y bodega de retiro.',
  COORDINADOR_INVENTARIO: 'Inventario completo; confirma transferencias y corrige movimientos.',
  JEFE_BODEGA: 'Inventario (sin corregir movimientos ya registrados).',
  BODEGUERO: 'Solo su bodega: stock, movimientos y despacho de materiales.',
};

const formularioVacio = { name: '', email: '', password: '', role: 'COMERCIAL', phone: '', warehouse_id: '' };

function UserModal({ usuario, bodegas, onClose, onGuardado }) {
  const esEdicion = Boolean(usuario?.id);
  const [form, setForm] = useState(() => (usuario ? {
    name: usuario.name || '', email: usuario.email || '', password: '', role: usuario.role,
    phone: usuario.phone || '', warehouse_id: usuario.warehouse_id ? String(usuario.warehouse_id) : '',
  } : formularioVacio));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: campo === 'name' ? e.target.value.toUpperCase() : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) return setError('ESCRIBE EL NOMBRE Y EL USUARIO.');
    if (!esEdicion && form.password.length < 8) return setError('LA CONTRASEÑA DEBE TENER AL MENOS 8 CARACTERES.');
    if (esEdicion && form.password && form.password.length < 8) return setError('LA CONTRASEÑA DEBE TENER AL MENOS 8 CARACTERES.');
    if (form.role === 'BODEGUERO' && !form.warehouse_id) return setError('UN BODEGUERO DEBE TENER SU BODEGA.');

    setGuardando(true);
    const accion = esEdicion ? 'actualizar' : 'crear';
    try {
      const data = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        phone: form.phone.trim() || null,
        warehouse_id: form.role === 'BODEGUERO' ? Number(form.warehouse_id) : null,
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

  return (
    <ModalShell
      title={esEdicion ? 'Editar usuario' : 'Nuevo usuario'}
      onClose={onClose}
      onSubmit={handleSubmit}
      esEdicion={esEdicion}
      guardando={guardando}
      error={error}
      toast={exito}
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
          <input type="password" value={form.password} onChange={cambiar('password')} maxLength={100} placeholder={esEdicion ? 'Déjala vacía para no cambiarla' : 'Mínimo 8 caracteres'} autoComplete="new-password" className={input} />
        </div>
        <div>
          <label className={label}>Rol *</label>
          <SelectBuscable value={form.role} onChange={cambiar('role')} className={input}>
            {Object.keys(ROLES).map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </SelectBuscable>
        </div>
        <div>
          <label className={label}>Teléfono</label>
          <input value={form.phone} onChange={cambiar('phone')} maxLength={20} className={input} />
        </div>
        {form.role === 'BODEGUERO' && (
          <div className="col-span-2">
            <label className={label}>Bodega *</label>
            <SelectBuscable value={form.warehouse_id} onChange={cambiar('warehouse_id')} className={input}>
              <option value="">SELECCIONAR...</option>
              {bodegas.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </SelectBuscable>
          </div>
        )}
        <p className="col-span-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          <strong>{form.role.replace('_', ' ')}:</strong> {ROLES[form.role]}
          {esEdicion && ' Si cambias el rol, el usuario o la contraseña, deberá volver a iniciar sesión.'}
        </p>
      </div>
    </ModalShell>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null); // null | { usuario }
  const [confirmacion, setConfirmacion] = useState(null); // { usuario, accion }
  const [toast, setToast] = useState(null);

  // El primer "Cargando..." sale del estado inicial; al recargar tras guardar, la tabla queda visible
  const cargar = () => Promise.all([getUsers(), getWarehouses()])
    .then(([resUsuarios, resBodegas]) => {
      setUsuarios(Array.isArray(resUsuarios.data) ? resUsuarios.data : []);
      setBodegas((Array.isArray(resBodegas.data) ? resBodegas.data : []).filter((b) => b.status));
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

  const columnas = [
    { titulo: 'Nombre', render: (u) => u.name, className: 'font-medium' },
    { titulo: 'Usuario', render: (u) => u.email },
    { titulo: 'Rol', render: (u) => <span className="text-xs font-semibold bg-primario-claro text-primario px-2 py-1 rounded-full">{u.role.replace('_', ' ')}</span> },
    { titulo: 'Bodega', render: (u) => u.warehouse_name || <span className="text-gray-400">—</span> },
    { titulo: 'Teléfono', render: (u) => u.phone || <span className="text-gray-400">—</span> },
    { titulo: 'Estado', render: (u) => <EstadoBadge activo={u.status} /> },
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
        subtitulo="Quién entra al sistema y qué puede hacer cada uno"
        textoBoton="Nuevo usuario"
        onNuevo={() => setModal({ usuario: null })}
      />

      <TablaEstandar
        columnas={columnas}
        datos={usuarios}
        cargando={cargando}
        nombreRegistros="usuarios"
        placeholderBusqueda="Buscar por nombre, usuario o rol..."
        textosBusqueda={(u) => [u.name, u.email, u.role, u.warehouse_name]}
      />

      {modal && (
        <UserModal usuario={modal.usuario} bodegas={bodegas} onClose={() => setModal(null)} onGuardado={cargar} />
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
