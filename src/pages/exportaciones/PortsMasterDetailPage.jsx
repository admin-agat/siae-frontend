import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Ban, RotateCcw, Anchor, DollarSign } from 'lucide-react';
import PortModal from '../../components/PortModal';
import PortTariffItemModal from '../../components/PortTariffItemModal';
import { getPorts, deactivatePort, reactivatePort } from '../../api/ports';
import { getPortTariffItems, deactivatePortTariffItem, reactivatePortTariffItem } from '../../api/portTariffItems';

const TABS = ['Activos', 'Inactivos', 'Todos'];
const PAGE_SIZE = 10;

export default function PortsMasterDetailPage() {
  // --- Puertos (izquierda) ---
  const [puertos, setPuertos] = useState([]);
  const [tabPuertos, setTabPuertos] = useState('Activos');
  const [paginaPuertos, setPaginaPuertos] = useState(1);
  const [puertoSeleccionado, setPuertoSeleccionado] = useState(null);
  const [modalPuertoAbierto, setModalPuertoAbierto] = useState(false);
  const [puertoEditando, setPuertoEditando] = useState(null);
  const [confirmacionPuerto, setConfirmacionPuerto] = useState(null); // { puerto, accion }

  // --- Conceptos de tarifa (derecha) ---
  const [items, setItems] = useState([]);
  const [tabItems, setTabItems] = useState('Activos');
  const [paginaItems, setPaginaItems] = useState(1);
  const [modalItemAbierto, setModalItemAbierto] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [confirmacionItem, setConfirmacionItem] = useState(null);

  const cargarPuertos = useCallback(async () => {
    const params = {};
    if (tabPuertos !== 'Todos') params.status = tabPuertos === 'Activos';
    const res = await getPorts(params);
    setPuertos(res.data);
  }, [tabPuertos]);

  const cargarItems = useCallback(async () => {
    if (!puertoSeleccionado) {
      setItems([]);
      return;
    }
    const params = { port_id: puertoSeleccionado.id };
    if (tabItems !== 'Todos') params.status = tabItems === 'Activos';
    const res = await getPortTariffItems(params);
    setItems(res.data);
  }, [puertoSeleccionado, tabItems]);

  useEffect(() => { cargarPuertos(); }, [cargarPuertos]);
  useEffect(() => { cargarItems(); }, [cargarItems]);
  useEffect(() => { setPaginaPuertos(1); }, [tabPuertos]);
  useEffect(() => { setPaginaItems(1); }, [tabItems, puertoSeleccionado]);

  const puertosPagina = puertos.slice((paginaPuertos - 1) * PAGE_SIZE, paginaPuertos * PAGE_SIZE);
  const itemsPagina = items.slice((paginaItems - 1) * PAGE_SIZE, paginaItems * PAGE_SIZE);

  const handleConfirmarAccionPuerto = async () => {
    const { puerto, accion } = confirmacionPuerto;
    try {
      if (accion === 'desactivar') {
        await deactivatePort(puerto.id);
      } else {
        await reactivatePort(puerto.id);
      }
      await cargarPuertos();
    } catch (err) {
      console.error('ERROR AL CAMBIAR ESTADO DEL PUERTO:', err);
    } finally {
      setConfirmacionPuerto(null);
    }
  };

  const handleConfirmarAccionItem = async () => {
    const { item, accion } = confirmacionItem;
    try {
      if (accion === 'desactivar') {
        await deactivatePortTariffItem(item.id);
      } else {
        await reactivatePortTariffItem(item.id);
      }
      await cargarItems();
    } catch (err) {
      console.error('ERROR AL CAMBIAR ESTADO DEL CONCEPTO DE TARIFA:', err);
    } finally {
      setConfirmacionItem(null);
    }
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Panel izquierdo: Puertos (slate) */}
      <div className="w-1/3 bg-slate-800 text-white rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Anchor size={20} /> Puertos
          </h2>
          <button
            onClick={() => { setPuertoEditando(null); setModalPuertoAbierto(true); }}
            className="bg-green-600 hover:bg-green-700 p-1.5 rounded-lg"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setTabPuertos(tab)}
              className={`px-3 py-1 rounded-lg text-sm ${tabPuertos === tab ? 'bg-slate-600' : 'bg-slate-700 text-slate-300'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {puertosPagina.map((puerto) => (
            <div
              key={puerto.id}
              onClick={() => setPuertoSeleccionado(puerto)}
              className={`p-3 rounded-lg cursor-pointer flex items-center justify-between ${puertoSeleccionado?.id === puerto.id ? 'bg-blue-700' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
              <div>
                <p className="font-semibold">{puerto.name}</p>
                <p className="text-xs text-slate-300">{puerto.code} {puerto.city ? `— ${puerto.city}` : ''}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setPuertoEditando(puerto); setModalPuertoAbierto(true); }}
                  className="bg-blue-600 text-white p-1 rounded-lg"
                >
                  <Pencil size={14} />
                </button>
                {puerto.status ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmacionPuerto({ puerto, accion: 'desactivar' }); }}
                    className="bg-red-600 text-white p-1 rounded-lg"
                  >
                    <Ban size={14} />
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmacionPuerto({ puerto, accion: 'reactivar' }); }}
                    className="bg-green-600 text-white p-1 rounded-lg"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {puertosPagina.length === 0 && (
            <p className="text-slate-400 text-sm text-center mt-4">Sin puertos en esta vista.</p>
          )}
        </div>

        {puertos.length > PAGE_SIZE && (
          <div className="flex justify-center gap-2 mt-3">
            <button disabled={paginaPuertos === 1} onClick={() => setPaginaPuertos((p) => p - 1)} className="text-sm disabled:opacity-30">‹</button>
            <span className="text-sm">{paginaPuertos}</span>
            <button disabled={paginaPuertos * PAGE_SIZE >= puertos.length} onClick={() => setPaginaPuertos((p) => p + 1)} className="text-sm disabled:opacity-30">›</button>
          </div>
        )}
      </div>

      {/* Panel derecho: Conceptos de tarifa (azul) */}
      <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col">
        {!puertoSeleccionado ? (
          <div className="flex-1 flex items-center justify-center text-blue-400">
            Selecciona un puerto para ver sus conceptos de tarifa.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                <DollarSign size={20} /> Tarifas — {puertoSeleccionado.name}
              </h2>
              <button
                onClick={() => { setItemEditando(null); setModalItemAbierto(true); }}
                className="bg-green-600 hover:bg-green-700 text-white p-1.5 rounded-lg"
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="flex gap-2 mb-3">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTabItems(tab)}
                  className={`px-3 py-1 rounded-lg text-sm ${tabItems === tab ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <table className="w-full text-sm bg-white rounded-lg overflow-hidden">
              <thead className="bg-white border-b">
                <tr className="text-left text-blue-900">
                  <th className="p-2 font-semibold">Concepto</th>
                  <th className="p-2 font-semibold">Monto</th>
                  <th className="p-2 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {itemsPagina.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-blue-50">
                    <td className="p-2">{item.concept}</td>
                    <td className="p-2">${Number(item.amount).toFixed(2)}</td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => { setItemEditando(item); setModalItemAbierto(true); }}
                          className="bg-blue-600 text-white p-1 rounded-lg"
                        >
                          <Pencil size={14} />
                        </button>
                        {item.status ? (
                          <button onClick={() => setConfirmacionItem({ item, accion: 'desactivar' })} className="bg-red-600 text-white p-1 rounded-lg">
                            <Ban size={14} />
                          </button>
                        ) : (
                          <button onClick={() => setConfirmacionItem({ item, accion: 'reactivar' })} className="bg-green-600 text-white p-1 rounded-lg">
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {itemsPagina.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-gray-400">Sin conceptos de tarifa en esta vista.</td>
                  </tr>
                )}
              </tbody>
            </table>

            {items.length > PAGE_SIZE && (
              <div className="flex justify-center gap-2 mt-3">
                <button disabled={paginaItems === 1} onClick={() => setPaginaItems((p) => p - 1)} className="text-sm disabled:opacity-30">‹</button>
                <span className="text-sm">{paginaItems}</span>
                <button disabled={paginaItems * PAGE_SIZE >= items.length} onClick={() => setPaginaItems((p) => p + 1)} className="text-sm disabled:opacity-30">›</button>
              </div>
            )}
          </>
        )}
      </div>

      {modalPuertoAbierto && (
        <PortModal
          puerto={puertoEditando}
          onClose={() => setModalPuertoAbierto(false)}
          onGuardado={cargarPuertos}
        />
      )}

      {modalItemAbierto && (
        <PortTariffItemModal
          item={itemEditando}
          portId={puertoSeleccionado?.id}
          onClose={() => setModalItemAbierto(false)}
          onGuardado={cargarItems}
        />
      )}

      {confirmacionPuerto && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm px-6 py-6">
            <h3 className="text-base font-bold text-gray-800 mb-2">
              ¿{confirmacionPuerto.accion === 'desactivar' ? 'Desactivar' : 'Reactivar'} puerto?
            </h3>
            <p className="text-sm text-gray-500 mb-6">{confirmacionPuerto.puerto.name}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmacionPuerto(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 rounded-lg transition">
                Cancelar
              </button>
              <button onClick={handleConfirmarAccionPuerto} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmacionItem && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm px-6 py-6">
            <h3 className="text-base font-bold text-gray-800 mb-2">
              ¿{confirmacionItem.accion === 'desactivar' ? 'Desactivar' : 'Reactivar'} concepto de tarifa?
            </h3>
            <p className="text-sm text-gray-500 mb-6">{confirmacionItem.item.concept}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmacionItem(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 rounded-lg transition">
                Cancelar
              </button>
              <button onClick={handleConfirmarAccionItem} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}