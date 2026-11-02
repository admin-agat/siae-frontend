// Formulario del PEDIDO SEMANAL (correo de Rusia) — crear / editar
// Ubicación: src/pages/exportaciones/CustomerOrderFormPage.jsx
// Rutas: /exportaciones/pedidos/nuevo  y  /exportaciones/pedidos/:id
//
// Cada línea es un renglón del correo, ej.:
//   "GT 10.800 PALMS FOB contenedor 9*1200 cinta packed Bolívar SPOT"
// Reglas (el backend las vuelve a validar):
//   - CONTRATO: el precio sale del contrato vigente del cliente el lunes de esa semana
//     (mismo incoterm, o contrato sin incoterm). Aquí solo se MUESTRA; el backend lo copia y congela.
//   - SPOT: el precio se escribe a mano y puede quedar vacío hasta que llegue.
//   - Contenedor: las cajas se calculan solas = contenedores × cajas por contenedor.
//   - 02/11/2026: cada línea lleva MARCA (del cliente) y PRESENTACIÓN (CONVENCIONAL / PACKED), como
//     vienen en el correo. El precio de CONTRATO es el de esa marca + presentación.
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Save, X } from 'lucide-react';
import { getCustomerOrder, createCustomerOrder, updateCustomerOrder } from '../../api/customerOrders';
import { getCustomers } from '../../api/customers';
import { getPorts } from '../../api/ports';
import { getCustomerContracts } from '../../api/customerContracts';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import { getMensajeExito, getMensajeError } from '../../utils/toastMessages';
import SelectBuscable from '../../components/common/SelectBuscable';
import { PRESENTACIONES } from '../../utils/presentaciones';

const INCOTERMS = ['FOB', 'CFR', 'CIF'];

const TIPOS_CARGA = [
  { valor: 'CAJA_BAJO_CUBIERTA', etiqueta: 'BAJO CUBIERTA' },
  { valor: 'GRANEL_BAJO_CUBIERTA', etiqueta: 'GRANEL BAJO CUBIERTA' },
  { valor: 'CAJA_CONTENEDOR', etiqueta: 'CONTENEDOR' },
  { valor: 'GRANEL_CONTENEDOR', etiqueta: 'CONTENEDOR A GRANEL' },
];

const esContenedor = (tipo) => tipo?.endsWith('_CONTENEDOR');

// Lunes de la semana ISO (semana bananera) → "2026-08-31". Misma fecha que usa el backend.
const lunesSemanaISO = (anio, semana) => {
  const ene4 = new Date(Date.UTC(anio, 0, 4));
  const diaSemana = ene4.getUTCDay() || 7;
  const lunes = new Date(ene4);
  lunes.setUTCDate(ene4.getUTCDate() - diaSemana + 1 + (semana - 1) * 7);
  return lunes.toISOString().slice(0, 10);
};

// Semana ISO de hoy, para proponer la semana del pedido nuevo
const semanaISOActual = () => {
  const hoy = new Date();
  const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { semana: Math.ceil(((d - inicioAnio) / 86400000 + 1) / 7), anio: d.getUTCFullYear() };
};

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const formatoDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Clave local para las líneas nuevas (aún sin id del backend)
let contadorLineas = 0;
const nuevaClave = () => `nueva-${++contadorLineas}`;

const lineaVacia = () => ({
  _key: nuevaClave(),
  id: null,
  customer_id: '',
  brand_id: '',
  presentation: 'CONVENCIONAL',
  boxes: '',
  incoterm: 'FOB',
  cargo_type: 'CAJA_BAJO_CUBIERTA',
  containers_qty: '',
  boxes_per_container: '1200',
  departure_port_id: '',
  negotiation_type: 'CONTRATO',
  box_price: '',
  order_number: '',
  notes: '',
});

