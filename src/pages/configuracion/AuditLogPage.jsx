// Bitácora de auditoría (CONFIGURACIÓN → Bitácora, solo ADMIN)
// Ubicación: src/pages/configuracion/AuditLogPage.jsx
//
// 30/10/2026: lo que cada usuario hizo en el sistema con fecha y hora: crear, editar (campo por campo,
// antes → después), desactivar/reactivar, borrar, inicio/cierre de sesión e intentos fallidos.
// Solo lectura (la bitácora no se edita ni se borra). Paginada en el servidor (50 por página).
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { getAuditLogs } from '../../api/auditLogs';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import SelectBuscable from '../../components/common/SelectBuscable';

// Nombre de cada tabla en el lenguaje del negocio
const MODULOS = {
  users: 'Usuarios', profiles: 'Perfiles y permisos', third_parties: 'Terceros', farms: 'Fincas', customers: 'Clientes', brands: 'Marcas',
  customer_contracts: 'Contratos de clientes', contracts: 'Contratos MAG', warehouses: 'Bodegas',
  supplies: 'Insumos', supply_categories: 'Categorías de insumos', movement_reasons: 'Motivos de movimiento',
  material_recipes: 'Recetas de materiales', inventory_movements: 'Movimientos de inventario',
  inventory_movement_lines: 'Líneas de movimiento', purchase_orders: 'Órdenes de compra', purchase_order_lines: 'Líneas de orden de compra',
  customer_orders: 'Pedido semanal', customer_order_lines: 'Líneas del pedido', shipments: 'Barcos de la semana',
  shipment_lines: 'Distribución en barcos', shipment_bookings: 'Cierre de embarque (bookings)', bookings: 'Bookings',
  shipping_lines: 'Navieras', vessels: 'Barcos', ports: 'Puertos', port_tariff_items: 'Tarifas de puerto', destinations: 'Destinos',
  purchase_blocks: 'Compra de fruta (bloques)', producer_quotas: 'Cupos de compra', producer_quota_lines: 'Compra de fruta',
  official_box_prices: 'Precios oficiales MAG', tally_sheets: 'Tarjas', producer_advances: 'Anticipos y préstamos',
  settlements: 'Liquidaciones', settlement_lines: 'Liquidación (fruta)', settlement_materials: 'Liquidación (materiales)',
  settlement_advances: 'Liquidación (anticipos)', settlement_payments: 'Pagos de liquidación', box_types: 'Tipos de caja',
};
const modulo = (t) => MODULOS[t] || t || '—';

const ACCIONES = {
  CREAR: 'bg-green-100 text-green-700', EDITAR: 'bg-indigo-100 text-indigo-700', DESACTIVAR: 'bg-red-100 text-red-700',
  REACTIVAR: 'bg-teal-100 text-teal-700', BORRAR: 'bg-red-600 text-white', INICIO_SESION: 'bg-gray-100 text-gray-700',
  CIERRE_SESION: 'bg-gray-100 text-gray-500', LOGIN_FALLIDO: 'bg-amber-100 text-amber-800',
};

const valor = (v) => {
  if (v === null || v === undefined || v === '') return '(vacío)';
  if (typeof v === 'boolean') return v ? 'SÍ' : 'NO';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '(ninguno)';
  return String(v);
};
const fechaHora = (f) => {
  if (!f) return '—';
  const [d, h] = f.split(' ');
  return `${d.split('-').reverse().join('/')} ${h || ''}`;
};

// Detalle legible de los cambios: en EDITAR {campo: [antes, después]}, en CREAR/BORRAR {campo: valor}
function Detalle({ registro }) {
  const c = registro.changes;
  if (!c) return <span className="text-gray-400">—</span>;
  const pares = Object.entries(c);
  const esCambio = registro.action !== 'CREAR' && registro.action !== 'BORRAR' && pares.every(([, v]) => Array.isArray(v) && v.length === 2);
  return (
    <div className="space-y-0.5 text-xs max-w-[520px]">
      {pares.map(([campo, v]) => (
        <div key={campo} className="break-words">
          <span className="font-semibold text-gray-600">{campo}:</span>{' '}
          {esCambio
            ? <><span className="text-red-600 line-through">{valor(v[0])}</span> → <span className="text-green-700 font-semibold">{valor(v[1])}</span></>
            : <span className="text-gray-700">{valor(v)}</span>}
        </div>
      ))}
    </div>
  );
}

const filtrosVacios = { user_id: '', table_name: '', action: '', desde: '', hasta: '', q: '' };

