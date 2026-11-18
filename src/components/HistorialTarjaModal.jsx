// Historial de tarjas — src/components/HistorialTarjaModal.jsx
// 17/11/2026 (pedido de Peter): cada tarja muestra su historia de punta a punta: quién la creó, cada cambio
// (antes → después) con fecha y usuario, si se quitó y por qué, y cuándo se liquidó o se anuló la liquidación.
// Sin precios ni montos (lo ve también el TARJADOR del puerto). Solo lectura, por eso no usa ModalShell.
//   <HistorialTarjaModal tarjaId={12} onClose={...} />                → una tarja
//   <HistorialTarjaModal compraId={34} onClose={...} />               → todas las de una compra (también quitadas)
import { useState, useEffect } from 'react';
import { X, History } from 'lucide-react';
import { getTallyHistory, getPurchaseTallyHistory } from '../api/settlements';

const COLOR = {
  CREADA: 'bg-green-100 text-green-800',
  EDITADA: 'bg-primario-claro text-primario',
  QUITADA: 'bg-red-100 text-red-700',
  BORRADA: 'bg-red-100 text-red-700',
  'VUELTA A PONER': 'bg-amber-100 text-amber-800',
  LIQUIDADA: 'bg-gray-800 text-white',
  'LIQUIDACIÓN ANULADA': 'bg-amber-100 text-amber-800',
};

const fechaHora = (iso) => new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function HistorialTarjaModal({ tarjaId, compraId, onClose }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    (tarjaId ? getTallyHistory(tarjaId) : getPurchaseTallyHistory(compraId))
      .then((res) => vigente && setDatos(res.data))
      .catch((err) => vigente && setError(err.response?.data?.message || 'NO SE PUDO CARGAR EL HISTORIAL.'));
    return () => { vigente = false; };
  }, [tarjaId, compraId]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-3" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start gap-3 px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-primario flex items-center gap-2"><History size={20} /> Historial {tarjaId ? 'de la tarja' : 'de tarjas'}</h2>
            {datos?.compra && <p className="text-xs text-gray-500 mt-0.5">{datos.compra}</p>}
          </div>
          <button type="button" onClick={onClose} title="Cerrar" className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          {error && <p className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</p>}
          {!datos && !error && <p className="text-sm text-gray-400">Cargando historial...</p>}
          {datos && datos.eventos.length === 0 && <p className="text-sm text-gray-400">Todavía no hay movimientos.</p>}
          {datos && datos.eventos.length > 0 && (
            <ol className="relative border-l-2 border-gray-200 ml-2 space-y-4">
              {datos.eventos.map((e, i) => (
                <li key={i} className="ml-4">
                  <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-primario" />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${COLOR[e.tipo] || 'bg-gray-100 text-gray-700'}`}>{e.tipo}</span>
                    {e.tarja && <span className="font-semibold text-gray-700">Tarja {e.tarja}</span>}
                    <span className="text-gray-500">{fechaHora(e.fecha)} · {e.usuario}</span>
                  </div>
                  {e.detalle.length > 0 && (
                    <ul className="mt-1 text-xs text-gray-600 space-y-0.5">
                      {e.detalle.map((d, j) => (
                        <li key={j}>
                          <span className="font-semibold">{d.campo}:</span>{' '}
                          {'valor' in d ? d.valor : <><span className="line-through text-gray-400">{d.antes}</span> → <span className="font-semibold text-gray-800">{d.despues}</span></>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
