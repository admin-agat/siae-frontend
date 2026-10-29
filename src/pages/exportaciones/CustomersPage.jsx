// Página de Clientes (ficha comercial de los terceros tipo CLIENTE)
// Ubicación: src/pages/exportaciones/CustomersPage.jsx
//
// 28/10/2026 — migrada a los componentes comunes con la paleta oficial
// (EncabezadoPagina, TablaEstandar, AccionesFila, EstadoBadge, DialogoConfirmacion, ToastFlotante).
// Ahora se cargan TODOS los clientes una sola vez y TablaEstandar filtra por pestaña en pantalla
// (antes se volvía a pedir al backend con ?status= cada vez que se cambiaba de pestaña).
import { useState, useEffect } from 'react';
import CustomerModal from '../../components/CustomerModal';
import { getCustomers, deactivateCustomer, reactivateCustomer } from '../../api/customers';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  // confirmacion = null (cerrado) o { customer, accion: 'desactivar' | 'reactivar' }
  const [confirmacion, setConfirmacion] = useState(null);
  const [toast, setToast] = useState(null);

  const cargar = async () => {
    try {
      setCargando(true);
      const res = await getCustomers();
      // Patrón defensivo: acepta array directo o { data: [...] }
      setCustomers(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch (err) {
      console.error('ERROR AL CARGAR CLIENTES:', err);
      setCustomers([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const handleConfirmarAccion = async () => {
    const { customer, accion } = confirmacion;
    try {
      if (accion === 'desactivar') {
        await deactivateCustomer(customer.id);
      } else {
        await reactivateCustomer(customer.id);
      }
      await cargar();
      setToast({ tipo: 'exito', mensaje: getMensajeExito('cliente', accion) });
    } catch (err) {
      console.error('ERROR AL CAMBIAR ESTADO DEL CLIENTE:', err);
      setToast({ tipo: 'error', mensaje: getMensajeError('cliente', accion) });
    } finally {
      setConfirmacion(null);
    }
  };

  const columnas = [
    { titulo: 'Código', render: (c) => c.customer_code, className: 'font-mono text-xs' },
    { titulo: 'Tercero', render: (c) => c.third_party?.name, className: 'font-medium' },
    { titulo: 'País', render: (c) => c.country },
    { titulo: 'Contacto', render: (c) => c.contact_name },
    // Marcas del cliente (varias); se eligen en el modal
    {
      titulo: 'Marcas',
      render: (c) => (c.brands?.length ? (
        <div className="flex flex-wrap gap-1">
          {c.brands.map((b) => (
            <span key={b.id} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">{b.name}</span>
          ))}
        </div>
      ) : null),
    },
    // Antes "Tipo negociación": un cliente compra por CONTRATO y SPOT a la vez, así que se
    // muestra si HOY tiene un contrato vigente (lo calcula el backend desde Contratos de clientes)
    {
      titulo: 'Contrato vigente',
      render: (c) => (
        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
          c.tiene_contrato_vigente ? 'bg-primario-claro text-primario' : 'bg-gray-100 text-gray-500'
        }`}>
          {c.tiene_contrato_vigente ? 'SÍ' : 'NO'}
        </span>
      ),
    },
    { titulo: 'Estado', render: (c) => <EstadoBadge activo={c.status} /> },
    {
      titulo: 'Acciones',
      render: (c) => (
        <AccionesFila
          activo={c.status}
          onEditar={() => { setEditando(c); setModalAbierto(true); }}
          onDesactivar={() => setConfirmacion({ customer: c, accion: 'desactivar' })}
          onReactivar={() => setConfirmacion({ customer: c, accion: 'reactivar' })}
        />
      ),
    },
  ];

  const esDesactivar = confirmacion?.accion === 'desactivar';

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

      <EncabezadoPagina
        titulo="Clientes"
        subtitulo="Ficha comercial de los clientes del exterior"
        textoBoton="Nuevo cliente"
        onNuevo={() => { setEditando(null); setModalAbierto(true); }}
      />

      <TablaEstandar
        columnas={columnas}
        datos={customers}
        cargando={cargando}
        nombreRegistros="clientes"
        placeholderBusqueda="Buscar por código, cliente, país o contacto..."
        textosBusqueda={(c) => [c.customer_code, c.third_party?.name, c.country, c.contact_name, ...(c.brands || []).map((b) => b.name)]}
      />

      {modalAbierto && (
        <CustomerModal
          customer={editando}
          onClose={() => setModalAbierto(false)}
          onGuardado={cargar}
        />
      )}

      {confirmacion && (
        <DialogoConfirmacion
          titulo={esDesactivar ? 'Desactivar cliente' : 'Reactivar cliente'}
          peligro={esDesactivar}
          onCancelar={() => setConfirmacion(null)}
          onAceptar={handleConfirmarAccion}
        >
          ¿Estás seguro de {esDesactivar ? 'desactivar' : 'reactivar'}{' '}
          <strong>{confirmacion.customer.customer_code} — {confirmacion.customer.third_party?.name}</strong>?
        </DialogoConfirmacion>
      )}
    </div>
  );
}
