// Notas de crédito de productores y comercializadoras
// Ubicación: src/pages/liquidacion/CreditNotesPage.jsx
// Ruta: /liquidacion/notas-credito
//
// 30/10/2026: el vendedor factura al precio oficial MAG y devuelve la diferencia con el precio real en
// una NOTA DE CRÉDITO (cajas pagadas × (oficial − real)). "POR RECIBIR" es la bandeja de control: las
// liquidaciones activas con NC sin número registrado, con el total que debe cada vendedor.
// El número se registra en el detalle de la liquidación (no bloquea los pagos).
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { getSettlements } from '../../api/settlements';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';

const formatoDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatoFecha = (f) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—');

const conNota = (l) => l.status && Number(l.credit_note_amount) > 0;
const FILTROS = [
  { clave: 'PENDIENTES', etiqueta: 'POR RECIBIR', cumple: (l) => conNota(l) && !l.credit_note_number },
  { clave: 'RECIBIDAS', etiqueta: 'RECIBIDAS', cumple: (l) => conNota(l) && Boolean(l.credit_note_number) },
  { clave: 'TODAS', etiqueta: 'TODAS', cumple: conNota },
];

export default function CreditNotesPage() {
  const navigate = useNavigate();
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('PENDIENTES');

  useEffect(() => {
    getSettlements({ status: 1 })
      .then((res) => setLiquidaciones(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error('ERROR AL CARGAR NOTAS DE CRÉDITO:', err);
        setLiquidaciones([]);
      })
      .finally(() => setCargando(false));
  }, []);

  const pendientes = liquidaciones.filter(FILTROS[0].cumple);
  const totalPendiente = pendientes.reduce((s, l) => s + Number(l.credit_note_amount), 0);
  // Lo que debe cada vendedor (de mayor a menor)
  const porVendedor = Object.values(pendientes.reduce((acc, l) => {
    const clave = l.third_party?.id ?? l.third_party_id;
    acc[clave] = acc[clave] || { nombre: l.third_party?.name, total: 0, cantidad: 0 };
    acc[clave].total += Number(l.credit_note_amount);
    acc[clave].cantidad += 1;
    return acc;
  }, {})).sort((a, b) => b.total - a.total);

  const columnas = [
    { titulo: 'Liquidación', render: (l) => <span className="font-mono text-xs">{l.code}</span> },
    { titulo: 'Fecha', render: (l) => formatoFecha(l.date) },
    { titulo: 'Vendedor', render: (l) => l.third_party?.name, className: 'font-medium' },
    { titulo: 'Semana', render: (l) => `${l.week} / ${l.year}` },
    { titulo: 'Factura (oficial)', render: (l) => `$ ${formatoDinero(l.invoice_amount)}` },
    { titulo: 'Nota de crédito', render: (l) => <strong>$ {formatoDinero(l.credit_note_amount)}</strong> },
    { titulo: 'N° factura', render: (l) => l.invoice_number || <span className="text-gray-400">—</span> },
    {
      titulo: 'N° nota de crédito',
      render: (l) => (l.credit_note_number
        ? <span className="text-green-700 font-semibold">{l.credit_note_number} <span className="font-normal text-gray-500">({formatoFecha(l.credit_note_date)})</span></span>
        : <span className="text-amber-700 font-semibold">POR RECIBIR</span>),
    },
    {
      titulo: 'Acciones',
      render: (l) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/liquidacion/${l.id}`); }}
          title="Registrar el N° de factura y de nota de crédito"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition"
        >
          <Eye size={14} /> {l.credit_note_number ? 'Ver' : 'Registrar'}
        </button>
      ),
    },
  ];

  const cumple = FILTROS.find((f) => f.clave === filtro).cumple;

  return (
    <div className="p-6">
      <EncabezadoPagina
        titulo="Notas de crédito"
        subtitulo="Diferencia entre el precio oficial MAG y el precio real que debe devolver cada vendedor"
      />

      {porVendedor.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <p className="text-sm text-gray-700 mb-2">
            Por recibir: <strong className="text-amber-700">$ {formatoDinero(totalPendiente)}</strong> en {pendientes.length} liquidaciones
          </p>
          <div className="flex flex-wrap gap-2">
            {porVendedor.map((v) => (
              <span key={v.nombre} className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-1.5">
                {v.nombre}: <strong>$ {formatoDinero(v.total)}</strong> ({v.cantidad})
              </span>
            ))}
          </div>
        </div>
      )}

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
      </div>

      <TablaEstandar
        columnas={columnas}
        datos={liquidaciones.filter(cumple)}
        cargando={cargando}
        nombreRegistros="notas de crédito"
        mostrarPestanas={false}
        placeholderBusqueda="Buscar por liquidación, vendedor, semana o N°..."
        textosBusqueda={(l) => [l.code, l.third_party?.name, `${l.week}`, `${l.year}`, l.invoice_number, l.credit_note_number]}
      />
    </div>
  );
}
