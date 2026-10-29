// Página de Destinos (países/ciudades de destino de las exportaciones)
// Ubicación: src/pages/exportaciones/DestinationsPage.jsx
//
// 28/10/2026 — migrada a los componentes comunes con la paleta oficial
// (EncabezadoPagina, TablaEstandar, AccionesFila, EstadoBadge, DialogoConfirmacion, ToastFlotante).
// Ahora se cargan TODOS los destinos una sola vez y TablaEstandar filtra por pestaña en pantalla.
import { useState, useEffect } from 'react';
import DestinationModal from '../../components/DestinationModal';
import { getDestinations, deactivateDestination, reactivateDestination } from '../../api/destinations';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

export default function DestinationsPage() {
  const [destinos, setDestinos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  // confirmacion = null (cerrado) o { destino, accion: 'desactivar' | 'reactivar' }
  const [confirmacion, setConfirmacion] = useState(null);
  const [toast, setToast] = useState(null);

  const cargar = async () => {
    try {
      setCargando(true);
      const res = await getDestinations();
      // Patrón defensivo: acepta array directo o { data: [...] }
      setDestinos(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch (err) {
      console.error('ERROR AL CARGAR DESTINOS:', err);
      setDestinos([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const handleConfirmarAccion = async () => {
    const { destino, accion } = confirmacion;
    try {
      if (accion === 'desactivar') {
        await deactivateDestination(destino.id);
      } else {
        await reactivateDestination(destino.id);
      }
      await cargar();
      setToast({ tipo: 'exito', mensaje: getMensajeExito('destino', accion) });
    } catch (err) {
      console.error('ERROR AL CAMBIAR ESTADO DEL DESTINO:', err);
      setToast({ tipo: 'error', mensaje: getMensajeError('destino', accion) });
    } finally {
      setConfirmacion(null);
    }
  };

  const columnas = [
    { titulo: 'Nombre', render: (d) => d.name, className: 'font-medium' },
    { titulo: 'Estado', render: (d) => <EstadoBadge activo={d.status} /> },
    {
      titulo: 'Acciones',
      render: (d) => (
        <AccionesFila
          activo={d.status}
          onEditar={() => { setEditando(d); setModalAbierto(true); }}
          onDesactivar={() => setConfirmacion({ destino: d, accion: 'desactivar' })}
          onReactivar={() => setConfirmacion({ destino: d, accion: 'reactivar' })}
        />
      ),
    },
  ];

  const esDesactivar = confirmacion?.accion === 'desactivar';

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

      <EncabezadoPagina
        titulo="Destinos"
        subtitulo="Destinos de las exportaciones"
        textoBoton="Nuevo destino"
        onNuevo={() => { setEditando(null); setModalAbierto(true); }}
      />

      <TablaEstandar
        columnas={columnas}
        datos={destinos}
        cargando={cargando}
        nombreRegistros="destinos"
        placeholderBusqueda="Buscar destino..."
        textosBusqueda={(d) => [d.name]}
      />

      {modalAbierto && (
        <DestinationModal
          destino={editando}
          onClose={() => setModalAbierto(false)}
          onGuardado={cargar}
        />
      )}

      {confirmacion && (
        <DialogoConfirmacion
          titulo={esDesactivar ? 'Desactivar destino' : 'Reactivar destino'}
          peligro={esDesactivar}
          onCancelar={() => setConfirmacion(null)}
          onAceptar={handleConfirmarAccion}
        >
          ¿Estás seguro de {esDesactivar ? 'desactivar' : 'reactivar'}{' '}
          <strong>{confirmacion.destino.name}</strong>?
        </DialogoConfirmacion>
      )}
    </div>
  );
}
