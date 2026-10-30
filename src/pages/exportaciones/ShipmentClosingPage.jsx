// Cierre de embarque de una semana (Exportaciones)
// Ubicación: src/pages/exportaciones/ShipmentClosingPage.jsx
// Ruta: /exportaciones/cierre/:id   (id = pedido semanal)
//
// 29/10/2026: la hoja de Logística "Asignación de carga WK-xx" dentro del sistema.
// Por cada barco de la semana: ventana de carga, zarpe, ETA y sus BOOKINGS con lo REALMENTE
// embarcado y sus documentos (booking, DAE, B/L, AUCP, orden, Forma A, consignee, notify, estado DAE).
// - Se puede embarcar más o menos que el cupo, y un contenedor puede salir incompleto: se avisa en
//   ámbar, no se bloquea (es lo que pasó).
// - Lo que falta de un CONTRATO se completa con SPOT en otro booking: el resumen por cliente lo muestra.
// - INGRESO = tarja del puerto. Se compara por DAE (una DAE puede cubrir varios bookings):
//   INGRESO − EMBARCADO = lo que no subió (caídas + rechazos). Se cruza con las tarjas registradas.
// - Pesos y totales se calculan solos (en la hoja de Excel el total de pesos sumaba solo la fila 4).
// Se guarda con la "version" del GET: si otro usuario guardó antes, el backend responde 409.
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, X, Printer, ChevronDown, AlertTriangle, Users } from 'lucide-react';
import { getOrderClosing, saveOrderClosing } from '../../api/customerOrders';
import { useAuth } from '../../context/AuthContext';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import ClosingPrint from '../../components/ClosingPrint';
import SelectBuscable from '../../components/common/SelectBuscable';

const CAJAS_POR_CONTENEDOR = 1200;
const formatoCajas = (v) => Number(v || 0).toLocaleString('es-EC');
const formatoKilos = (v) => Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n = (v) => Number(v) || 0;
const texto = (v) => (v === null || v === undefined ? '' : String(v));

let contador = 0;
const nuevaClave = () => `k-${++contador}`;

const bookingDesdeBackend = (k) => ({
  _key: `k-b${k.id}`,
  id: k.id,
  customer_id: texto(k.customer_id),
  brand_id: texto(k.brand_id),
  negotiation_type: k.negotiation_type || 'SPOT',
  cargo_mode: k.cargo_mode || 'BODEGA',
  holds: texto(k.holds),
  containers_qty: k.containers_qty ? texto(k.containers_qty) : '',
  booking_number: texto(k.booking_number),
  dae_number: texto(k.dae_number),
  bl_number: texto(k.bl_number),
  aucp: texto(k.aucp),
  order_ref: texto(k.order_ref),
  forma_a: texto(k.forma_a),
  consignee_name: texto(k.consignee_name),
  consignee_address: texto(k.consignee_address),
  notify_name: texto(k.notify_name),
  notify_address: texto(k.notify_address),
  quota_boxes: texto(k.quota_boxes),
  shipped_boxes: texto(k.shipped_boxes),
  port_entry_boxes: texto(k.port_entry_boxes),
  sample_boxes: k.sample_boxes ? texto(k.sample_boxes) : '',
  net_weight_per_box: texto(k.net_weight_per_box),
  gross_weight_per_box: texto(k.gross_weight_per_box),
  dae_status: texto(k.dae_status),
  arrival_note: texto(k.arrival_note),
  notes: texto(k.notes),
});

const barcoDesdeBackend = (b) => ({
  id: b.id,
  vessel_name: b.vessel_name,
  voyage: b.voyage,
  naviera: b.shipping_line?.name,
  puerto: b.departure_port?.name,
  destino: b.destination_port?.name,
  plan: (b.lines || []).reduce((s, l) => s + n(l.box_quantity), 0),
  loading_from: texto(b.loading_from),
  loading_to: texto(b.loading_to),
  departure_date: texto(b.departure_date),
  eta: texto(b.eta),
  bookings: (b.bookings || []).map(bookingDesdeBackend),
});

// Avisos de una fila (no bloquean: es lo que realmente pasó)
const avisosFila = (k) => {
  const avisos = [];
  const dif = n(k.shipped_boxes) - n(k.quota_boxes);
  if (k.shipped_boxes !== '' && dif > 0) avisos.push(`SE EMBARCARON ${formatoCajas(dif)} CAJAS SOBRE EL CUPO`);
  if (k.cargo_mode === 'CONTENEDOR' && n(k.containers_qty) && n(k.shipped_boxes)) {
    const capacidad = n(k.containers_qty) * CAJAS_POR_CONTENEDOR;
    if (capacidad !== n(k.shipped_boxes)) {
      avisos.push(`${k.containers_qty} CONT. × ${formatoCajas(CAJAS_POR_CONTENEDOR)} = ${formatoCajas(capacidad)}; EMBARCADO ${formatoCajas(k.shipped_boxes)}`);
    }
  }
  return avisos;
};

