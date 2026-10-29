// Distribución en barcos (Logística) — listado de semanas
// Ubicación: src/pages/exportaciones/OrderDistributionsPage.jsx
//
// Fase 2 del flujo: Pedido semanal → DISTRIBUCIÓN EN BARCOS → Comercial compra la fruta.
// Muestra cada pedido activo con cuántas cajas ya están en barcos y cuántas faltan.
// El reparto se hace en OrderDistributionPage (botón "Distribuir").
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ship } from 'lucide-react';
import { getCustomerOrders } from '../../api/customerOrders';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');

export default function OrderDistributionsPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Solo pedidos activos: un pedido anulado no se distribuye
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
    { titulo: 'Total cajas', render: (p) => formatoCajas(p.total_boxes) },
    { titulo: 'En barcos', render: (p) => formatoCajas(p.distributed_boxes) },
    {
      titulo: 'Pendiente',
      render: (p) => {
        const pendiente = Number(p.total_boxes || 0) - Number(p.distributed_boxes || 0);
        return (
          <span className={`font-semibold ${pendiente === 0 ? 'text-green-700' : 'text-amber-700'}`}>
            {pendiente === 0 ? 'COMPLETO' : formatoCajas(pendiente)}
          </span>
        );
      },
    },
    {
      titulo: 'Avance',
      render: (p) => {
        const total = Number(p.total_boxes || 0);
        const avance = total ? Math.min(100, (Number(p.distributed_boxes || 0) / total) * 100) : 0;
        return (
          <div className="flex items-center gap-2 min-w-[140px]">
            <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${avance >= 100 ? 'bg-green-600' : 'bg-amber-500'}`} style={{ width: `${avance}%` }} />
            </div>
            <span className="text-xs text-gray-500 w-10 text-right">{Math.round(avance)}%</span>
          </div>
        );
      },
    },
    {
      titulo: 'Acciones',
      render: (p) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/exportaciones/embarques/${p.id}`); }}
          title="Distribuir en barcos"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition"
        >
          <Ship size={14} /> Distribuir
        </button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <EncabezadoPagina
        titulo="Distribución en barcos"
        subtitulo="Logística reparte cada pedido semanal en los barcos de la semana"
      />

      <TablaEstandar
        columnas={columnas}
        datos={pedidos}
        cargando={cargando}
        nombreRegistros="pedidos"
        mostrarPestanas={false}
        placeholderBusqueda="Buscar por semana o año..."
        textosBusqueda={(p) => [`SEMANA ${p.week}`, p.week, p.year]}
      />
    </div>
  );
}
