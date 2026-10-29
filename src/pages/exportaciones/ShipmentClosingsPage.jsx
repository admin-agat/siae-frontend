// Cierre de embarque (Exportaciones) — listado de semanas
// Ubicación: src/pages/exportaciones/ShipmentClosingsPage.jsx
//
// 29/10/2026: después de la distribución en barcos (el plan), Logística registra por booking lo
// REALMENTE embarcado y sus documentos (DAE, B/L, AUCP...). El detalle está en ShipmentClosingPage.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { getCustomerOrders } from '../../api/customerOrders';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';

const formatoCajas = (v) => Number(v || 0).toLocaleString('es-EC');

export default function ShipmentClosingsPage() {
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
    { titulo: 'Pedido', render: (p) => formatoCajas(p.total_boxes) },
    { titulo: 'En barcos (plan)', render: (p) => formatoCajas(p.distributed_boxes) },
    { titulo: 'Embarcado', render: (p) => <span className="font-semibold text-primario">{formatoCajas(p.shipped_boxes)}</span> },
    {
      titulo: 'Embarcado − pedido',
      render: (p) => {
        if (!Number(p.shipped_boxes)) return <span className="text-gray-400">SIN CIERRE</span>;
        const dif = Number(p.shipped_boxes) - Number(p.total_boxes || 0);
        return <span className={`font-semibold ${dif < 0 ? 'text-amber-700' : 'text-green-700'}`}>{dif > 0 ? '+' : ''}{formatoCajas(dif)}</span>;
      },
    },
    {
      titulo: 'Acciones',
      render: (p) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/exportaciones/cierre/${p.id}`); }}
          title="Registrar lo embarcado por booking"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition"
        >
          <ClipboardCheck size={14} /> Cierre
        </button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <EncabezadoPagina
        titulo="Cierre de embarque"
        subtitulo="Lo realmente embarcado por booking, con DAE, B/L y la tarja del puerto"
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