// Línea que llega del backend → formato del formulario (todo como texto para los inputs).
// _guardada conserva cómo estaba para mostrar el precio CONGELADO mientras no cambie.
const lineaDesdeBackend = (l) => ({
  _key: `id-${l.id}`,
  id: l.id,
  customer_id: String(l.customer_id),
  brand_id: l.brand_id ? String(l.brand_id) : '',
  presentation: l.presentation || 'CONVENCIONAL',
  boxes: String(l.boxes),
  incoterm: l.incoterm,
  cargo_type: l.cargo_type,
  containers_qty: l.containers_qty ? String(l.containers_qty) : '',
  boxes_per_container: l.boxes_per_container ? String(l.boxes_per_container) : '1200',
  departure_port_id: l.departure_port_id ? String(l.departure_port_id) : '',
  negotiation_type: l.negotiation_type,
  box_price: l.box_price ?? '',
  order_number: l.order_number || '',
  notes: l.notes || '',
  _guardada: {
    customer_id: String(l.customer_id),
    brand_id: l.brand_id ? String(l.brand_id) : '',
    presentation: l.presentation,
    incoterm: l.incoterm,
    negotiation_type: l.negotiation_type,
    customer_contract_id: l.customer_contract_id,
    box_price: l.box_price,
  },
});

