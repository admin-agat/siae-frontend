import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Ban, RotateCcw, Users } from 'lucide-react';
import CustomerModal from '../../components/CustomerModal';
import { getCustomers, deactivateCustomer, reactivateCustomer } from '../../api/customers';

const TABS = ['Activos', 'Inactivos', 'Todos'];
const PAGE_SIZE = 10;

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [tab, setTab] = useState('Activos');
  const [pagina, setPagina] = useState(1);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  const cargar = useCallback(async () => {
    const params = {};
    if (tab !== 'Todos') params.status = tab === 'Activos';
    const res = await getCustomers(params);
    setCustomers(res.data);
  }, [tab]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [tab]);

  const customersPagina = customers.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  const handleConfirmarAccion = async () => {
    const { customer, accion } = confirmacion;
    try {
      if (accion === 'desactivar') {
        await deactivateCustomer(customer.id);
      } else {
        await reactivateCustomer(customer.id);
      }
      await cargar();
    } catch (err) {
      console.error('ERROR AL CAMBIAR ESTADO DEL CLIENTE:', err);
    } finally {
      setConfirmacion(null);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <Users size={22} /> Clientes
        </h1>
        <button
          onClick={() => { setEditando(null); setModalAbierto(true); }}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center gap-1"
        >
          <Plus size={18} /> Nuevo Cliente
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
            <th className="p-3 font-semibold">Código</th>
            <th className="p-3 font-semibold">Tercero</th>
            <th className="p-3 font-semibold">País</th>
            <th className="p-3 font-semibold">Contacto</th>
            <th className="p-3 font-semibold">Tipo negociación</th>
            <th className="p-3 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {customersPagina.map((customer) => (
            <tr key={customer.id} className="border-t hover:bg-gray-50">
              <td className="p-3 font-mono text-xs">{customer.customer_code}</td>
              <td className="p-3">{customer.thirdParty?.name}</td>
              <td className="p-3">{customer.country}</td>
              <td className="p-3">{customer.contact_name}</td>
              <td className="p-3">{customer.negotiation_type}</td>
              <td className="p-3">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => { setEditando(customer); setModalAbierto(true); }}
                    className="bg-blue-600 text-white p-1 rounded-lg"
                  >
                    <Pencil size={14} />
                  </button>
                  {customer.status ? (
                    <button onClick={() => setConfirmacion({ customer, accion: 'desactivar' })} className="bg-red-600 text-white p-1 rounded-lg">
                      <Ban size={14} />
                    </button>
                  ) : (
                    <button onClick={() => setConfirmacion({ customer, accion: 'reactivar' })} className="bg-green-600 text-white p-1 rounded-lg">
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {customersPagina.length === 0 && (
            <tr>
              <td colSpan={6} className="p-4 text-center text-gray-400">Sin clientes en esta vista.</td>
            </tr>
          )}
        </tbody>
      </table>

      {customers.length > PAGE_SIZE && (
        <div className="flex justify-center gap-2 mt-3">
          <button disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)} className="text-sm disabled:opacity-30">‹</button>
          <span className="text-sm">{pagina}</span>
          <button disabled={pagina * PAGE_SIZE >= customers.length} onClick={() => setPagina((p) => p + 1)} className="text-sm disabled:opacity-30">›</button>
        </div>
      )}

      {modalAbierto && (
        <CustomerModal
          customer={editando}
          onClose={() => setModalAbierto(false)}
          onGuardado={cargar}
        />
      )}

      {confirmacion && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm px-6 py-6">
            <h3 className="text-base font-bold text-gray-800 mb-2">
              ¿{confirmacion.accion === 'desactivar' ? 'Desactivar' : 'Reactivar'} cliente?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {confirmacion.customer.customer_code} — {confirmacion.customer.thirdParty?.name}
            </p>
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