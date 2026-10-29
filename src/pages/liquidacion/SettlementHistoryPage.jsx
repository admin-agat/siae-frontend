// Pagos de liquidaciones e historial
// Ubicación: src/pages/liquidacion/SettlementHistoryPage.jsx
// Ruta: /liquidacion/pagos
//
// Todas las liquidaciones con el estado de sus pagos (1er pago 100 % / 80 % y 2do pago 20 %).
// "PENDIENTES DE PAGO" es la bandeja de tesorería: lo que falta pagar a cada productor.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { getSettlements } from '../../api/settlements';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';

const formatoDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatoFecha = (f) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—');

const pendienteDe = (l) => l.payments.filter((p) => !p.paid_at).reduce((s, p) => s + Number(p.amount), 0);

const FILTROS = [
  { clave: 'PENDIENTES', etiqueta: 'PENDIENTES DE PAGO', cumple: (l) => l.status && pendienteDe(l) > 0 },
  { clave: 'PAGADAS', etiqueta: 'PAGADAS', cumple: (l) => l.status && pendienteDe(l) === 0 },
  { clave: 'ANULADAS', etiqueta: 'ANULADAS', cumple: (l) => !l.status },
  { clave: 'TODAS', etiqueta: 'TODAS', cumple: () => true },
];

export default function SettlementHistoryPage() {
  const navigate = useNavigate();
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('PENDIENTES');

  useEffect(() => {
    getSettlements()
      .then((res) => setLiquidaciones(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error('ERROR AL CARGAR LIQUIDACIONES:', err);
        setLiquidaciones([]);
      })
      .finally(() => setCargando(false));
  }, []);

  const columnas = [
    { titulo: 'Código', render: (l) => <span className="font-mono text-xs">{l.code}</span> },
    { titulo: 'Fecha', render: (l) => formatoFecha(l.date) },
    { titulo: 'Productor', render: (l) => l.third_party?.name, className: 'font-medium' },
    { titulo: 'Semana', render: (l) => `${l.week} / ${l.year}` },
    { titulo: 'Neto', render: (l) => <strong>$ {formatoDinero(l.net_amount)}</strong> },
    {
      titulo: 'Pagos',
      render: (l) => (
        <div className="flex flex-col gap-0.5 text-xs">
          {l.payments.map((p) => (
            <span key={p.id} className={p.paid_at ? 'text-green-700' : 'text-amber-700 font-semibold'}>
              {p.installment === 2 ? '20 %' : p.description.includes('ÚNICO') ? 'Único' : '1er pago'}: $ {formatoDinero(p.amount)} — {p.paid_at ? `PAGADO ${formatoFecha(p.paid_at)}` : 'PENDIENTE'}
            </span>
          ))}
        </div>
      ),
    },
    {
      titulo: 'Por pagar',
      render: (l) => (!l.status
        ? <span className="text-red-600 font-semibold">ANULADA</span>
        : pendienteDe(l) > 0 ? <span className="text-amber-700 font-semibold">$ {formatoDinero(pendienteDe(l))}</span>
          : <span className="text-green-700 font-semibold">PAGADA</span>),
    },
    {
      titulo: 'Acciones',
      render: (l) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/liquidacion/${l.id}`); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition"
        >
          <Eye size={14} /> Ver
        </button>
      ),
    },
  ];

  const cumple = FILTROS.find((f) => f.clave === filtro).cumple;
  const totalPendiente = liquidaciones.filter((l) => l.status).reduce((s, l) => s + pendienteDe(l), 0);

  return (
    <div className="p-6">
      <EncabezadoPagina
        titulo="Pagos de liquidaciones"
        subtitulo="Lo que falta pagar a cada productor (80 % / 20 % / 100 %) e historial"
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {FILTROS.map((f) => (
          <button
            key={f.clave}
            type="button"
            onClick={() => setFiltro(f.clave)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${filtro === f.clave ? 'bg-primario text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {f.etiqueta} ({liquidaciones.filter(f.cumple).length})
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-600">Total por pagar: <strong className="text-amber-700">$ {formatoDinero(totalPendiente)}</strong></span>
      </div>

      <TablaEstandar
        columnas={columnas}
        datos={liquidaciones.filter(cumple)}
        cargando={cargando}
        nombreRegistros="liquidaciones"
        mostrarPestanas={false}
        placeholderBusqueda="Buscar por código, productor o semana..."
        textosBusqueda={(l) => [l.code, l.third_party?.name, `${l.week}`, `${l.year}`]}
      />
    </div>
  );
}