export default function AuditLogPage() {
  const [filtros, setFiltros] = useState(filtrosVacios);
  const [aplicados, setAplicados] = useState(filtrosVacios);
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ data: [], total: 0, last_page: 1, users: [], tables: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = Object.fromEntries(Object.entries(aplicados).filter(([, v]) => v !== ''));
    getAuditLogs({ ...params, page: pagina })
      .then((res) => { setDatos(res.data); setError(''); })
      .catch((err) => {
        console.error('ERROR AL CARGAR LA BITÁCORA:', err);
        setError(err.response?.data?.message || 'NO SE PUDO CARGAR LA BITÁCORA.');
      })
      .finally(() => setCargando(false));
  }, [aplicados, pagina]);

  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: campo === 'q' ? e.target.value.toUpperCase() : e.target.value }));
  const buscar = (e) => {
    e?.preventDefault();
    setCargando(true);
    setPagina(1);
    setAplicados({ ...filtros });
  };
  const limpiar = () => {
    setCargando(true);
    setFiltros(filtrosVacios);
    setPagina(1);
    setAplicados(filtrosVacios);
  };
  const irA = (p) => {
    setCargando(true);
    setPagina(p);
  };

  const input = 'w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
  const etiqueta = 'block text-xs font-semibold text-gray-600 uppercase mb-1';
  const th = 'text-left px-3 py-3 uppercase text-xs whitespace-nowrap';

  return (
    <div className="p-6">
      <EncabezadoPagina
        titulo="Bitácora"
        subtitulo="Lo que cada usuario registró o cambió en el sistema, con fecha y hora"
      />

      <form onSubmit={buscar} className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
        <div>
          <label className={etiqueta}>Usuario</label>
          <SelectBuscable value={filtros.user_id} onChange={cambiar('user_id')} className={input}>
            <option value="">TODOS</option>
            {datos.users.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
          </SelectBuscable>
        </div>
        <div>
          <label className={etiqueta}>Módulo</label>
          <SelectBuscable value={filtros.table_name} onChange={cambiar('table_name')} className={input}>
            <option value="">TODOS</option>
            {datos.tables.map((t) => <option key={t} value={t}>{modulo(t)}</option>)}
          </SelectBuscable>
        </div>
        <div>
          <label className={etiqueta}>Acción</label>
          <SelectBuscable value={filtros.action} onChange={cambiar('action')} className={input}>
            <option value="">TODAS</option>
            {Object.keys(ACCIONES).map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
          </SelectBuscable>
        </div>
        <div>
          <label className={etiqueta}>Desde</label>
          <input type="date" value={filtros.desde} onChange={cambiar('desde')} className={input} />
        </div>
        <div>
          <label className={etiqueta}>Hasta</label>
          <input type="date" value={filtros.hasta} onChange={cambiar('hasta')} className={input} />
        </div>
        <div>
          <label className={etiqueta}>Buscar en los datos</label>
          <input value={filtros.q} onChange={cambiar('q')} maxLength={100} placeholder="EJ. N° BOOKING, PRODUCTOR" className={input} />
        </div>
        <div className="md:col-span-3 lg:col-span-6 flex justify-end gap-2">
          <button type="button" onClick={limpiar} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-cancelar text-cancelar-texto hover:bg-cancelar-hover transition">
            <X size={16} /> Limpiar
          </button>
          <button type="submit" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primario text-white hover:bg-primario-hover transition">
            <Search size={16} /> Buscar
          </button>
        </div>
      </form>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-primario text-white">
            <tr>
              <th className={th}>Fecha y hora</th>
              <th className={th}>Usuario</th>
              <th className={th}>Acción</th>
              <th className={th}>Módulo</th>
              <th className={th}>Registro</th>
              <th className={th}>Detalle</th>
              <th className={th}>IP</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Cargando...</td></tr>
            ) : datos.data.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin registros para estos filtros</td></tr>
            ) : datos.data.map((r, i) => (
              <tr key={r.id} className={`align-top ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{fechaHora(r.created_at)}</td>
                <td className="px-3 py-2 font-medium whitespace-nowrap">{r.user_name || '—'}</td>
                <td className="px-3 py-2"><span className={`text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${ACCIONES[r.action] || 'bg-gray-100 text-gray-700'}`}>{r.action.replace('_', ' ')}</span></td>
                <td className="px-3 py-2 whitespace-nowrap">{modulo(r.table_name)}</td>
                <td className="px-3 py-2 text-gray-500">{r.record_id ? `#${r.record_id}` : '—'}</td>
                <td className="px-3 py-2"><Detalle registro={r} /></td>
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap" title={r.route || ''}>{r.ip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
        <span>{datos.total.toLocaleString('es-EC')} registros</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => irA(pagina - 1)} disabled={pagina <= 1 || cargando} className="p-1.5 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40" title="Anterior">
            <ChevronLeft size={16} />
          </button>
          <span>Página {pagina} de {datos.last_page}</span>
          <button type="button" onClick={() => irA(pagina + 1)} disabled={pagina >= datos.last_page || cargando} className="p-1.5 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40" title="Siguiente">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