export default function ShipmentClosingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pedido, setPedido] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [barcos, setBarcos] = useState([]);
  const [tarjas, setTarjas] = useState([]);
  const [partes, setPartes] = useState({}); // último consignee/notify por cliente
  const [version, setVersion] = useState(null);
  const [inicial, setInicial] = useState(null);
  const [abiertos, setAbiertos] = useState({}); // filas con consignee/notify abiertos

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState([]);
  const [conflicto, setConflicto] = useState(false);
  const [toast, setToast] = useState(null);
  const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

  const aplicarRespuesta = (data) => {
    setPedido(data.order);
    setClientes(data.customers || []);
    const lista = (data.shipments || []).map(barcoDesdeBackend);
    setBarcos(lista);
    setInicial(JSON.stringify(lista));
    setTarjas(data.tallies || []);
    setPartes(data.parties && !Array.isArray(data.parties) ? data.parties : {});
    setVersion(data.version);
  };

  useEffect(() => {
    getOrderClosing(id)
      .then((res) => aplicarRespuesta(res.data))
      .catch((err) => {
        console.error('ERROR AL CARGAR EL CIERRE:', err);
        setErrores(['NO SE PUDO CARGAR EL CIERRE DE EMBARQUE DE ESTA SEMANA.']);
      })
      .finally(() => setCargando(false));
  }, [id]);

  // ---------------- Cálculos ----------------

  const todas = barcos.flatMap((b) => b.bookings);
  const sumar = (lista, campo) => lista.reduce((s, k) => s + n(k[campo]), 0);
  const totalCupo = sumar(todas, 'quota_boxes');
  const totalEmbarcado = sumar(todas, 'shipped_boxes');
  const totalNeto = todas.reduce((s, k) => s + n(k.shipped_boxes) * n(k.net_weight_per_box), 0);
  const totalBruto = todas.reduce((s, k) => s + n(k.shipped_boxes) * n(k.gross_weight_per_box), 0);
  const totalContenedores = todas.reduce((s, k) => s + (k.cargo_mode === 'CONTENEDOR' ? n(k.containers_qty) : 0), 0);
  const totalPedido = clientes.reduce((s, c) => s + c.pedido, 0);

  const nombreCliente = (cid) => clientes.find((c) => String(c.id) === String(cid))?.name || '—';
  const marcasDe = (cid) => clientes.find((c) => String(c.id) === String(cid))?.brands || [];
  const nombreMarca = (cid, mid) => marcasDe(cid).find((m) => String(m.id) === String(mid))?.name || '';

  // Tarja del puerto por DAE (una DAE puede cubrir varios bookings; sin DAE, cada booking va solo)
  const porDae = {};
  barcos.forEach((b) => b.bookings.forEach((k) => {
    const clave = k.dae_number.trim().toUpperCase() || `SIN DAE · ${k.booking_number || k._key}`;
    porDae[clave] = porDae[clave] || { dae: clave, barco: b.vessel_name, bookings: 0, embarcado: 0, ingreso: 0, conIngreso: false, sinDae: !k.dae_number.trim() };
    porDae[clave].bookings += 1;
    porDae[clave].embarcado += n(k.shipped_boxes);
    if (k.port_entry_boxes !== '') {
      porDae[clave].ingreso += n(k.port_entry_boxes);
      porDae[clave].conIngreso = true;
    }
  }));
  const daes = Object.values(porDae).filter((d) => d.conIngreso);
  const totalIngreso = daes.reduce((s, d) => s + d.ingreso, 0);
  const embarcadoConIngreso = daes.reduce((s, d) => s + d.embarcado, 0);

  // Resumen por cliente: pedido vs embarcado, CONTRATO y SPOT
  const resumenCliente = clientes.map((c) => {
    const delCliente = todas.filter((k) => k.customer_id === String(c.id));
    const contrato = sumar(delCliente.filter((k) => k.negotiation_type === 'CONTRATO'), 'shipped_boxes');
    const spot = sumar(delCliente.filter((k) => k.negotiation_type === 'SPOT'), 'shipped_boxes');
    return { ...c, contrato, spot, embarcado: contrato + spot };
  });

  // Tarjas registradas (Liquidación) por barco + cliente + marca vs lo embarcado
  const cruceTarjas = tarjas.map((t) => {
    const barco = barcos.find((b) => b.id === t.shipment_id);
    const filas = (barco?.bookings || []).filter((k) => k.customer_id === String(t.customer_id) && k.brand_id === texto(t.brand_id));
    return { ...t, barco: barco?.vessel_name || '—', embarcado: sumar(filas, 'shipped_boxes') };
  });

  // ---------------- Cambios ----------------

  const cambiarBarco = (barcoId, campo, valor) => {
    setBarcos((prev) => prev.map((b) => (b.id === barcoId ? { ...b, [campo]: valor } : b)));
  };

  const cambiarBooking = (barcoId, key, campo, valor) => {
    setBarcos((prev) => prev.map((b) => (b.id !== barcoId ? b : {
      ...b,
      bookings: b.bookings.map((k) => {
        if (k._key !== key) return k;
        const nuevo = { ...k, [campo]: valor };
        if (campo === 'customer_id') {
          const marcas = marcasDe(valor);
          nuevo.brand_id = marcas.length === 1 ? String(marcas[0].id) : '';
          // Consignee y notify del último booking de ese cliente, si están vacíos
          const p = partes[valor];
          if (p && !k.consignee_name && !k.notify_name) {
            nuevo.consignee_name = texto(p.consignee_name);
            nuevo.consignee_address = texto(p.consignee_address);
            nuevo.notify_name = texto(p.notify_name);
            nuevo.notify_address = texto(p.notify_address);
          }
        }
        // En contenedor el cupo se propone con los contenedores completos
        if (campo === 'containers_qty' && k.cargo_mode === 'CONTENEDOR' && (k.quota_boxes === '' || n(k.quota_boxes) === n(k.containers_qty) * CAJAS_POR_CONTENEDOR)) {
          nuevo.quota_boxes = valor === '' ? '' : String(n(valor) * CAJAS_POR_CONTENEDOR);
        }
        return nuevo;
      }),
    })));
  };

  // Booking nuevo: copia cliente, marca, tipo, pesos, DAE y estado de la fila anterior del barco
  const agregarBooking = (barco) => {
    const anterior = barco.bookings[barco.bookings.length - 1];
    const cliente = anterior?.customer_id || (clientes[0] ? String(clientes[0].id) : '');
    const marcas = marcasDe(cliente);
    const p = partes[cliente];
    const key = nuevaClave();
    setBarcos((prev) => prev.map((b) => (b.id !== barco.id ? b : {
      ...b,
      bookings: [...b.bookings, {
        _key: key, id: null,
        customer_id: cliente,
        brand_id: anterior?.brand_id || (marcas.length === 1 ? String(marcas[0].id) : ''),
        negotiation_type: anterior?.negotiation_type || 'SPOT',
        cargo_mode: anterior?.cargo_mode || 'BODEGA',
        holds: '', containers_qty: '',
        booking_number: '', dae_number: anterior?.dae_number || '', bl_number: '', aucp: '', order_ref: '', forma_a: '',
        consignee_name: texto(anterior?.consignee_name || p?.consignee_name),
        consignee_address: texto(anterior?.consignee_address || p?.consignee_address),
        notify_name: texto(anterior?.notify_name || p?.notify_name),
        notify_address: texto(anterior?.notify_address || p?.notify_address),
        quota_boxes: '', shipped_boxes: '', port_entry_boxes: '', sample_boxes: '',
        net_weight_per_box: anterior?.net_weight_per_box || '',
        gross_weight_per_box: anterior?.gross_weight_per_box || '',
        dae_status: '', arrival_note: anterior?.arrival_note || '', notes: '',
      }],
    })));
  };

  const quitarBooking = (barcoId, key) => {
    setBarcos((prev) => prev.map((b) => (b.id !== barcoId ? b : { ...b, bookings: b.bookings.filter((k) => k._key !== key) })));
  };

  const hayCambios = () => inicial !== null && inicial !== JSON.stringify(barcos);
  const volver = () => (hayCambios() ? setMostrarConfirmarSalida(true) : navigate('/exportaciones/cierre'));

  const recargar = async () => {
    setCargando(true);
    setErrores([]);
    setConflicto(false);
    try {
      aplicarRespuesta((await getOrderClosing(id)).data);
    } catch {
      setErrores(['NO SE PUDO RECARGAR EL CIERRE.']);
    } finally {
      setCargando(false);
    }
  };

  // ---------------- Guardar ----------------

  const handleGuardar = async () => {
    setErrores([]);
    setConflicto(false);
    const faltan = [];
    barcos.forEach((b) => {
      if (!b.departure_date) faltan.push(`${b.vessel_name}: FALTA LA FECHA DE ZARPE.`);
      b.bookings.forEach((k, j) => {
        const fila = `${b.vessel_name}, FILA ${j + 1}`;
        if (!k.customer_id) faltan.push(`${fila}: FALTA EL CLIENTE.`);
        if (k.cargo_mode === 'CONTENEDOR' && !n(k.containers_qty)) faltan.push(`${fila}: INDICA CUÁNTOS CONTENEDORES.`);
      });
    });
    if (faltan.length) {
      setErrores(faltan);
      return;
    }

    const num = (v) => (v === '' ? null : Number(v));
    setGuardando(true);
    try {
      const res = await saveOrderClosing(id, {
        version,
        shipments: barcos.map((b) => ({
          id: b.id,
          loading_from: b.loading_from || null,
          loading_to: b.loading_to || null,
          departure_date: b.departure_date,
          eta: b.eta || null,
          bookings: b.bookings.map((k) => ({
            id: k.id,
            customer_id: Number(k.customer_id),
            brand_id: num(k.brand_id),
            negotiation_type: k.negotiation_type,
            cargo_mode: k.cargo_mode,
            holds: k.holds || null,
            containers_qty: k.cargo_mode === 'CONTENEDOR' ? n(k.containers_qty) : 0,
            booking_number: k.booking_number || null,
            dae_number: k.dae_number || null,
            bl_number: k.bl_number || null,
            aucp: k.aucp || null,
            order_ref: k.order_ref || null,
            forma_a: k.forma_a || null,
            consignee_name: k.consignee_name || null,
            consignee_address: k.consignee_address || null,
            notify_name: k.notify_name || null,
            notify_address: k.notify_address || null,
            quota_boxes: n(k.quota_boxes),
            shipped_boxes: n(k.shipped_boxes),
            port_entry_boxes: num(k.port_entry_boxes),
            sample_boxes: n(k.sample_boxes),
            net_weight_per_box: num(k.net_weight_per_box),
            gross_weight_per_box: num(k.gross_weight_per_box),
            dae_status: k.dae_status || null,
            arrival_note: k.arrival_note || null,
            notes: k.notes || null,
          })),
        })),
      });
      aplicarRespuesta(res.data);
      setToast({ tipo: 'exito', mensaje: 'Cierre de embarque guardado correctamente' });
    } catch (err) {
      console.error('ERROR AL GUARDAR EL CIERRE:', err);
      if (err.response?.status === 409) setConflicto(true);
      const e = err.response?.data?.errors;
      setErrores(e ? Object.values(e).flat() : [err.response?.data?.message || 'Error al guardar el cierre de embarque']);
    } finally {
      setGuardando(false);
    }
  };

  // ---------------- Vista ----------------

  const inputClass = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
  const th = 'text-left px-2 py-2 uppercase text-xs whitespace-nowrap';
  const etiqueta = 'block text-xs font-semibold text-gray-600 uppercase mb-1';
  const tarjeta = (titulo, valor, extra = '') => (
    <div className="bg-white rounded-xl shadow px-4 py-3">
      <p className="text-[11px] text-gray-500 uppercase">{titulo}</p>
      <p className={`text-lg font-bold text-gray-800 ${extra}`}>{valor}</p>
    </div>
  );

  if (cargando) return <div className="p-6 text-gray-400">Cargando cierre de embarque...</div>;
  if (!pedido) {
    return <div className="p-6">{errores.map((e) => <p key={e} className="text-red-600 text-sm">{e}</p>)}</div>;
  }

  const difTotal = totalEmbarcado - totalCupo;

  return (
    <>
    <div className="p-6 print:hidden">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-4">
        <button type="button" onClick={volver} title="Volver" className="p-2 rounded-lg hover:bg-gray-200 text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">Cierre de embarque — Semana {pedido.week} / {pedido.year}</h1>
          <p className="text-sm text-gray-500">Lo realmente embarcado por booking, con sus documentos (asignación de carga)</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={todas.length === 0}
          title={todas.length === 0 ? 'Agrega al menos un booking para imprimir' : 'Imprimir la asignación de carga'}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover disabled:opacity-50 transition"
        >
          <Printer size={18} /> Imprimir
        </button>
      </div>

      {/* Totales de la semana */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        {tarjeta('Pedido', formatoCajas(totalPedido))}
        {tarjeta('Cupo bookings', formatoCajas(totalCupo))}
        {tarjeta('Embarcado', formatoCajas(totalEmbarcado), 'text-primario')}
        {tarjeta('Embarcado − pedido', `${totalEmbarcado - totalPedido > 0 ? '+' : ''}${formatoCajas(totalEmbarcado - totalPedido)}`, totalEmbarcado - totalPedido < 0 ? 'text-amber-700' : 'text-green-700')}
        {tarjeta('Contenedores', formatoCajas(totalContenedores))}
        {tarjeta('Peso neto (kg)', formatoKilos(totalNeto))}
        {tarjeta('Peso bruto (kg)', formatoKilos(totalBruto))}
      </div>

      {/* Resumen por cliente */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {resumenCliente.map((c) => {
          const cortoContrato = c.pedido_contrato - c.contrato;
          const extraSpot = c.spot - c.pedido_spot;
          const dif = c.embarcado - c.pedido;
          return (
            <div key={c.id} className="bg-white rounded-xl shadow p-4">
              <p className="font-bold text-gray-800">{c.name}</p>
              <table className="w-full text-sm mt-2">
                <thead>
                  <tr className="text-[10px] text-gray-500 uppercase">
                    <th className="text-left font-normal"></th>
                    <th className="text-right font-normal">Pedido</th>
                    <th className="text-right font-normal">Embarcado</th>
                    <th className="text-right font-normal">Dif.</th>
                  </tr>
                </thead>
                <tbody>
                  {[['CONTRATO', c.pedido_contrato, c.contrato], ['SPOT', c.pedido_spot, c.spot], ['TOTAL', c.pedido, c.embarcado]].map(([tipo, ped, emb]) => (
                    <tr key={tipo} className={tipo === 'TOTAL' ? 'font-semibold border-t' : ''}>
                      <td className="text-xs text-gray-600">{tipo}</td>
                      <td className="text-right">{formatoCajas(ped)}</td>
                      <td className="text-right">{formatoCajas(emb)}</td>
                      <td className={`text-right ${emb - ped < 0 ? 'text-amber-700' : emb - ped > 0 ? 'text-green-700' : 'text-gray-400'}`}>{emb - ped > 0 ? '+' : ''}{formatoCajas(emb - ped)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cortoContrato > 0 && c.contrato > 0 && (
                <p className="text-[11px] text-amber-800 mt-2">
                  El contrato quedó corto en {formatoCajas(cortoContrato)} cajas{extraSpot > 0 ? `; se completó con SPOT (+${formatoCajas(extraSpot)})` : ''}.
                </p>
              )}
              {dif > 0 && <p className="text-[11px] text-green-700 mt-1">Se embarcaron {formatoCajas(dif)} cajas más de lo pedido.</p>}
            </div>
          );
        })}
      </div>

      {barcos.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3 mb-4">
          <AlertTriangle size={16} /> Esta semana aún no tiene barcos. Ármalos primero en <strong>Exportaciones → Distribución en barcos</strong>.
        </div>
      )}

      {/* Un bloque por barco */}
      <div className="space-y-4 mb-4">
        {barcos.map((b) => {
          const embarcado = sumar(b.bookings, 'shipped_boxes');
          const cupo = sumar(b.bookings, 'quota_boxes');
          return (
            <div key={b.id} className="bg-white rounded-xl shadow overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-primario-claro border-b">
                <div className="flex-1 min-w-[240px]">
                  <p className="font-bold text-gray-800">{b.vessel_name}{b.voyage && !b.vessel_name?.includes(b.voyage) ? ` · ${b.voyage}` : ''}</p>
                  <p className="text-xs text-gray-600">{b.naviera || '—'} · {b.puerto || '—'} → {b.destino || '—'} · {b.bookings.length} bookings</p>
                </div>
                <div className="flex gap-5 text-sm text-center">
                  <div><p className="text-[10px] text-gray-500 uppercase">Plan (distribución)</p><p className="font-semibold">{formatoCajas(b.plan)}</p></div>
                  <div><p className="text-[10px] text-gray-500 uppercase">Cupo</p><p className="font-semibold">{formatoCajas(cupo)}</p></div>
                  <div><p className="text-[10px] text-gray-500 uppercase">Embarcado</p><p className="font-semibold text-primario">{formatoCajas(embarcado)}</p></div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Dif. vs cupo</p>
                    <p className={`font-semibold ${embarcado - cupo < 0 ? 'text-amber-700' : embarcado - cupo > 0 ? 'text-green-700' : 'text-gray-500'}`}>{embarcado - cupo > 0 ? '+' : ''}{formatoCajas(embarcado - cupo)}</p>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm max-w-3xl">
                  <div>
                    <label className={etiqueta}>Carga desde</label>
                    <input type="date" value={b.loading_from} onChange={(e) => cambiarBarco(b.id, 'loading_from', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={etiqueta}>Carga hasta</label>
                    <input type="date" value={b.loading_to} onChange={(e) => cambiarBarco(b.id, 'loading_to', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={etiqueta}>Zarpe *</label>
                    <input type="date" value={b.departure_date} onChange={(e) => cambiarBarco(b.id, 'departure_date', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={etiqueta}>Llegada (ETA)</label>
                    <input type="date" value={b.eta} onChange={(e) => cambiarBarco(b.id, 'eta', e.target.value)} className={inputClass} />
                  </div>
                </div>

                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm min-w-[2800px]">
                    <thead className="bg-primario text-white">
                      <tr>
                        <th className={th}>#</th>
                        <th className={th}>Cliente *</th>
                        <th className={th}>Marca</th>
                        <th className={th}>Tipo</th>
                        <th className={th}>Carga</th>
                        <th className={th}>Bodegas / Cont.</th>
                        <th className={th}>Booking</th>
                        <th className={th}>DAE</th>
                        <th className={th}>B/L</th>
                        <th className={`${th} text-right`}>Cupo</th>
                        <th className={`${th} text-right`}>Embarcado</th>
                        <th className={`${th} text-right`}>Dif.</th>
                        <th className={`${th} text-right`} title="Cajas de la tarja del puerto">Ingreso (tarja)</th>
                        <th className={`${th} text-right`}>P.N. caja</th>
                        <th className={`${th} text-right`}>P.B. caja</th>
                        <th className={`${th} text-right`}>Peso neto</th>
                        <th className={`${th} text-right`}>Peso bruto</th>
                        <th className={th}>AUCP</th>
                        <th className={th}>Orden</th>
                        <th className={th}>Estado DAE</th>
                        <th className={th}>Estado</th>
                        <th className="px-2 py-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.bookings.length === 0 ? (
                        <tr><td colSpan={22} className="text-center py-5 text-gray-400">Agrega el primer booking de este barco</td></tr>
                      ) : b.bookings.map((k, j) => {
                        const cambiar = (campo) => (e) => cambiarBooking(b.id, k._key, campo, e.target.value);
                        const mayus = (campo) => (e) => cambiarBooking(b.id, k._key, campo, e.target.value.toUpperCase());
                        const dif = n(k.shipped_boxes) - n(k.quota_boxes);
                        const avisos = avisosFila(k);
                        const marcas = marcasDe(k.customer_id);
                        const abierto = abiertos[k._key];
                        const fondo = j % 2 === 0 ? 'bg-gray-50' : 'bg-white';
                        return [
                          <tr key={k._key} className={fondo}>
                            <td className="px-2 py-1.5 text-gray-400">{j + 1}</td>
                            <td className="px-2 py-1.5 min-w-[200px]">
                              <SelectBuscable value={k.customer_id} onChange={cambiar('customer_id')} className={inputClass}>
                                <option value="">SELECCIONAR...</option>
                                {clientes.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                              </SelectBuscable>
                              {avisos.map((a) => <p key={a} className="text-[10px] text-amber-700 font-semibold mt-0.5">⚠ {a}</p>)}
                            </td>
                            <td className="px-2 py-1.5 min-w-[180px]">
                              <SelectBuscable value={k.brand_id} onChange={cambiar('brand_id')} disabled={!k.customer_id} className={inputClass}>
                                <option value="">{marcas.length ? '—' : 'SIN MARCAS'}</option>
                                {marcas.map((m) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                              </SelectBuscable>
                            </td>
                            <td className="px-2 py-1.5 min-w-[140px]">
                              <SelectBuscable value={k.negotiation_type} onChange={cambiar('negotiation_type')} className={inputClass}>
                                <option value="CONTRATO">CONTRATO</option>
                                <option value="SPOT">SPOT</option>
                              </SelectBuscable>
                            </td>
                            <td className="px-2 py-1.5 min-w-[165px]">
                              <SelectBuscable value={k.cargo_mode} onChange={cambiar('cargo_mode')} className={inputClass}>
                                <option value="BODEGA">BODEGA (CS)</option>
                                <option value="CONTENEDOR">CONTENEDOR</option>
                              </SelectBuscable>
                            </td>
                            <td className="px-2 py-1.5 min-w-[110px]">
                              {k.cargo_mode === 'CONTENEDOR'
                                ? <input type="number" min="1" value={k.containers_qty} onChange={cambiar('containers_qty')} placeholder="# CONT." title="Número de contenedores" className={`${inputClass} text-right`} />
                                : <input value={k.holds} maxLength={40} onChange={mayus('holds')} placeholder="2ABCDE" title="Bodegas del barco" className={inputClass} />}
                            </td>
                            <td className="px-2 py-1.5 min-w-[170px]"><input value={k.booking_number} maxLength={30} onChange={mayus('booking_number')} placeholder="N° BOOKING" className={inputClass} /></td>
                            <td className="px-2 py-1.5 min-w-[190px]"><input value={k.dae_number} maxLength={30} onChange={mayus('dae_number')} placeholder="N° DAE" className={inputClass} /></td>
                            <td className="px-2 py-1.5 min-w-[130px]"><input value={k.bl_number} maxLength={30} onChange={mayus('bl_number')} className={inputClass} /></td>
                            <td className="px-2 py-1.5 min-w-[95px]"><input type="number" min="0" value={k.quota_boxes} onChange={cambiar('quota_boxes')} className={`${inputClass} text-right`} /></td>
                            <td className="px-2 py-1.5 min-w-[100px]"><input type="number" min="0" value={k.shipped_boxes} onChange={cambiar('shipped_boxes')} className={`${inputClass} text-right font-semibold`} /></td>
                            <td className={`px-2 py-1.5 text-right whitespace-nowrap font-semibold ${dif < 0 ? 'text-amber-700' : dif > 0 ? 'text-green-700' : 'text-gray-400'}`}>{dif > 0 ? '+' : ''}{formatoCajas(dif)}</td>
                            <td className="px-2 py-1.5 min-w-[100px]"><input type="number" min="0" value={k.port_entry_boxes} onChange={cambiar('port_entry_boxes')} placeholder="—" title="Si la DAE cubre varios bookings, escribe el ingreso en uno solo" className={`${inputClass} text-right`} /></td>
                            <td className="px-2 py-1.5 min-w-[80px]"><input type="number" min="0" step="0.01" value={k.net_weight_per_box} onChange={cambiar('net_weight_per_box')} placeholder="19.40" className={`${inputClass} text-right`} /></td>
                            <td className="px-2 py-1.5 min-w-[80px]"><input type="number" min="0" step="0.01" value={k.gross_weight_per_box} onChange={cambiar('gross_weight_per_box')} placeholder="20.80" className={`${inputClass} text-right`} /></td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatoKilos(n(k.shipped_boxes) * n(k.net_weight_per_box))}</td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatoKilos(n(k.shipped_boxes) * n(k.gross_weight_per_box))}</td>
                            <td className="px-2 py-1.5 min-w-[80px]"><input value={k.aucp} maxLength={20} onChange={mayus('aucp')} className={inputClass} /></td>
                            <td className="px-2 py-1.5 min-w-[80px]"><input value={k.order_ref} maxLength={20} onChange={mayus('order_ref')} className={inputClass} /></td>
                            <td className="px-2 py-1.5 min-w-[150px]"><input value={k.dae_status} maxLength={40} onChange={mayus('dae_status')} placeholder="REGULARIZADA" className={inputClass} /></td>
                            <td className="px-2 py-1.5 min-w-[130px]"><input value={k.arrival_note} maxLength={40} onChange={mayus('arrival_note')} placeholder="LLEGA SEM38" className={inputClass} /></td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              <button type="button" onClick={() => setAbiertos((p) => ({ ...p, [k._key]: !abierto }))} title="Consignee, notify, Forma A, muestras y notas" className={`p-1.5 rounded-lg shadow-sm mr-1 ${k.consignee_name ? 'bg-primario text-white hover:bg-primario-hover' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
                                {abierto ? <ChevronDown size={16} /> : <Users size={16} />}
                              </button>
                              <button type="button" onClick={() => quitarBooking(b.id, k._key)} title="Quitar booking" className="text-white p-1.5 rounded-lg shadow-sm bg-red-600 hover:bg-red-700">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>,
                          abierto && (
                            <tr key={`${k._key}-partes`} className={fondo}>
                              <td></td>
                              <td colSpan={21} className="px-2 pb-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-w-[1500px]">
                                  <div>
                                    <label className={etiqueta}>Consignee</label>
                                    <input value={k.consignee_name} maxLength={150} onChange={cambiar('consignee_name')} className={`${inputClass} mb-1`} />
                                    <textarea value={k.consignee_address} maxLength={500} rows={2} onChange={cambiar('consignee_address')} placeholder="Dirección" className={inputClass} />
                                  </div>
                                  <div>
                                    <label className={etiqueta}>Notify</label>
                                    <input value={k.notify_name} maxLength={150} onChange={cambiar('notify_name')} className={`${inputClass} mb-1`} />
                                    <textarea value={k.notify_address} maxLength={500} rows={2} onChange={cambiar('notify_address')} placeholder="Dirección" className={inputClass} />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 content-start">
                                    <div className="col-span-2">
                                      <label className={etiqueta}>Forma A</label>
                                      <input value={k.forma_a} maxLength={60} onChange={mayus('forma_a')} placeholder="PALM BANANAS" className={inputClass} />
                                    </div>
                                    <div>
                                      <label className={etiqueta}>Cajas muestra</label>
                                      <input type="number" min="0" value={k.sample_boxes} onChange={cambiar('sample_boxes')} className={`${inputClass} text-right`} />
                                    </div>
                                  </div>
                                  <div>
                                    <label className={etiqueta}>Notas</label>
                                    <textarea value={k.notes} maxLength={255} rows={3} onChange={mayus('notes')} placeholder="EJ. FALTANTE DEL CONTRATO VA EN BOOKING ..." className={inputClass} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ),
                        ];
                      })}
                    </tbody>
                    {b.bookings.length > 0 && (
                      <tfoot className="bg-gray-100 font-semibold">
                        <tr>
                          <td colSpan={9} className="px-2 py-2 text-right uppercase text-xs text-gray-600">Total {b.vessel_name}</td>
                          <td className="px-2 py-2 text-right">{formatoCajas(cupo)}</td>
                          <td className="px-2 py-2 text-right">{formatoCajas(embarcado)}</td>
                          <td className="px-2 py-2 text-right">{embarcado - cupo > 0 ? '+' : ''}{formatoCajas(embarcado - cupo)}</td>
                          <td className="px-2 py-2 text-right">{formatoCajas(sumar(b.bookings, 'port_entry_boxes'))}</td>
                          <td colSpan={2}></td>
                          <td className="px-2 py-2 text-right">{formatoKilos(b.bookings.reduce((s, k) => s + n(k.shipped_boxes) * n(k.net_weight_per_box), 0))}</td>
                          <td className="px-2 py-2 text-right">{formatoKilos(b.bookings.reduce((s, k) => s + n(k.shipped_boxes) * n(k.gross_weight_per_box), 0))}</td>
                          <td colSpan={5}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <button type="button" onClick={() => agregarBooking(b)} className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition">
                  <Plus size={18} /> Agregar booking
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tarja del puerto por DAE */}
      {daes.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <h2 className="font-semibold text-gray-800 mb-1">Tarja del puerto por DAE</h2>
          <p className="text-xs text-gray-500 mb-3">INGRESO − EMBARCADO = lo que no subió al barco (caídas + rechazos). Una DAE puede cubrir varios bookings.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase border-b">
                <tr>
                  <th className="text-left py-1">DAE</th>
                  <th className="text-left py-1">Barco</th>
                  <th className="text-right py-1">Bookings</th>
                  <th className="text-right py-1">Ingreso (tarja)</th>
                  <th className="text-right py-1">Embarcado</th>
                  <th className="text-right py-1">No subió</th>
                  <th className="text-right py-1">%</th>
                </tr>
              </thead>
              <tbody>
                {daes.map((d) => {
                  const noSubio = d.ingreso - d.embarcado;
                  return (
                    <tr key={d.dae} className="border-b last:border-0">
                      <td className="py-1.5">{d.dae}</td>
                      <td className="py-1.5">{d.barco}</td>
                      <td className="py-1.5 text-right">{d.bookings}</td>
                      <td className="py-1.5 text-right">{formatoCajas(d.ingreso)}</td>
                      <td className="py-1.5 text-right">{formatoCajas(d.embarcado)}</td>
                      <td className={`py-1.5 text-right font-semibold ${noSubio < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                        {noSubio < 0 ? `⚠ ${formatoCajas(noSubio)} (EMBARCADO MAYOR AL INGRESO)` : formatoCajas(noSubio)}
                      </td>
                      <td className="py-1.5 text-right">{d.ingreso ? `${((noSubio / d.ingreso) * 100).toFixed(1)} %` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="font-semibold border-t">
                <tr>
                  <td colSpan={3} className="py-1.5">TOTAL</td>
                  <td className="py-1.5 text-right">{formatoCajas(totalIngreso)}</td>
                  <td className="py-1.5 text-right">{formatoCajas(embarcadoConIngreso)}</td>
                  <td className="py-1.5 text-right">{formatoCajas(totalIngreso - embarcadoConIngreso)}</td>
                  <td className="py-1.5 text-right">{totalIngreso ? `${(((totalIngreso - embarcadoConIngreso) / totalIngreso) * 100).toFixed(1)} %` : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Cruce con las tarjas registradas (Liquidación) */}
      {cruceTarjas.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <h2 className="font-semibold text-gray-800 mb-1">Cruce con las tarjas registradas</h2>
          <p className="text-xs text-gray-500 mb-3">Tarjas por camión registradas en Liquidación, por barco, cliente y marca, frente a lo embarcado en los bookings.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase border-b">
                <tr>
                  <th className="text-left py-1">Barco</th>
                  <th className="text-left py-1">Cliente · Marca</th>
                  <th className="text-right py-1">Tarjas: embarcadas</th>
                  <th className="text-right py-1">Caídas</th>
                  <th className="text-right py-1">Rechazadas</th>
                  <th className="text-right py-1">Embarcado (bookings)</th>
                  <th className="text-right py-1">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {cruceTarjas.map((t) => {
                  const dif = t.embarcado - n(t.embarcadas);
                  return (
                    <tr key={`${t.shipment_id}-${t.customer_id}-${t.brand_id}`} className="border-b last:border-0">
                      <td className="py-1.5">{t.barco}</td>
                      <td className="py-1.5">{nombreCliente(t.customer_id)} · {nombreMarca(t.customer_id, t.brand_id) || '—'}</td>
                      <td className="py-1.5 text-right">{formatoCajas(t.embarcadas)}</td>
                      <td className="py-1.5 text-right">{formatoCajas(t.caidas)}</td>
                      <td className="py-1.5 text-right">{formatoCajas(t.rechazadas)}</td>
                      <td className="py-1.5 text-right">{formatoCajas(t.embarcado)}</td>
                      <td className={`py-1.5 text-right font-semibold ${dif === 0 ? 'text-green-700' : 'text-amber-700'}`}>{dif === 0 ? '✔' : `${dif > 0 ? '+' : ''}${formatoCajas(dif)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {errores.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 max-h-48 overflow-y-auto">
          {errores.map((e) => <p key={e}>{e}</p>)}
          {conflicto && (
            <button type="button" onClick={recargar} className="mt-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700">
              Recargar lo último guardado
            </button>
          )}
        </div>
      )}

      <div className="flex justify-between items-center gap-3">
        <p className={`text-sm font-semibold ${difTotal < 0 ? 'text-amber-700' : 'text-gray-600'}`}>
          Embarcado {formatoCajas(totalEmbarcado)} de {formatoCajas(totalCupo)} de cupo ({difTotal > 0 ? '+' : ''}{formatoCajas(difTotal)})
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={volver} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-cancelar text-cancelar-texto hover:bg-cancelar-hover transition">
            <X size={16} /> Cancelar
          </button>
          <button type="button" onClick={handleGuardar} disabled={guardando || barcos.length === 0} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50 disabled:hover:bg-guardar transition">
            <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar cierre'}
          </button>
        </div>
      </div>

      {mostrarConfirmarSalida && (
        <DialogoConfirmacion
          titulo="¿Seguro que deseas salir?"
          textoAceptar="Salir sin guardar"
          textoCancelar="Seguir editando"
          onCancelar={() => setMostrarConfirmarSalida(false)}
          onAceptar={() => navigate('/exportaciones/cierre')}
        >
          Tienes cambios sin guardar que se perderán.
        </DialogoConfirmacion>
      )}
    </div>

    <ClosingPrint
      pedido={pedido}
      barcos={barcos}
      resumenCliente={resumenCliente}
      nombreCliente={nombreCliente}
      nombreMarca={nombreMarca}
      usuario={user?.name}
      borrador={hayCambios()}
    />
    </>
  );
}
