// Tarjas (Liquidación) — listado de semanas
// Ubicación: src/pages/liquidacion/TalliesPage.jsx
//
// La tarja es lo que llega a puerto por camión: EMBARCADAS + CAÍDAS se pagan al productor,
// RECHAZADAS no. Cada semana con compras de Comercial se abre en TallySheetPage ("Tarjas").
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { getCustomerOrders } from '../../api/customerOrders';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');

export default function TalliesPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getCustomerOrders({ status: true })
      .then((res) => setPedidos(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error('ERROR AL CARGAR PEDIDOS:', err);
        setPedidos([]);
      })
      .finally(() => setCargando(false));
  }, []);

  const columnas = [
    { titulo: 'Semana', render: (p) => `SEMANA ${p.week} / ${p.year}`, className: 'font-medium' },
    { titulo: 'Total pedido', render: (p) => formatoCajas(p.total_boxes) },
    { titulo: 'Comprado (Comercial)', render: (p) => formatoCajas(p.purchased_boxes), className: 'font-semibold' },
    {
      titulo: 'Acciones',
      render: (p) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/liquidacion/tarjas/${p.id}`); }}
          disabled={!Number(p.purchased_boxes)}
          title={Number(p.purchased_boxes) ? 'Registrar las tarjas de esta semana' : 'Comercial aún no compra fruta para esta semana'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover disabled:opacity-40 transition"
        >
          <ClipboardCheck size={14} /> Tarjas
        </button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <EncabezadoPagina
        titulo="Tarjas"
        subtitulo="Cajas recibidas en puerto por camión: embarcadas y caídas se pagan, rechazadas no"
      />

      <TablaEstandar
        columnas={columnas}
        datos={pedidos}
        cargando={cargando}
        nombreRegistros="semanas"
        mostrarPestanas={false}
        placeholderBusqueda="Buscar por semana o año..."
        textosBusqueda={(p) => [`SEMANA ${p.week}`, p.week, p.year]}
      />
    </div>
  );
}
