// Anticipos y préstamos al productor (Liquidación)
// Ubicación: src/pages/liquidacion/ProducerAdvancesPage.jsx
//
// Dinero entregado por adelantado. Se descuenta en las liquidaciones (todo o en partes):
// SALDO = monto − lo ya descontado. Uno ya descontado no se edita ni se desactiva.
import { useState, useEffect } from 'react';
import {
  getProducerAdvances, deactivateProducerAdvance, reactivateProducerAdvance,
} from '../../api/settlements';
import ProducerAdvanceModal from '../../components/ProducerAdvanceModal';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import { getMensajeExito } from '../../utils/toastMessages';

const formatoDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatoFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');

export default function ProducerAdvancesPage() {
  const [anticipos, setAnticipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null); // null = cerrado, {} = nuevo, anticipo = editar
  const [confirmacion, setConfirmacion] = useState(null); // { anticipo, accion }
  const [toast, setToast] = useState(null);

  const cargar = async () => {
    try {
      setCargando(true);
      const res = await getProducerAdvances();
      setAnticipos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error cargando anticipos:', err);
      setAnticipos([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const ejecutarConfirmacion = async () => {
    const { anticipo, accion } = confirmacion;
    try {
      if (accion === 'desactivar') await deactivateProducerAdvance(anticipo.id);
      else await reactivateProducerAdvance(anticipo.id);
      cargar();
      setToast({ tipo: 'exito', mensaje: getMensajeExito('anticipo', accion) });
    } catch (err) {
      console.error(`Error al ${accion} anticipo:`, err);
      setToast({ tipo: 'error', mensaje: err.response?.data?.message || `Error al ${accion} el anticipo` });
    } finally {
      setConfirmacion(null);
    }
  };

  const avisarDescontado = () => setToast({ tipo: 'error', mensaje: 'Ya se descontó en una liquidación: no se puede modificar' });

  const columnas = [
    { titulo: 'Fecha', render: (a) => formatoFecha(a.date) },
    { titulo: 'Productor', render: (a) => a.third_party?.name, className: 'font-medium' },
    { titulo: 'Tipo', render: (a) => (a.type === 'PRESTAMO' ? 'PRÉSTAMO' : 'ANTICIPO') },
    { titulo: 'Concepto', render: (a) => a.concept || '—' },
    { titulo: 'Monto', render: (a) => `$ ${formatoDinero(a.amount)}` },
    { titulo: 'Descontado', render: (a) => `$ ${formatoDinero(a.descontado)}` },
    {
      titulo: 'Saldo',
      render: (a) => (
        <span className={`font-semibold ${a.saldo > 0 ? 'text-amber-700' : 'text-green-700'}`}>
          {a.saldo > 0 ? `$ ${formatoDinero(a.saldo)}` : 'DESCONTADO'}
        </span>
      ),
    },
    { titulo: 'Estado', render: (a) => <EstadoBadge activo={a.status} /> },
    {
      titulo: 'Acciones',
      render: (a) => (
        <AccionesFila
          activo={a.status}
          onEditar={() => (a.descontado > 0 ? avisarDescontado() : setModal(a))}
          onDesactivar={() => (a.descontado > 0 ? avisarDescontado() : setConfirmacion({ anticipo: a, accion: 'desactivar' }))}
          onReactivar={() => setConfirmacion({ anticipo: a, accion: 'reactivar' })}
        />
      ),
    },
  ];

  const saldoTotal = anticipos.filter((a) => a.status).reduce((s, a) => s + Number(a.saldo || 0), 0);

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

      <EncabezadoPagina
        titulo="Anticipos y préstamos"
        subtitulo="Dinero adelantado al productor; se descuenta en sus liquidaciones"
        textoBoton="Nuevo anticipo"
        onNuevo={() => setModal({})}
      />

      <p className="text-sm text-gray-600 mb-3">
        Saldo total por descontar: <strong className="text-amber-700">$ {formatoDinero(saldoTotal)}</strong>
      </p>

      <TablaEstandar
        columnas={columnas}
        datos={anticipos}
        cargando={cargando}
        nombreRegistros="anticipos"
        placeholderBusqueda="Buscar por productor, concepto o comprobante..."
        textosBusqueda={(a) => [a.third_party?.name, a.concept, a.reference, a.type]}
      />

      {modal && (
        <ProducerAdvanceModal
          anticipo={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onGuardado={cargar}
        />
      )}

      {confirmacion && (
        <DialogoConfirmacion
          titulo={confirmacion.accion === 'desactivar' ? 'Desactivar anticipo' : 'Reactivar anticipo'}
          peligro={confirmacion.accion === 'desactivar'}
          onCancelar={() => setConfirmacion(null)}
          onAceptar={ejecutarConfirmacion}
        >
          ¿Seguro que deseas {confirmacion.accion} el anticipo de <strong>{confirmacion.anticipo.third_party?.name}</strong> por $ {formatoDinero(confirmacion.anticipo.amount)}?
        </DialogoConfirmacion>
      )}
    </div>
  );
}
