// Puertos (CONFIGURACIÓN) — maestro de puertos y sus tarifas
// Ubicación: src/pages/exportaciones/PortsMasterDetailPage.jsx
// Ruta: /exportaciones/puertos (se mantiene la URL; en el menú está en CONFIGURACIÓN)
//
// 29/10/2026: rehecha con los componentes comunes (antes: panel oscuro + panel celeste,
// confirmaciones propias, sin buscador ni avisos). Ahora:
//   - Tabla estándar con buscador, pestañas ACTIVOS/INACTIVOS/TODOS y filtro por tipo
//     (SALIDA = Ecuador, se usa en el pedido semanal y los barcos; DESTINO = llegada).
//   - Botón "Tarifas" por puerto → abre debajo sus conceptos de tarifa.
//   - Solo ADMIN (dato maestro); el backend también limita la escritura a ADMIN.
import { useState, useEffect, useCallback } from 'react';
import { DollarSign, X } from 'lucide-react';
import PortModal from '../../components/PortModal';
import PortTariffItemModal from '../../components/PortTariffItemModal';
import { getPorts, deactivatePort, reactivatePort } from '../../api/ports';
import { getPortTariffItems, deactivatePortTariffItem, reactivatePortTariffItem } from '../../api/portTariffItems';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import EstadoBadge from '../../components/common/EstadoBadge';
import AccionesFila from '../../components/common/AccionesFila';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';

const formatoDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FILTROS_TIPO = [
  { clave: 'TODOS', etiqueta: 'TODOS' },
  { clave: 'SALIDA', etiqueta: 'SALIDA (ECUADOR)' },
  { clave: 'DESTINO', etiqueta: 'DESTINO' },
];

