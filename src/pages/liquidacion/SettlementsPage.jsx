// Liquidación al productor — cupos por liquidar y liquidados
// Ubicación: src/pages/liquidacion/SettlementsPage.jsx
// Ruta: /liquidacion
//
// Cada fila es un cupo de Comercial (productor + semana) con lo que dicen sus tarjas.
// "Liquidar" abre el cálculo (SettlementFormPage); "Ver" abre la liquidación con sus pagos.
// 17/11/2026 (fase 0): un cupo puede tener varias LQ (una por contrato y una de SPOT): se ve un botón por LQ.
// Lo que se paga son las RECIBIDAS (embarcadas − caídas − rechazadas − faltantes).
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Eye } from 'lucide-react';
import { getSettlementQuotas } from '../../api/settlements';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const formatoDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FILTROS = [
  { clave: 'POR_LIQUIDAR', etiqueta: 'POR LIQUIDAR', cumple: (c) => !c.settlements?.length },
  { clave: 'LIQUIDADOS', etiqueta: 'LIQUIDADOS', cumple: (c) => c.settlements?.length > 0 },
  { clave: 'TODOS', etiqueta: 'TODOS', cumple: () => true },
];

export default function SettlementsPage() {
  const navigate = useNavigate();
  const [cupos, setCupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('POR_LIQUIDAR');
  // 16/11/2026 (rendimiento R6): por defecto las últimas 8 semanas + todo lo que falta liquidar; lo más viejo, a pedido
  const [anteriores, setAnteriores] = useState(false);

  useEffect(() => {
    setCargando(true);
    getSettlementQuotas(anteriores ? {} : { recientes: 1 })
      .then((res) => setCupos(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error('ERROR AL CARGAR CUPOS:', err);
        setCupos([]);
      })
      .finally(() => setCargando(false));
  }, [anteriores]);

  const estado = (c) => {
    if (c.settlements?.length) return c.settlements.every((l) => l.pagado)
      ? <span className="text-green-700 font-semibold">PAGADO</span>
      : <span className="text-primario font-semibold">LIQUIDADO · PAGO PENDIENTE</span>;
    if (c.embarcadas === 0) return <span className="text-gray-400 font-semibold">SIN TARJAS</span>;
    return <span className="text-amber-700 font-semibold">POR LIQUIDAR</span>;
  };

  const columnas = [
    { titulo: 'Semana', render: (c) => `${c.week} / ${c.year}` },
    { titulo: 'Productor', render: (c) => c.third_party?.name, className: 'font-medium' },
    { titulo: 'Comprado', render: (c) => formatoCajas(c.comprado) },
    { titulo: 'Embarcadas', render: (c) => formatoCajas(c.embarcadas) },
    { titulo: 'Caídas', render: (c) => formatoCajas(c.caidas) },
    { titulo: 'Rechazadas', render: (c) => <span className="text-red-600">{formatoCajas(c.rechazadas)}</span> },
    { titulo: 'Faltantes', render: (c) => formatoCajas(c.faltantes) },
    { titulo: 'Recibidas', render: (c) => <strong className="text-green-700">{formatoCajas(c.recibidas)}</strong> },
    { titulo: 'Neto', render: (c) => (c.settlements?.length ? `$ ${formatoDinero(c.settlements.reduce((s, l) => s + Number(l.net_amount), 0))}` : '—') },
    { titulo: 'Estado', render: estado },
    {
      titulo: 'Acciones',
      render: (c) => (c.settlements?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {c.settlements.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/liquidacion/${l.id}`); }}
              title={`Ver ${l.code}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition whitespace-nowrap"
            >
              <Eye size={14} /> {l.group_label || 'Ver'}
            </button>
          ))}
        </div>
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
        subtitulo="Pago al productor por semana: fruta recibida (tarjas) − retención − materiales − anticipos. Una LQ por contrato y una de SPOT"
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
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
        <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer"
          title="Por defecto se ven las últimas 8 semanas y todo lo que falta liquidar">
          <input type="checkbox" checked={anteriores} onChange={(e) => setAnteriores(e.target.checked)} className="accent-primario" />
          VER SEMANAS ANTERIORES YA LIQUIDADAS
        </label>
      </div>

      <TablaEstandar
        columnas={columnas}
        datos={cupos.filter(cumple)}
        cargando={cargando}
        nombreRegistros="cupos"
        mostrarPestanas={false}
        placeholderBusqueda="Buscar por productor o semana..."
        textosBusqueda={(c) => [c.third_party?.name, `${c.week}`, `${c.year}`, ...(c.settlements || []).map((l) => l.code)]}
      />
    </div>
  );
}
