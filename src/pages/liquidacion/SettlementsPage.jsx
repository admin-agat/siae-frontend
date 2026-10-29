// Liquidación al productor — cupos por liquidar y liquidados
// Ubicación: src/pages/liquidacion/SettlementsPage.jsx
// Ruta: /liquidacion
//
// Cada fila es un cupo de Comercial (productor + semana) con lo que dicen sus tarjas.
// "Liquidar" abre el cálculo (SettlementFormPage); "Ver" abre la liquidación con sus pagos.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Eye } from 'lucide-react';
import { getSettlementQuotas } from '../../api/settlements';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const formatoDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FILTROS = [
  { clave: 'POR_LIQUIDAR', etiqueta: 'POR LIQUIDAR', cumple: (c) => !c.settlement },
  { clave: 'LIQUIDADOS', etiqueta: 'LIQUIDADOS', cumple: (c) => Boolean(c.settlement) },
  { clave: 'TODOS', etiqueta: 'TODOS', cumple: () => true },
];

export default function SettlementsPage() {
  const navigate = useNavigate();
  const [cupos, setCupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('POR_LIQUIDAR');

  useEffect(() => {
    getSettlementQuotas()
      .then((res) => setCupos(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error('ERROR AL CARGAR CUPOS:', err);
        setCupos([]);
      })
      .finally(() => setCargando(false));
  }, []);

  const estado = (c) => {
    if (c.settlement) return c.settlement.pagado
      ? <span className="text-green-700 font-semibold">PAGADO</span>
      : <span className="text-primario font-semibold">LIQUIDADO · PAGO PENDIENTE</span>;
    if (c.a_pagar + c.rechazadas === 0) return <span className="text-gray-400 font-semibold">SIN TARJAS</span>;
    return <span className="text-amber-700 font-semibold">POR LIQUIDAR</span>;
  };

  const columnas = [
    { titulo: 'Semana', render: (c) => `${c.week} / ${c.year}` },
    { titulo: 'Productor', render: (c) => c.third_party?.name, className: 'font-medium' },
    { titulo: 'Comprado', render: (c) => formatoCajas(c.comprado) },
    { titulo: 'Embarcadas', render: (c) => formatoCajas(c.embarcadas) },
    { titulo: 'Caídas', render: (c) => formatoCajas(c.caidas) },
    { titulo: 'Rechazadas', render: (c) => <span className="text-red-600">{formatoCajas(c.rechazadas)}</span> },
    { titulo: 'A pagar', render: (c) => <strong className="text-green-700">{formatoCajas(c.a_pagar)}</strong> },
    { titulo: 'Neto', render: (c) => (c.settlement ? `$ ${formatoDinero(c.settlement.net_amount)}` : '—') },
    { titulo: 'Estado', render: estado },
    {
      titulo: 'Acciones',
      render: (c) => (c.settlement ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/liquidacion/${c.settlement.id}`); }}
          title={`Ver ${c.settlement.code}`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition"
        >
          <Eye size={14} /> Ver
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/liquidacion/cupo/${c.id}`); }}
          title="Calcular y liquidar"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm bg-guardar text-guardar-texto hover:bg-guardar-hover transition"
        >
          <Calculator size={14} /> Liquidar
        </button>
      )),
    },
  ];

  const cumple = FILTROS.find((f) => f.clave === filtro).cumple;

  return (
    <div className="p-6">
      <EncabezadoPagina
        titulo="Liquidación"
        subtitulo="Pago al productor por semana: fruta de las tarjas − materiales − anticipos"
      />

      <div className="flex gap-2 mb-3">
        {FILTROS.map((f) => (
          <button
            key={f.clave}
            type="button"
            onClick={() => setFiltro(f.clave)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${filtro === f.clave ? 'bg-primario text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {f.etiqueta} ({cupos.filter(f.cumple).length})
          </button>
        ))}
      </div>

      <TablaEstandar
        columnas={columnas}
        datos={cupos.filter(cumple)}
        cargando={cargando}
        nombreRegistros="cupos"
        mostrarPestanas={false}
        placeholderBusqueda="Buscar por productor o semana..."
        textosBusqueda={(c) => [c.third_party?.name, `${c.week}`, `${c.year}`, c.settlement?.code]}
      />
    </div>
  );
}