// Badge del tipo de puerto (clases completas: Tailwind v4)
const TipoBadge = ({ tipo }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tipo === 'SALIDA' ? 'bg-primario-claro text-primario' : 'bg-amber-50 text-amber-700'}`}>
    {tipo}
  </span>
);

export default function PortsMasterDetailPage() {
  const [puertos, setPuertos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [modalPuerto, setModalPuerto] = useState(null); // null = cerrado, {} = nuevo, puerto = editar
  const [puertoTarifas, setPuertoTarifas] = useState(null); // puerto cuyas tarifas se ven abajo

  const [tarifas, setTarifas] = useState([]);
  const [cargandoTarifas, setCargandoTarifas] = useState(false);
  const [modalTarifa, setModalTarifa] = useState(null); // null = cerrado, {} = nueva, item = editar

  // { tipo: 'puerto' | 'tarifa', registro, accion: 'desactivar' | 'reactivar' }
  const [confirmacion, setConfirmacion] = useState(null);
  const [toast, setToast] = useState(null);

  const cargarPuertos = useCallback(async () => {
    try {
      const res = await getPorts();
      setPuertos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('ERROR AL CARGAR PUERTOS:', err);
      setPuertos([]);
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarTarifas = useCallback(async (puerto) => {
    if (!puerto) return;
    setCargandoTarifas(true);
    try {
      const res = await getPortTariffItems({ port_id: puerto.id });
      setTarifas(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('ERROR AL CARGAR TARIFAS:', err);
      setTarifas([]);
    } finally {
      setCargandoTarifas(false);
    }
  }, []);

  useEffect(() => {
    cargarPuertos();
  }, [cargarPuertos]);

  const verTarifas = (puerto) => {
    setPuertoTarifas(puerto);
    setTarifas([]);
    cargarTarifas(puerto);
  };

  const ejecutarConfirmacion = async () => {
    const { tipo, registro, accion } = confirmacion;
    const entidad = tipo === 'puerto' ? 'puerto' : 'concepto tarifa';
    try {
      if (tipo === 'puerto') {
        if (accion === 'desactivar') await deactivatePort(registro.id);
        else await reactivatePort(registro.id);
        await cargarPuertos();
      } else {
        if (accion === 'desactivar') await deactivatePortTariffItem(registro.id);
        else await reactivatePortTariffItem(registro.id);
        await cargarTarifas(puertoTarifas);
      }
      setToast({ tipo: 'exito', mensaje: getMensajeExito(entidad, accion) });
    } catch (err) {
      console.error(`ERROR AL ${accion.toUpperCase()}:`, err);
      setToast({ tipo: 'error', mensaje: err.response?.data?.message || getMensajeError(entidad, accion) });
    } finally {
      setConfirmacion(null);
    }
  };

  const columnasPuertos = [
    { titulo: 'Nombre', render: (p) => p.name, className: 'font-medium' },
    { titulo: 'Código', render: (p) => p.code || '—' },
    { titulo: 'Ciudad', render: (p) => p.city || '—' },
    { titulo: 'País', render: (p) => p.country || '—' },
    { titulo: 'Tipo', render: (p) => <TipoBadge tipo={p.port_type} /> },
    { titulo: 'Estado', render: (p) => <EstadoBadge activo={p.status} /> },
    {
      titulo: 'Acciones',
      render: (p) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => verTarifas(p)}
            title="Ver tarifas del puerto"
            className={`flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition ${puertoTarifas?.id === p.id ? 'bg-primario-hover text-white' : 'bg-primario text-white hover:bg-primario-hover'}`}
          >
            <DollarSign size={14} /> Tarifas
          </button>
          <AccionesFila
            activo={p.status}
            onEditar={() => setModalPuerto(p)}
            onDesactivar={() => setConfirmacion({ tipo: 'puerto', registro: p, accion: 'desactivar' })}
            onReactivar={() => setConfirmacion({ tipo: 'puerto', registro: p, accion: 'reactivar' })}
          />
        </div>
      ),
    },
  ];

  const columnasTarifas = [
    { titulo: 'Concepto', render: (t) => t.concept, className: 'font-medium' },
    { titulo: 'Monto', render: (t) => `$ ${formatoDinero(t.amount)}` },
    { titulo: 'Estado', render: (t) => <EstadoBadge activo={t.status} /> },
    {
      titulo: 'Acciones',
      render: (t) => (
        <AccionesFila
          activo={t.status}
          onEditar={() => setModalTarifa(t)}
          onDesactivar={() => setConfirmacion({ tipo: 'tarifa', registro: t, accion: 'desactivar' })}
          onReactivar={() => setConfirmacion({ tipo: 'tarifa', registro: t, accion: 'reactivar' })}
        />
      ),
    },
  ];

  const puertosFiltrados = filtroTipo === 'TODOS' ? puertos : puertos.filter((p) => p.port_type === filtroTipo);
  const esDesactivar = confirmacion?.accion === 'desactivar';

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

      <EncabezadoPagina
        titulo="Puertos"
        subtitulo="Puertos de SALIDA (Ecuador: pedido semanal y barcos) y de DESTINO, con sus tarifas"
        textoBoton="Nuevo puerto"
        onNuevo={() => setModalPuerto({})}
      />

      <div className="flex flex-wrap gap-2 mb-3">
        {FILTROS_TIPO.map((f) => (
          <button
            key={f.clave}
            type="button"
            onClick={() => setFiltroTipo(f.clave)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${filtroTipo === f.clave ? 'bg-primario text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {f.etiqueta} ({f.clave === 'TODOS' ? puertos.length : puertos.filter((p) => p.port_type === f.clave).length})
          </button>
        ))}
      </div>

      <TablaEstandar
        columnas={columnasPuertos}
        datos={puertosFiltrados}
        cargando={cargando}
        nombreRegistros="puertos"
        placeholderBusqueda="Buscar por nombre, código, ciudad o país..."
        textosBusqueda={(p) => [p.name, p.code, p.city, p.country]}
      />

      {/* Tarifas del puerto elegido */}
      {puertoTarifas && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <DollarSign size={20} className="text-primario" /> Tarifas — {puertoTarifas.name}
              </h2>
              <p className="text-sm text-gray-500">Conceptos que cobra el puerto (cada cambio de monto queda en el historial)</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModalTarifa({})}
                className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition"
              >
                + Nuevo concepto
              </button>
              <button
                type="button"
                onClick={() => setPuertoTarifas(null)}
                title="Cerrar tarifas"
                className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <TablaEstandar
            columnas={columnasTarifas}
            datos={tarifas}
            cargando={cargandoTarifas}
            nombreRegistros="conceptos"
            placeholderBusqueda="Buscar concepto..."
            textosBusqueda={(t) => [t.concept]}
          />
        </div>
      )}

      {modalPuerto && (
        <PortModal
          puerto={modalPuerto.id ? modalPuerto : null}
          onClose={() => setModalPuerto(null)}
          onGuardado={cargarPuertos}
        />
      )}

      {modalTarifa && (
        <PortTariffItemModal
          item={modalTarifa.id ? modalTarifa : null}
          portId={puertoTarifas?.id}
          onClose={() => setModalTarifa(null)}
          onGuardado={() => cargarTarifas(puertoTarifas)}
        />
      )}

      {confirmacion && (
        <DialogoConfirmacion
          titulo={`${esDesactivar ? 'Desactivar' : 'Reactivar'} ${confirmacion.tipo === 'puerto' ? 'puerto' : 'concepto de tarifa'}`}
          peligro={esDesactivar}
          onCancelar={() => setConfirmacion(null)}
          onAceptar={ejecutarConfirmacion}
        >
          ¿Estás seguro de {esDesactivar ? 'desactivar' : 'reactivar'}{' '}
          <strong>{confirmacion.tipo === 'puerto' ? confirmacion.registro.name : confirmacion.registro.concept}</strong>?
          {esDesactivar && confirmacion.tipo === 'puerto' && ' Ya no aparecerá para elegir en pedidos ni barcos.'}
        </DialogoConfirmacion>
      )}
    </div>
  );
}
