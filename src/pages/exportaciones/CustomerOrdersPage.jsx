// Página de PEDIDOS SEMANALES (correo de Rusia) — listado
// Ubicación: src/pages/exportaciones/CustomerOrdersPage.jsx
//
// Un solo pedido por semana/año: si Rusia manda correcciones se EDITA el mismo pedido.
// El detalle (líneas, precios, totales por cliente) está en CustomerOrderFormPage.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomerOrders, deactivateCustomerOrder, reactivateCustomerOrder } from '../../api/customerOrders';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import CustomerOrderViewModal from '../../components/CustomerOrderViewModal';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

// 20200 → "20.200" (formato del correo)
const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');

// "2026-08-31" → "31/08/2026"
const formatoFecha = (f) => (f ? f.split('-').reverse().join('/') : null);

export default function CustomerOrdersPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  // confirmacion = null (cerrado) o { pedido, accion: 'desactivar' | 'reactivar' }
  const [confirmacion, setConfirmacion] = useState(null);
  const [toast, setToast] = useState(null);
  // Pedido abierto en el modal de solo lectura (null = cerrado); imprimir = lanza la impresión al cargar
  const [ver, setVer] = useState(null); // { id, imprimir }

  const cargar = async () => {
    try {
      setCargando(true);
      const res = await getCustomerOrders();
      setPedidos(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch (err) {
      console.error('ERROR AL CARGAR PEDIDOS:', err);
      setPedidos([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const handleConfirmarAccion = async () => {
    const { pedido, accion } = confirmacion;
    try {
      if (accion === 'desactivar') {
        await deactivateCustomerOrder(pedido.id);
      } else {
        await reactivateCustomerOrder(pedido.id);
      }
      await cargar();
      setToast({ tipo: 'exito', mensaje: getMensajeExito('pedido', accion) });
    } catch (err) {
      console.error('ERROR AL CAMBIAR ESTADO DEL PEDIDO:', err);
      setToast({ tipo: 'error', mensaje: getMensajeError('pedido', accion) });
    } finally {
      setConfirmacion(null);
    }
  };

  const columnas = [
    { titulo: 'Semana', render: (p) => `SEMANA ${p.week} / ${p.year}`, className: 'font-medium' },
    { titulo: 'Recibido', render: (p) => formatoFecha(p.received_at) },
    { titulo: 'Líneas', render: (p) => p.lines_count },
    { titulo: 'Total cajas', render: (p) => formatoCajas(p.total_boxes), className: 'font-semibold' },
    { titulo: 'Comentario', render: (p) => p.comment, className: 'text-xs text-gray-500' },
    { titulo: 'Estado', render: (p) => <EstadoBadge activo={p.status} /> },
    {
      titulo: 'Acciones',
      render: (p) => (
        <AccionesFila
          activo={p.status}
          onVer={() => setVer({ id: p.id, imprimir: false })}
          onImprimir={() => setVer({ id: p.id, imprimir: true })}
          onEditar={() => navigate(`/exportaciones/pedidos/${p.id}`)}
          onDesactivar={() => setConfirmacion({ pedido: p, accion: 'desactivar' })}
          onReactivar={() => setConfirmacion({ pedido: p, accion: 'reactivar' })}
        />
      ),
    },
  ];

  const esDesactivar = confirmacion?.accion === 'desactivar';

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

      <EncabezadoPagina
        titulo="Pedido semanal"
        subtitulo="Pedido que envía Rusia cada semana (un pedido por semana; las correcciones se editan)"
        textoBoton="Nuevo pedido"
        onNuevo={() => navigate('/exportaciones/pedidos/nuevo')}
      />

      <TablaEstandar
        columnas={columnas}
        datos={pedidos}
        cargando={cargando}
        nombreRegistros="pedidos"
        placeholderBusqueda="Buscar por semana, año o comentario..."
        textosBusqueda={(p) => [`SEMANA ${p.week}`, p.week, p.year, p.comment]}
      />

      {ver && (
        <CustomerOrderViewModal
          key={`${ver.id}-${ver.imprimir}`}
          pedidoId={ver.id}
          imprimirAlAbrir={ver.imprimir}
          onClose={() => setVer(null)}
          onEditar={() => navigate(`/exportaciones/pedidos/${ver.id}`)}
        />
      )}

      {confirmacion && (
        <DialogoConfirmacion
          titulo={esDesactivar ? 'Anular pedido' : 'Reactivar pedido'}
          peligro={esDesactivar}
          onCancelar={() => setConfirmacion(null)}
          onAceptar={handleConfirmarAccion}
        >
          ¿Estás seguro de {esDesactivar ? 'anular' : 'reactivar'} el pedido de la{' '}
          <strong>semana {confirmacion.pedido.week} / {confirmacion.pedido.year}</strong>?
        </DialogoConfirmacion>
      )}
    </div>
  );
}