export default function CustomerOrderFormPage() {
  const { id } = useParams();
  const esEdicion = Boolean(id);
  const navigate = useNavigate();

  const actual = semanaISOActual();
  const [cabecera, setCabecera] = useState({
    week: String(actual.semana),
    year: String(actual.anio),
    // Total de cajas que pide Rusia para la semana: las líneas deben sumar exactamente esto
    expected_boxes: '',
    received_at: new Date().toISOString().slice(0, 10),
    comment: '',
  });
  const [lineas, setLineas] = useState([lineaVacia()]);
  const estadoInicialRef = useRef(null);

  const [clientes, setClientes] = useState([]);
  const [puertos, setPuertos] = useState([]);
  const [contratos, setContratos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState([]);
  const [toast, setToast] = useState(null);
  const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true);
        const [resClientes, resPuertos, resContratos, resPedido] = await Promise.all([
          getCustomers(),
          getPorts({ status: true, port_type: 'SALIDA' }),
          getCustomerContracts({ status: true }),
          esEdicion ? getCustomerOrder(id) : Promise.resolve(null),
        ]);

        const pedido = resPedido?.data;
        const idsEnPedido = (pedido?.lines || []).map((l) => l.customer_id);
        const listaClientes = Array.isArray(resClientes.data) ? resClientes.data : [];
        // Clientes activos + los inactivos que ya estén en el pedido (para no perder el nombre)
        setClientes(listaClientes.filter((c) => c.status || idsEnPedido.includes(c.id)));
        setPuertos(Array.isArray(resPuertos.data) ? resPuertos.data : []);
        setContratos(Array.isArray(resContratos.data) ? resContratos.data : []);

        let cab = cabecera;
        let lin = lineas;
        if (pedido) {
          cab = {
            week: String(pedido.week),
            year: String(pedido.year),
            expected_boxes: pedido.expected_boxes ? String(pedido.expected_boxes) : '',
            received_at: pedido.received_at || '',
            comment: pedido.comment || '',
          };
          lin = pedido.lines.map(lineaDesdeBackend);
          setCabecera(cab);
          setLineas(lin);
        }
        estadoInicialRef.current = JSON.stringify({ cab, lin });
      } catch (err) {
        console.error('ERROR AL CARGAR EL PEDIDO:', err);
        setErrores(['NO SE PUDO CARGAR EL PEDIDO.']);
      } finally {
        setCargando(false);
      }
    };
    cargar();
    // Solo al abrir la página (o cambiar de pedido)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------------- Cálculos ----------------

  const semanaValida = Number(cabecera.week) >= 1 && Number(cabecera.week) <= 53 && Number(cabecera.year) >= 2020;
  const lunes = semanaValida ? lunesSemanaISO(Number(cabecera.year), Number(cabecera.week)) : null;

  const nombreCliente = (clienteId) =>
    clientes.find((c) => String(c.id) === String(clienteId))?.third_party?.name || '';
  const marcasDe = (clienteId) => clientes.find((c) => String(c.id) === String(clienteId))?.brands || [];

  // Contrato vigente el lunes de la semana: primero el del mismo incoterm, luego uno sin incoterm
  const contratoVigente = (clienteId, incoterm) => {
    if (!lunes || !clienteId) return null;
    const vigentes = contratos.filter((c) =>
      String(c.customer_id) === String(clienteId)
      && c.start_date <= lunes && c.end_date >= lunes
      && (c.incoterm === incoterm || !c.incoterm));
    return vigentes.find((c) => c.incoterm === incoterm) || vigentes[0] || null;
  };

  // Precio que tendrá la línea. CONTRATO: congelado si nada cambió; si no, el del contrato vigente.
  const precioLinea = (l) => {
    if (l.negotiation_type === 'SPOT') {
      return { precio: l.box_price === '' ? null : Number(l.box_price), origen: 'SPOT' };
    }
    const contrato = contratoVigente(l.customer_id, l.incoterm);
    const g = l._guardada;
    if (g && g.negotiation_type === 'CONTRATO' && g.customer_id === l.customer_id
      && g.brand_id === l.brand_id && g.presentation === l.presentation
      && g.incoterm === l.incoterm && contrato && g.customer_contract_id === contrato.id) {
      return { precio: Number(g.box_price), origen: 'CONGELADO' };
    }
    if (!contrato) return { precio: null, origen: 'SIN_CONTRATO' };
    const p = (contrato.prices || []).find((x) => String(x.brand_id) === String(l.brand_id) && x.presentation === l.presentation);
    return p ? { precio: Number(p.box_price), origen: 'CONTRATO' } : { precio: null, origen: 'SIN_PRECIO' };
  };

  // Totales por cliente (en el orden en que aparecen en el pedido)
  const resumen = [];
  lineas.forEach((l) => {
    if (!l.customer_id) return;
    let fila = resumen.find((r) => r.customer_id === l.customer_id);
    if (!fila) {
      fila = { customer_id: l.customer_id, nombre: nombreCliente(l.customer_id), contrato: 0, spot: 0, monto: 0, sinPrecio: 0 };
      resumen.push(fila);
    }
    const cajas = Number(l.boxes) || 0;
    if (l.negotiation_type === 'CONTRATO') fila.contrato += cajas; else fila.spot += cajas;
    const { precio } = precioLinea(l);
    if (precio === null) fila.sinPrecio += cajas; else fila.monto += cajas * precio;
  });
  const totalCajas = resumen.reduce((s, r) => s + r.contrato + r.spot, 0);
  const totalMonto = resumen.reduce((s, r) => s + r.monto, 0);
  const totalSinPrecio = resumen.reduce((s, r) => s + r.sinPrecio, 0);

  // Cuadre contra el total de la semana: solo se puede guardar cuando la diferencia es 0
  // (se suman todas las líneas, aunque aún no tengan cliente)
  const totalSemana = Number(cabecera.expected_boxes) || 0;
  const totalLineas = lineas.reduce((s, l) => s + (Number(l.boxes) || 0), 0);
  const diferencia = totalSemana - totalLineas;
  const cuadrado = totalSemana > 0 && diferencia === 0;
  const avance = totalSemana > 0 ? Math.min(100, (totalLineas / totalSemana) * 100) : 0;

  // ---------------- Cambios ----------------

  const cambiarCabecera = (e) => {
    const { name, value } = e.target;
    setCabecera((prev) => ({ ...prev, [name]: name === 'comment' ? value.toUpperCase() : value }));
  };

  const cambiarLinea = (key, campo, valor) => {
    setLineas((prev) => prev.map((l) => {
      if (l._key !== key) return l;
      const nueva = { ...l, [campo]: valor };
      // Al cambiar de cliente: si la marca no es suya se limpia; si tiene una sola, se pone sola
      if (campo === 'customer_id') {
        const marcas = marcasDe(valor);
        if (!marcas.some((m) => String(m.id) === nueva.brand_id)) nueva.brand_id = marcas.length === 1 ? String(marcas[0].id) : '';
      }
      // Contenedor: cajas = contenedores × cajas por contenedor
      if (esContenedor(nueva.cargo_type)) {
        const total = (Number(nueva.containers_qty) || 0) * (Number(nueva.boxes_per_container) || 0);
        nueva.boxes = total ? String(total) : '';
      }
      return nueva;
    }));
  };

  const agregarLinea = () => {
    // La nueva línea copia cliente y puerto de la anterior (el correo suele venir agrupado por cliente)
    const ultima = lineas[lineas.length - 1];
    setLineas((prev) => [...prev, {
      ...lineaVacia(),
      customer_id: ultima?.customer_id || '',
      brand_id: ultima?.brand_id || '',
      presentation: ultima?.presentation || 'CONVENCIONAL',
      departure_port_id: ultima?.departure_port_id || '',
    }]);
  };

  const quitarLinea = (key) => setLineas((prev) => prev.filter((l) => l._key !== key));

  const hayCambiosSinGuardar = () =>
    estadoInicialRef.current !== null
    && estadoInicialRef.current !== JSON.stringify({ cab: cabecera, lin: lineas });

  const volver = () => {
    if (hayCambiosSinGuardar()) {
      setMostrarConfirmarSalida(true);
      return;
    }
    navigate('/exportaciones/pedidos');
  };

  // ---------------- Guardar ----------------

  const handleGuardar = async () => {
    setErrores([]);

    // Validación mínima en el frontend (el backend valida todo y devuelve el número de línea)
    const faltan = [];
    if (!semanaValida) faltan.push('LA SEMANA DEBE ESTAR ENTRE 1 Y 53 Y EL AÑO SER VÁLIDO.');
    if (totalSemana <= 0) faltan.push('INGRESA EL TOTAL DE CAJAS DE LA SEMANA.');
    else if (!cuadrado) {
      faltan.push(`LAS LÍNEAS SUMAN ${formatoCajas(totalLineas)} CAJAS Y EL TOTAL DE LA SEMANA ES ${formatoCajas(totalSemana)}: ${diferencia > 0 ? 'FALTAN' : 'SOBRAN'} ${formatoCajas(Math.abs(diferencia))} CAJAS.`);
    }
    if (lineas.length === 0) faltan.push('EL PEDIDO DEBE TENER AL MENOS UNA LÍNEA.');
    lineas.forEach((l, i) => {
      if (!l.customer_id) faltan.push(`LÍNEA ${i + 1}: FALTA EL CLIENTE.`);
      else if (!l.brand_id) faltan.push(`LÍNEA ${i + 1}: FALTA LA MARCA.`);
      if (!Number(l.boxes)) faltan.push(`LÍNEA ${i + 1}: FALTAN LAS CAJAS.`);
      if (!l.departure_port_id) faltan.push(`LÍNEA ${i + 1}: FALTA EL PUERTO DE SALIDA.`);
    });
    if (faltan.length) {
      setErrores(faltan);
      return;
    }

    const data = {
      week: Number(cabecera.week),
      year: Number(cabecera.year),
      expected_boxes: totalSemana,
      received_at: cabecera.received_at || null,
      comment: cabecera.comment.trim(),
      lines: lineas.map((l) => ({
        id: l.id,
        customer_id: Number(l.customer_id),
        brand_id: Number(l.brand_id),
        presentation: l.presentation,
        boxes: Number(l.boxes),
        incoterm: l.incoterm,
        cargo_type: l.cargo_type,
        containers_qty: esContenedor(l.cargo_type) ? Number(l.containers_qty) || null : null,
        boxes_per_container: esContenedor(l.cargo_type) ? Number(l.boxes_per_container) || null : null,
        departure_port_id: Number(l.departure_port_id),
        negotiation_type: l.negotiation_type,
        // CONTRATO: el backend pone el precio del contrato; solo SPOT envía precio
        box_price: l.negotiation_type === 'SPOT' && l.box_price !== '' ? Number(l.box_price) : null,
        order_number: l.order_number.trim(),
        notes: l.notes.trim(),
      })),
    };

    setGuardando(true);
    const accion = esEdicion ? 'actualizar' : 'crear';
    try {
      if (esEdicion) {
        await updateCustomerOrder(id, data);
      } else {
        await createCustomerOrder(data);
      }
      setToast({ tipo: 'exito', mensaje: getMensajeExito('pedido', accion) });
      setTimeout(() => navigate('/exportaciones/pedidos'), 1200);
    } catch (err) {
      console.error('ERROR AL GUARDAR EL PEDIDO:', err);
      // 422 de Laravel: { errors: { campo: [mensaje] } } → lista de mensajes
      const erroresBackend = err.response?.data?.errors;
      setErrores(erroresBackend
        ? Object.values(erroresBackend).flat()
        : [err.response?.data?.message || getMensajeError('pedido', accion)]);
      setGuardando(false);
    }
  };

  // ---------------- Vista ----------------

  const inputClass = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5';

  if (cargando) {
    return <div className="p-6 text-gray-400">Cargando pedido...</div>;
  }

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={volver} title="Volver" className="p-2 rounded-lg hover:bg-gray-200 text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {esEdicion ? `Pedido semana ${cabecera.week} / ${cabecera.year}` : 'Nuevo pedido semanal'}
          </h1>
          <p className="text-sm text-gray-500">Registra las líneas tal como llegan en el correo de Rusia</p>
        </div>
      </div>

      {/* Cabecera del pedido */}
      <div className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className={labelClass}>Semana *</label>
          <input type="number" min="1" max="53" name="week" value={cabecera.week} onChange={cambiarCabecera} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Año *</label>
          <input type="number" min="2020" name="year" value={cabecera.year} onChange={cambiarCabecera} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Total cajas semana *</label>
          <input
            type="number" min="1" name="expected_boxes" value={cabecera.expected_boxes}
            onChange={cambiarCabecera} placeholder="Ej: 150000"
            className={`${inputClass} font-semibold`}
          />
          {totalSemana > 0 && <p className="text-xs text-gray-500 mt-1">{formatoCajas(totalSemana)} cajas</p>}
        </div>
        <div>
          <label className={labelClass}>Fecha del correo</label>
          <input type="date" name="received_at" value={cabecera.received_at} onChange={cambiarCabecera} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Comentario</label>
          <input name="comment" value={cabecera.comment} onChange={cambiarCabecera} placeholder="Ej: FALTAN NÚMEROS DE PEDIDO" className={inputClass} />
        </div>
        {lunes && (
          <p className="md:col-span-5 text-xs text-gray-500">
            El precio de CONTRATO se toma del contrato vigente al lunes {lunes.split('-').reverse().join('/')} (inicio de la semana {cabecera.week}), según la marca y la presentación de cada línea.
          </p>
        )}
      </div>

      {/* Líneas del pedido */}
      <div className="bg-white rounded-xl shadow overflow-x-auto mb-4">
        <table className="w-full text-sm min-w-[1550px]">
          <thead className="bg-primario text-white">
            <tr>
              <th className="text-left px-2 py-3 uppercase w-8">#</th>
              <th className="text-left px-2 py-3 uppercase">Cliente</th>
              <th className="text-left px-2 py-3 uppercase">Marca</th>
              <th className="text-left px-2 py-3 uppercase">Presentación</th>
              <th className="text-left px-2 py-3 uppercase">Modalidad</th>
              <th className="text-left px-2 py-3 uppercase">Cont. × cajas</th>
              <th className="text-left px-2 py-3 uppercase">Cajas</th>
              <th className="text-left px-2 py-3 uppercase">Incoterm</th>
              <th className="text-left px-2 py-3 uppercase">Puerto</th>
              <th className="text-left px-2 py-3 uppercase">Tipo</th>
              <th className="text-left px-2 py-3 uppercase">Precio caja</th>
              <th className="text-left px-2 py-3 uppercase">N° pedido</th>
              <th className="text-left px-2 py-3 uppercase">Notas</th>
              <th className="px-2 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const { precio, origen } = precioLinea(l);
              const contenedor = esContenedor(l.cargo_type);
              return (
                <tr key={l._key} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-2 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-2 min-w-[160px]">
                    <SelectBuscable value={l.customer_id} onChange={(e) => cambiarLinea(l._key, 'customer_id', e.target.value)} className={inputClass}>
                      <option value="">SELECCIONAR...</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.third_party?.name}</option>
                      ))}
                    </SelectBuscable>
                  </td>
                  <td className="px-2 py-2 min-w-[160px]">
                    <SelectBuscable value={l.brand_id} onChange={(e) => cambiarLinea(l._key, 'brand_id', e.target.value)} className={inputClass} disabled={!l.customer_id}>
                      <option value="">{l.customer_id && marcasDe(l.customer_id).length === 0 ? 'SIN MARCAS' : 'SELECCIONAR...'}</option>
                      {marcasDe(l.customer_id).map((m) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                    </SelectBuscable>
                  </td>
                  <td className="px-2 py-2 min-w-[175px]">
                    <SelectBuscable value={l.presentation} onChange={(e) => cambiarLinea(l._key, 'presentation', e.target.value)} className={inputClass}>
                      {PRESENTACIONES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </SelectBuscable>
                  </td>
                  <td className="px-2 py-2 min-w-[170px]">
                    <SelectBuscable value={l.cargo_type} onChange={(e) => cambiarLinea(l._key, 'cargo_type', e.target.value)} className={inputClass}>
                      {TIPOS_CARGA.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                    </SelectBuscable>
                  </td>
                  <td className="px-2 py-2 min-w-[150px]">
                    {contenedor ? (
                      <div className="flex items-center gap-1">
                        <input type="number" min="1" value={l.containers_qty} onChange={(e) => cambiarLinea(l._key, 'containers_qty', e.target.value)} placeholder="9" className={inputClass} />
                        <span className="text-gray-400">×</span>
                        <input type="number" min="1" value={l.boxes_per_container} onChange={(e) => cambiarLinea(l._key, 'boxes_per_container', e.target.value)} placeholder="1200" className={inputClass} />
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-2 py-2 min-w-[100px]">
                    {/* En contenedor las cajas se calculan solas */}
                    <input
                      type="number" min="1" value={l.boxes}
                      onChange={(e) => cambiarLinea(l._key, 'boxes', e.target.value)}
                      readOnly={contenedor}
                      title={contenedor ? 'Se calcula: contenedores × cajas por contenedor' : ''}
                      className={`${inputClass} ${contenedor ? 'bg-gray-200 text-gray-500' : ''}`}
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[80px]">
                    <SelectBuscable value={l.incoterm} onChange={(e) => cambiarLinea(l._key, 'incoterm', e.target.value)} className={inputClass}>
                      {INCOTERMS.map((x) => <option key={x} value={x}>{x}</option>)}
                    </SelectBuscable>
                  </td>
                  <td className="px-2 py-2 min-w-[140px]">
                    <SelectBuscable value={l.departure_port_id} onChange={(e) => cambiarLinea(l._key, 'departure_port_id', e.target.value)} className={inputClass}>
                      <option value="">SELECCIONAR...</option>
                      {puertos.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                    </SelectBuscable>
                  </td>
                  <td className="px-2 py-2 min-w-[110px]">
                    <SelectBuscable value={l.negotiation_type} onChange={(e) => cambiarLinea(l._key, 'negotiation_type', e.target.value)} className={inputClass}>
                      <option value="CONTRATO">CONTRATO</option>
                      <option value="SPOT">SPOT</option>
                    </SelectBuscable>
                  </td>
                  <td className="px-2 py-2 min-w-[120px]">
                    {l.negotiation_type === 'SPOT' ? (
                      <input type="number" min="0" step="0.01" value={l.box_price} onChange={(e) => cambiarLinea(l._key, 'box_price', e.target.value)} placeholder="Pendiente" className={inputClass} />
                    ) : origen === 'SIN_CONTRATO' ? (
                      <span className="text-xs font-semibold text-red-600">{l.customer_id ? 'SIN CONTRATO VIGENTE' : '—'}</span>
                    ) : origen === 'SIN_PRECIO' ? (
                      <span className="text-xs font-semibold text-red-600">{l.brand_id ? 'EL CONTRATO NO TIENE PRECIO PARA ESTA MARCA Y PRESENTACIÓN' : 'ELIGE LA MARCA'}</span>
                    ) : (
                      <span className="text-sm font-semibold text-primario" title={origen === 'CONGELADO' ? 'Precio guardado en el pedido' : 'Precio del contrato vigente'}>
                        $ {formatoDinero(precio)}
                        {origen === 'CONGELADO' && <span className="block text-[10px] font-normal text-gray-400">GUARDADO</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 min-w-[110px]">
                    <input value={l.order_number} onChange={(e) => cambiarLinea(l._key, 'order_number', e.target.value.toUpperCase())} placeholder="Después" className={inputClass} />
                  </td>
                  <td className="px-2 py-2 min-w-[160px]">
                    <input value={l.notes} onChange={(e) => cambiarLinea(l._key, 'notes', e.target.value.toUpperCase())} placeholder="Ej: CINTA AZUL" className={inputClass} />
                  </td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => quitarLinea(l._key)} title="Quitar línea" className="text-white p-1.5 rounded-lg shadow-sm transition bg-red-600 hover:bg-red-700">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t bg-gray-50">
          {/* Botón sólido (antes era solo texto azul y no se notaba) */}
          <button type="button" onClick={agregarLinea} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition">
            <Plus size={18} /> Agregar línea
          </button>
        </div>
      </div>

      {/* Resumen por cliente */}
      <div className="bg-white rounded-xl shadow overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-primario-claro text-primario">
            <tr>
              <th className="text-left px-4 py-2 uppercase">Cliente</th>
              <th className="text-right px-4 py-2 uppercase">Contrato</th>
              <th className="text-right px-4 py-2 uppercase">Spot</th>
              <th className="text-right px-4 py-2 uppercase">Total cajas</th>
              <th className="text-right px-4 py-2 uppercase">Monto (USD)</th>
            </tr>
          </thead>
          <tbody>
            {resumen.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-4 text-gray-400">Agrega líneas para ver el resumen</td></tr>
            ) : resumen.map((r) => (
              <tr key={r.customer_id} className="border-t">
                <td className="px-4 py-2 font-medium">{r.nombre}</td>
                <td className="px-4 py-2 text-right">{formatoCajas(r.contrato)}</td>
                <td className="px-4 py-2 text-right">{formatoCajas(r.spot)}</td>
                <td className="px-4 py-2 text-right font-semibold">{formatoCajas(r.contrato + r.spot)}</td>
                <td className="px-4 py-2 text-right">
                  {formatoDinero(r.monto)}
                  {r.sinPrecio > 0 && <span className="block text-xs text-amber-600">{formatoCajas(r.sinPrecio)} cajas sin precio</span>}
                </td>
              </tr>
            ))}
          </tbody>
          {resumen.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2">
              <tr>
                <td className="px-4 py-2 font-bold">TOTAL SEMANA {cabecera.week}</td>
                <td colSpan={2}></td>
                <td className="px-4 py-2 text-right font-bold">{formatoCajas(totalCajas)}</td>
                <td className="px-4 py-2 text-right font-bold">
                  {formatoDinero(totalMonto)}
                  {totalSinPrecio > 0 && <span className="block text-xs font-normal text-amber-600">{formatoCajas(totalSinPrecio)} cajas sin precio</span>}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Cuadre: líneas registradas vs total de la semana */}
      <div className={`rounded-xl border px-4 py-3 mb-4 ${
        totalSemana <= 0 ? 'bg-gray-50 border-gray-200'
          : cuadrado ? 'bg-green-50 border-green-200'
            : diferencia < 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-gray-700">
            Registrado <strong>{formatoCajas(totalLineas)}</strong>
            {totalSemana > 0 && <> de <strong>{formatoCajas(totalSemana)}</strong> cajas</>}
          </span>
          <span className={`font-semibold ${
            totalSemana <= 0 ? 'text-gray-500'
              : cuadrado ? 'text-green-700'
                : diferencia < 0 ? 'text-red-700' : 'text-amber-700'
          }`}>
            {totalSemana <= 0 ? 'INGRESA EL TOTAL DE CAJAS DE LA SEMANA'
              : cuadrado ? '✔ PEDIDO CUADRADO'
                : diferencia > 0 ? `FALTAN ${formatoCajas(diferencia)} CAJAS`
                  : `SOBRAN ${formatoCajas(-diferencia)} CAJAS`}
          </span>
        </div>
        {totalSemana > 0 && (
          <div className="h-2 bg-white rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${cuadrado ? 'bg-green-600' : diferencia < 0 ? 'bg-red-600' : 'bg-amber-500'}`}
              style={{ width: `${avance}%` }}
            />
          </div>
        )}
      </div>

      {/* Errores (frontend o 422 del backend, con número de línea) */}
      {errores.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {errores.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={volver} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-cancelar text-cancelar-texto hover:bg-cancelar-hover transition">
          <X size={16} />
          Cancelar
        </button>
        {/* Solo se guarda cuando las líneas cuadran con el total de la semana */}
        <button type="button" onClick={handleGuardar} disabled={guardando || !cuadrado} title={cuadrado ? '' : 'Las líneas deben sumar el total de cajas de la semana'} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50 disabled:hover:bg-guardar transition">
          <Save size={16} />
          {guardando ? 'Guardando...' : (esEdicion ? 'Guardar cambios' : 'Guardar pedido')}
        </button>
      </div>

      {mostrarConfirmarSalida && (
        <DialogoConfirmacion
          titulo="¿Seguro que deseas salir?"
          textoAceptar="Salir sin guardar"
          textoCancelar="Seguir editando"
          onCancelar={() => setMostrarConfirmarSalida(false)}
          onAceptar={() => navigate('/exportaciones/pedidos')}
        >
          Tienes cambios sin guardar que se perderán.
        </DialogoConfirmacion>
      )}
    </div>
  );
}
