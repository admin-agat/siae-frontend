// Compra de fruta (Comercial) — listado de semanas
// Ubicación: src/pages/comercial/PurchasesPage.jsx
//
// Fase 3 del flujo: Pedido semanal → Distribución en barcos → COMERCIAL COMPRA LA FRUTA.
// Cada pedido activo con: total, cuánto ya embarcó Logística y cuánto compró Comercial.
// La compra se hace en PurchaseAllocationPage (botón "Comprar").
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBasket } from 'lucide-react';
import { getCustomerOrders } from '../../api/customerOrders';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');

export default function PurchasesPage() {
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
    { titulo: 'Total cajas', render: (p) => formatoCajas(p.total_boxes) },
    {
      titulo: 'En barcos (Logística)',
      render: (p) => {
        const completo = Number(p.distributed_boxes) >= Number(p.total_boxes);
        return <span className={completo ? 'text-green-700' : 'text-amber-700'}>{formatoCajas(p.distributed_boxes)}</span>;
      },
    },
    { titulo: 'Comprado', render: (p) => formatoCajas(p.purchased_boxes), className: 'font-semibold' },
    {
      titulo: 'Por comprar',
      render: (p) => {
        const falta = Number(p.total_boxes || 0) - Number(p.purchased_boxes || 0);
        return (
          <span className={`font-semibold ${falta === 0 ? 'text-green-700' : 'text-amber-700'}`}>
            {falta === 0 ? 'COMPLETO' : formatoCajas(falta)}
          </span>
        );
      },
    },
    {
      titulo: 'Acciones',
      render: (p) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/comercial/compras/${p.id}`); }}
          title="Comprar fruta para esta semana"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition"
        >
          <ShoppingBasket size={14} /> Comprar
        </button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <EncabezadoPagina
        titulo="Compra de fruta"
        subtitulo="Comercial reparte el total de cajas de la semana entre productores y comercializadoras"
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
