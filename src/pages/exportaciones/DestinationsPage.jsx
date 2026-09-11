import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Ban, RotateCcw, MapPin } from 'lucide-react';
import DestinationModal from '../../components/DestinationModal';
import { getDestinations, deactivateDestination, reactivateDestination } from '../../api/destinations';

const TABS = ['Activos', 'Inactivos', 'Todos'];
const PAGE_SIZE = 10;

export default function DestinationsPage() {
  const [destinos, setDestinos] = useState([]);
  const [tab, setTab] = useState('Activos');
  const [pagina, setPagina] = useState(1);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  const cargar = useCallback(async () => {
    const params = {};
    if (tab !== 'Todos') params.status = tab === 'Activos';
    const res = await getDestinations(params);
    setDestinos(res.data);
  }, [tab]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [tab]);

  const destinosPagina = destinos.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  const handleConfirmarAccion = async () => {
    const { destino, accion } = confirmacion;
    try {
      if (accion === 'desactivar') {
        await deactivateDestination(destino.id);
      } else {
        await reactivateDestination(destino.id);
      }
      await cargar();
    } catch (err) {
      console.error('ERROR AL CAMBIAR ESTADO DEL DESTINO:', err);
    } finally {
      setConfirmacion(null);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <MapPin size={22} /> Destinos
        </h1>
        <button
          onClick={() => { setEditando(null); setModalAbierto(true); }}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center gap-1"
        >
          <Plus size={18} /> Nuevo Destino
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-lg text-sm ${tab === t ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <table className="w-full text-sm bg-white rounded-lg overflow-hidden shadow">
        <thead className="bg-white border-b">
          <tr className="text-left text-gray-700">
            <th className="p-3 font-semibold">Nombre</th>
            <th className="p-3 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {destinosPagina.map((destino) => (
            <tr key={destino.id} className="border-t hover:bg-gray-50">
              <td className="p-3">{destino.name}</td>
              <td className="p-3">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => { setEditando(destino); setModalAbierto(true); }}
                    className="bg-blue-600 text-white p-1 rounded-lg"
                  >
                    <Pencil size={14} />
                  </button>
                  {destino.status ? (
                    <button onClick={() => setConfirmacion({ destino, accion: 'desactivar' })} className="bg-red-600 text-white p-1 rounded-lg">
                      <Ban size={14} />
                    </button>
                  ) : (
                    <button onClick={() => setConfirmacion({ destino, accion: 'reactivar' })} className="bg-green-600 text-white p-1 rounded-lg">
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {destinosPagina.length === 0 && (
            <tr>
              <td colSpan={2} className="p-4 text-center text-gray-400">Sin destinos en esta vista.</td>
            </tr>
          )}
        </tbody>
      </table>

      {destinos.length > PAGE_SIZE && (
        <div className="flex justify-center gap-2 mt-3">
          <button disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)} className="text-sm disabled:opacity-30">‹</button>
          <span className="text-sm">{pagina}</span>
          <button disabled={pagina * PAGE_SIZE >= destinos.length} onClick={() => setPagina((p) => p + 1)} className="text-sm disabled:opacity-30">›</button>
        </div>
      )}

      {modalAbierto && (
        <DestinationModal
          destino={editando}
          onClose={() => setModalAbierto(false)}
          onGuardado={cargar}
        />
      )}

      {confirmacion && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm px-6 py-6">
            <h3 className="text-base font-bold text-gray-800 mb-2">
              ¿{confirmacion.accion === 'desactivar' ? 'Desactivar' : 'Reactivar'} destino?
            </h3>
            <p className="text-sm text-gray-500 mb-6">{confirmacion.destino.name}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmacion(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 rounded-lg transition">
                Cancelar
              </button>
              <button onClick={handleConfirmarAccion} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}