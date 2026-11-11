// Compra de fruta de una semana (Comercial) — por BLOQUES, como la hoja semanal "wk"
// Ubicación: src/pages/comercial/PurchaseAllocationPage.jsx
// Ruta: /comercial/compras/:id   (id = pedido semanal)
//
// 29/10/2026: rehecha según la hoja real de Comercial (wk 37):
//   BLOQUE = barco de la semana (con su viaje) + marca + cliente + modalidad + puerto + META de cajas.
//   Dentro de cada bloque, las compras: a quién se le compra (COMERCIAL o PRODUCTOR directo),
//   productor real (si se compró a un comercial), finca, código MAG, ejecutivo, día de corte,
//   puerto de entrega, cajas, precio oficial/real, CONTRATO/SPOT, forma de pago (100 % / 80-20)
//   y transporte de contenedor negociado (se descuenta en la liquidación).
// La meta del bloque es referencia (se puede pasar, como en la hoja).
// 29/10/2026: se puede comprar para un cliente MÁS de lo pedido (se completa con SPOT para embarcar
// la mayor cantidad de fruta): se avisa en ámbar, no se bloquea. Cada compra lleva la BODEGA donde el
// vendedor retira cartón y materiales (se propone la última que usó). Varios usuarios cargan compras
// durante la semana: se guarda con la "version" del GET y, si otro guardó antes, el backend responde 409.
// 30/10/2026: el precio OFICIAL lo fija el MAG por tipo de caja (Comercial → Precios oficiales MAG): la compra
// nueva lo propone según la caja de la marca y la fecha de corte (o el lunes de la semana). Oficial − real =
// NOTA DE CRÉDITO que debe entregar el vendedor (se muestra por compra y en el total).
// 04/11/2026: la FINCA se elige de una lista con búsqueda con las fincas del productor real (o del vendedor si
// es compra directa); si tiene una sola se pone sola y, si no tiene, "+ NUEVA FINCA" la crea en el catálogo.
// El código MAG no se escribe: sale de la finca (el backend guarda la copia al comprar). Obligatoria en
// compras nuevas; las de antes sin finca se siguen guardando y muestran lo que se escribió.
// 10/11/2026: cada compra guardada se ENVÍA A BODEGA (botón por línea o "Enviar bloque"); solo las enviadas
// salen en Inventario → Por despachar. Las ya enviadas no se repiten; "Quitar envío" mientras no retire nada.
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, X, Lock, ChevronDown, ChevronRight, AlertTriangle, Truck, Undo2 } from 'lucide-react';
import { getOrderPurchases, saveOrderPurchases, createPurchaseFarm, sendPurchasesToWarehouse, unsendPurchase } from '../../api/customerOrders';
import { getThirdParties } from '../../api/thirdParties';
import { getPorts } from '../../api/ports';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import SelectBuscable from '../../components/common/SelectBuscable';
import ModalShell from '../../components/common/ModalShell';
import { PRESENTACIONES, marcaConPresentacion } from '../../utils/presentaciones';
import CampoNumero from '../../components/common/CampoNumero';
import { ETIQUETA_MODALIDAD, MODALIDAD_POR_DEFECTO } from '../../utils/modalidades';

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const formatoDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (v) => Number(v) || 0;
// 10/11/2026: fecha y hora del envío a bodega (dd/mm hh:mm, hora local)
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '');

// 10/11/2026: las 4 modalidades del pedido (antes BAJO CUBIERTA / CONTENEDOR)
const MODALIDADES = ETIQUETA_MODALIDAD;

// 10/11/2026: cada BARCO de la semana con su color suave (cabecera y borde del bloque); los bloques del
// mismo barco comparten color. Tonos distintos a los de las columnas (sin rojo, rosado ni fucsia, a pedido del usuario).
const COLORES_BARCO = [
  { cabecera: 'bg-teal-100', borde: 'border-teal-300', punto: 'bg-teal-400' },
  { cabecera: 'bg-orange-100', borde: 'border-orange-300', punto: 'bg-orange-400' },
  { cabecera: 'bg-indigo-100', borde: 'border-indigo-300', punto: 'bg-indigo-400' },
  { cabecera: 'bg-lime-100', borde: 'border-lime-400', punto: 'bg-lime-500' },
  { cabecera: 'bg-cyan-100', borde: 'border-cyan-300', punto: 'bg-cyan-400' },
  { cabecera: 'bg-yellow-100', borde: 'border-yellow-400', punto: 'bg-yellow-500' },
];
const SIN_BARCO = { cabecera: 'bg-gray-100', borde: 'border-gray-300', punto: 'bg-gray-400' };

const PAGO_POR_TIPO = { CONTRATO: '100', SPOT: '80_20' };

let contador = 0;
const nuevaClave = (p) => `${p}-${++contador}`;
const texto = (v) => (v === null || v === undefined ? '' : String(v));

// Lunes de la semana ISO (fecha con que se busca el precio MAG si la compra no tiene día de corte)
const lunesSemana = (anio, semana) => {
  const d = new Date(Date.UTC(anio, 0, 4));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + (semana - 1) * 7);
  return d.toISOString().slice(0, 10);
};
// Nota de crédito de una compra: cajas × (oficial − real); null si falta algún precio
const notaCredito = (c) => (c.official_price === '' || c.real_price === '' ? null : n(c.boxes) * (n(c.official_price) - n(c.real_price)));

const compraDesdeBackend = (c) => ({
  _key: `c-${c.id}`,
  id: c.id,
  third_party_id: texto(c.third_party_id),
  producer_id: texto(c.producer_id),
  farm_id: texto(c.farm_id),
  farm_name: texto(c.farm_name),
  mag_code: texto(c.mag_code),
  executive: texto(c.executive),
  cut_date: texto(c.cut_date),
  purchase_week: texto(c.purchase_week),
  delivery_port_id: texto(c.delivery_port_id),
  boxes: texto(c.boxes),
  official_price: texto(c.official_price),
  real_price: texto(c.real_price),
  negotiation_type: c.negotiation_type || 'SPOT',
  payment_scheme: c.payment_scheme || '80_20',
  transport_deduction: Number(c.transport_deduction) ? texto(c.transport_deduction) : '',
  // 11/11/2026: transporte que se le reconoce al productor ($/caja, se paga por tarja)
  reconoce_transporte: Number(c.transport_recognized_rate) > 0,
  transport_recognized_rate: Number(c.transport_recognized_rate) ? texto(Number(c.transport_recognized_rate)) : '',
  notes: texto(c.notes),
  pickup_warehouse_id: texto(c.pickup_warehouse_id),
  contract_id: texto(c.contract_id),
  contract_part: String(c.contract_part ?? 0),
  bloqueo: c.quota_status === 'LIQUIDADO' ? 'CUPO LIQUIDADO' : c.con_tarjas ? 'YA TIENE TARJAS' : c.despachada ? 'YA RETIRÓ MATERIALES' : null,
  liquidada: c.quota_status === 'LIQUIDADO',
  despachada: Boolean(c.despachada),
  enviada: c.sent_at || null,
  enviada_por: c.sent_by || '',
  cambio_envio: c.changed_after_sent_at || null,
});

const bloqueDesdeBackend = (b) => ({
  _key: `b-${b.id}`,
  id: b.id,
  shipment_id: texto(b.shipment_id),
  brand_id: texto(b.brand_id),
  presentation: b.presentation || 'CONVENCIONAL',
  customer_id: texto(b.customer_id),
  cargo_mode: b.cargo_mode || MODALIDAD_POR_DEFECTO,
  departure_port_id: texto(b.departure_port_id),
  target_boxes: texto(b.target_boxes),
  notes: texto(b.notes),
  purchases: (b.purchases || []).map(compraDesdeBackend),
});

// Compra nueva: copia ejecutivo, día de corte, puerto y bodega de retiro de la fila anterior; el precio
// oficial es el del MAG (si no hay uno registrado, el de la fila anterior)
const compraVacia = (anterior, puertoBloque, precioMag) => ({
  _key: nuevaClave('c'), id: null,
  third_party_id: '', producer_id: '', farm_id: '', farm_name: '', mag_code: '',
  executive: anterior?.executive || '', cut_date: anterior?.cut_date || '', purchase_week: anterior?.purchase_week || '',
  delivery_port_id: anterior ? anterior.delivery_port_id : puertoBloque,
  boxes: '', official_price: precioMag ? texto(precioMag.price) : (anterior?.official_price || ''), real_price: '',
  negotiation_type: 'SPOT', payment_scheme: '80_20', transport_deduction: '', notes: '',
  reconoce_transporte: false, transport_recognized_rate: '',
  pickup_warehouse_id: anterior?.pickup_warehouse_id || '',
  contract_id: '', contract_part: '0',
  bloqueo: null, liquidada: false,
  despachada: false, enviada: null, enviada_por: '', cambio_envio: null,
});

export default function PurchaseAllocationPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [semanasCompra, setSemanasCompra] = useState([]); // 10/11/2026: la del pedido y la siguiente
  const [clientes, setClientes] = useState([]);
  const [barcos, setBarcos] = useState([]);
  const [bloques, setBloques] = useState([]);
  const [ejecutivos, setEjecutivos] = useState([]);
  const [inicial, setInicial] = useState(null);
  const [abiertos, setAbiertos] = useState({}); // { _key: true }
  const [version, setVersion] = useState(null); // huella de lo guardado (control de cambios simultáneos)
  const [bodegas, setBodegas] = useState([]);
  const [ultimaBodega, setUltimaBodega] = useState({}); // { third_party_id: warehouse_id }
  const [preciosMag, setPreciosMag] = useState([]); // precios oficiales MAG activos
  const [fincas, setFincas] = useState([]); // fincas del catálogo (activas + las ya usadas)
  const [contratos, setContratos] = useState([]); // 06/11/2026: contratos de los vendedores (Liquidaciones → Contratos y retención)
  const [nuevaFinca, setNuevaFinca] = useState(null); // { bKey, cKey, third_party_id, dueno, name, magap_code, zone }
  const [errorFinca, setErrorFinca] = useState('');
  const [guardandoFinca, setGuardandoFinca] = useState(false);

  const [vendedores, setVendedores] = useState([]);
  const [puertosSalida, setPuertosSalida] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState([]);
  const [toast, setToast] = useState(null);
  const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [quitarEnvio, setQuitarEnvio] = useState(null); // compra a la que se le quita el envío
  const semanaDeCompra = (c) => Number(c.purchase_week) || pedido?.week;

  const aplicarRespuesta = (data) => {
    setPedido(data.order);
    setSemanasCompra(data.purchase_weeks || []);
    setClientes(data.customers);
    setBarcos(data.shipments);
    setEjecutivos(data.executives || []);
    setBodegas(data.warehouses || []);
    setUltimaBodega(data.last_pickup || {});
    setPreciosMag(data.official_prices || []);
    setFincas(data.farms || []);
    setContratos(data.contracts || []);
    setVersion(data.version);
    const lista = data.blocks.map(bloqueDesdeBackend);
    setBloques(lista);
    setInicial(JSON.stringify(lista));
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        const [resCompras, resTerceros, resPuertos] = await Promise.all([
          getOrderPurchases(id),
          getThirdParties({ status: true }),
          getPorts({ status: true, port_type: 'SALIDA' }),
        ]);
        aplicarRespuesta(resCompras.data);
        const terceros = Array.isArray(resTerceros.data) ? resTerceros.data : [];
        setVendedores(terceros.filter((t) => ['PRODUCTOR', 'COMERCIALIZADORA'].includes(t.type)));
        setPuertosSalida(Array.isArray(resPuertos.data) ? resPuertos.data : []);
      } catch (err) {
        console.error('ERROR AL CARGAR LAS COMPRAS:', err);
        setErrores(['NO SE PUDIERON CARGAR LAS COMPRAS DE ESTA SEMANA.']);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [id]);

  // ---------------- Cálculos ----------------

  const compradoBloque = (b) => b.purchases.reduce((s, c) => s + n(c.boxes), 0);
  const compradoCliente = (clienteId) => bloques
    .filter((b) => b.customer_id === String(clienteId))
    .reduce((s, b) => s + compradoBloque(b), 0);
  const todas = bloques.flatMap((b) => b.purchases);
  const totalPedido = clientes.reduce((s, c) => s + c.pedido, 0);
  const totalComprado = todas.reduce((s, c) => s + n(c.boxes), 0);
  const totalReal = todas.reduce((s, c) => s + n(c.boxes) * n(c.real_price), 0);
  const totalTransporte = todas.reduce((s, c) => s + n(c.transport_deduction), 0);
  const totalNotaCredito = todas.reduce((s, c) => s + (notaCredito(c) || 0), 0);
  const hayExceso = clientes.some((c) => compradoCliente(c.id) > c.pedido);
  const avance = totalPedido ? Math.min(100, (totalComprado / totalPedido) * 100) : 0;

  const productores = vendedores.filter((v) => v.type === 'PRODUCTOR');
  const comercializadoras = vendedores.filter((v) => v.type === 'COMERCIALIZADORA');
  const tipoDe = (tpId) => vendedores.find((v) => String(v.id) === tpId)?.type;
  const colorBarco = (shipId) => {
    const i = barcos.findIndex((x) => String(x.id) === String(shipId));
    return i < 0 ? SIN_BARCO : COLORES_BARCO[i % COLORES_BARCO.length];
  };
  const nombreBarco = (shipId) => {
    const b = barcos.find((x) => String(x.id) === String(shipId));
    const nombre = b?.vessel?.name || b?.vessel_name || '';
    // El nombre del barco ya puede traer el viaje (DITLEV UNI1402): no se repite
    return b ? `${nombre}${b.voyage && !nombre.includes(b.voyage) ? ` · ${b.voyage}` : ''}` : '—';
  };

  // La finca es del productor real; en compra directa, del vendedor
  const duenoFinca = (c) => c.producer_id || c.third_party_id;
  const fincasDe = (tpId, actual) => fincas.filter((f) => String(f.third_party_id) === String(tpId) && (f.status || String(f.id) === String(actual)));
  const conFinca = (c, finca) => ({ ...c, farm_id: finca ? String(finca.id) : '', farm_name: finca?.name || '', mag_code: finca?.magap_code || '' });

  // 06/11/2026: contratos del vendedor (activos + el que ya tiene la compra) y cajas compradas por contrato
  // en esta semana (el cupo es semanal; pasarse solo avisa)
  // 11/11/2026: solo los vigentes en la semana de compra de la línea (el que ya tiene la compra siempre se ve)
  const rangoSemana = (c) => {
    const w = semanasCompra.find((x) => x.week === semanaDeCompra(c)) || { year: pedido?.year, week: pedido?.week };
    if (!w.year || !w.week) return null;
    const lunes = lunesSemana(w.year, w.week);
    const d = new Date(`${lunes}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 6);
    return { lunes, domingo: d.toISOString().slice(0, 10) };
  };
  const vigenteEn = (k, c) => {
    const r = rangoSemana(c);
    return !r || ((!k.start_date || k.start_date <= r.domingo) && (!k.end_date || k.end_date >= r.lunes));
  };
  const contratosDe = (c, actual) => contratos.filter((k) => String(k.third_party_id) === String(c.third_party_id)
    && ((k.status && vigenteEn(k, c)) || String(k.id) === String(actual)));
  const cajasContrato = (contratoId) => todas.filter((x) => x.negotiation_type === 'CONTRATO' && x.contract_id === String(contratoId)).reduce((s, x) => s + n(x.boxes), 0);
  // Al cambiar vendedor o pasar a CONTRATO: si el vendedor tiene un solo contrato, se elige solo
  const conContrato = (c) => {
    if (c.negotiation_type !== 'CONTRATO') return { ...c, contract_id: '', contract_part: '0' };
    const propios = contratosDe(c).filter((k) => k.status);
    if (propios.some((k) => String(k.id) === c.contract_id)) return c;
    return { ...c, contract_id: propios.length === 1 ? String(propios[0].id) : '', contract_part: '0' };
  };

  // Precio MAG vigente para la marca del bloque (según su tipo de caja) en la fecha de corte
  const precioMagDe = (b, c) => {
    const marca = clientes.flatMap((x) => x.brands).find((m) => String(m.id) === b.brand_id);
    if (!marca?.box_type_id || !pedido) return null;
    const fecha = c?.cut_date || lunesSemana(pedido.year, pedido.week);
    return preciosMag.find((p) => p.box_type_id === marca.box_type_id && p.valid_from <= fecha && (!p.valid_to || p.valid_to >= fecha)) || null;
  };

  // ---------------- Cambios ----------------

  const cambiarBloque = (key, campo, valor) => {
    setBloques((prev) => prev.map((b) => {
      if (b._key !== key) return b;
      const nuevo = { ...b, [campo]: valor };
      // PACKED: todas sus compras pasan a SPOT (las liquidadas no se tocan; el backend avisa)
      if (campo === 'presentation' && valor === 'PACKED') {
        nuevo.purchases = b.purchases.map((c) => (c.liquidada || c.negotiation_type === 'SPOT' ? c
          : { ...c, negotiation_type: 'SPOT', payment_scheme: PAGO_POR_TIPO.SPOT, contract_id: '', contract_part: '0' }));
      }
      if (campo === 'customer_id') {
        const marcas = clientes.find((x) => String(x.id) === valor)?.brands || [];
        nuevo.brand_id = marcas.length === 1 ? String(marcas[0].id) : '';
      }
      // El puerto del barco se propone como puerto del bloque
      if (campo === 'shipment_id' && !b.departure_port_id) {
        nuevo.departure_port_id = texto(barcos.find((x) => String(x.id) === valor)?.departure_port_id);
      }
      return nuevo;
    }));
  };

  const cambiarCompra = (bKey, cKey, campo, valor) => {
    setBloques((prev) => prev.map((b) => (b._key !== bKey ? b : {
      ...b,
      purchases: b.purchases.map((c) => {
        if (c._key !== cKey) return c;
        let nueva = { ...c, [campo]: valor };
        if (campo === 'negotiation_type') nueva.payment_scheme = PAGO_POR_TIPO[valor];
        // 11/11/2026: también al cambiar la semana de compra (el contrato debe estar vigente en esa semana)
        if (campo === 'negotiation_type' || campo === 'third_party_id' || campo === 'purchase_week') nueva = conContrato(nueva);
        if (campo === 'contract_id') nueva.contract_part = '0';
        // Al elegir el contrato se propone su precio (si todavía no hay precio real)
        if (campo === 'contract_id' && c.real_price === '') {
          const k = contratos.find((x) => String(x.id) === valor);
          if (k?.price) nueva.real_price = texto(k.price);
        }
        // Si se le compra directo a un productor, no hay "productor real" aparte
        if (campo === 'third_party_id' && tipoDe(valor) === 'PRODUCTOR') nueva.producer_id = '';
        // Al elegir vendedor se propone la última bodega donde retiró materiales
        if (campo === 'third_party_id' && ultimaBodega[valor]) nueva.pickup_warehouse_id = String(ultimaBodega[valor]);
        if (campo === 'third_party_id' || campo === 'producer_id') {
          const propias = fincasDe(duenoFinca(nueva)).filter((x) => x.status);
          return conFinca(nueva, propias.length === 1 ? propias[0] : null);
        }
        if (campo === 'farm_id') return conFinca(nueva, fincas.find((x) => String(x.id) === valor));
        return nueva;
      }),
    })));
  };

  const agregarBloque = () => {
    const barco = barcos[0];
    const cliente = clientes[0];
    const marcas = cliente?.brands || [];
    const key = nuevaClave('b');
    setBloques((prev) => [...prev, {
      _key: key, id: null,
      shipment_id: barco ? String(barco.id) : '',
      brand_id: marcas.length === 1 ? String(marcas[0].id) : '',
      presentation: 'CONVENCIONAL',
      customer_id: cliente ? String(cliente.id) : '',
      cargo_mode: MODALIDAD_POR_DEFECTO,
      departure_port_id: texto(barco?.departure_port_id),
      target_boxes: '', notes: '', purchases: [],
    }]);
    setAbiertos((prev) => ({ ...prev, [key]: true }));
  };

  const quitarBloque = (key) => setBloques((prev) => prev.filter((b) => b._key !== key));

  const agregarCompra = (bKey) => {
    setBloques((prev) => prev.map((b) => (b._key !== bKey ? b : {
      ...b,
      purchases: [...b.purchases, compraVacia(b.purchases[b.purchases.length - 1], b.departure_port_id, precioMagDe(b, b.purchases[b.purchases.length - 1]))],
    })));
  };

  const quitarCompra = (bKey, cKey) => {
    setBloques((prev) => prev.map((b) => (b._key !== bKey ? b : { ...b, purchases: b.purchases.filter((c) => c._key !== cKey) })));
  };

  const hayCambios = () => inicial !== null && inicial !== JSON.stringify(bloques);
  const volver = () => (hayCambios() ? setMostrarConfirmarSalida(true) : navigate('/comercial/compras'));

  // ---------------- Guardar ----------------

  const handleGuardar = async () => {
    setErrores([]);
    const faltan = [];
    bloques.forEach((b, i) => {
      if (!b.shipment_id || !b.customer_id || !b.brand_id) faltan.push(`BLOQUE ${i + 1}: ELIGE BARCO, CLIENTE Y MARCA.`);
      b.purchases.forEach((c, j) => {
        if (!c.third_party_id) faltan.push(`BLOQUE ${i + 1}, COMPRA ${j + 1}: FALTA A QUIÉN SE LE COMPRA.`);
        if (!n(c.boxes)) faltan.push(`BLOQUE ${i + 1}, COMPRA ${j + 1}: FALTAN LAS CAJAS.`);
        if (!c.id && !c.farm_id) {
          faltan.push(tipoDe(c.third_party_id) === 'COMERCIALIZADORA' && !c.producer_id
            ? `BLOQUE ${i + 1}, COMPRA ${j + 1}: ELIGE EL PRODUCTOR REAL Y SU FINCA.`
            : `BLOQUE ${i + 1}, COMPRA ${j + 1}: FALTA LA FINCA.`);
        }
        // 10/11/2026: obligatoria en las compras nuevas; las históricas se cargaron sin bodega
        if (!c.id && !c.pickup_warehouse_id) faltan.push(`BLOQUE ${i + 1}, COMPRA ${j + 1}: FALTA LA BODEGA DONDE RETIRA LOS MATERIALES.`);
        if (c.negotiation_type === 'CONTRATO' && !c.contract_id && contratosDe(c).some((k) => k.status)) {
          faltan.push(`BLOQUE ${i + 1}, COMPRA ${j + 1}: ELIGE QUÉ CONTRATO DEL VENDEDOR ES.`);
        }
        if (c.reconoce_transporte && !n(c.transport_recognized_rate)) {
          faltan.push(`BLOQUE ${i + 1}, COMPRA ${j + 1}: ESCRIBE CUÁNTO SE LE RECONOCE DE TRANSPORTE POR CAJA.`);
        }
      });
    });
    if (faltan.length) {
      setErrores(faltan);
      return;
    }

    const num = (v) => (v === '' ? null : Number(v));
    setGuardando(true);
    try {
      const res = await saveOrderPurchases(id, {
        version,
        blocks: bloques.map((b) => ({
          id: b.id,
          shipment_id: Number(b.shipment_id),
          brand_id: Number(b.brand_id),
          presentation: b.presentation,
          customer_id: Number(b.customer_id),
          cargo_mode: b.cargo_mode,
          departure_port_id: num(b.departure_port_id),
          target_boxes: n(b.target_boxes),
          notes: b.notes || null,
          purchases: b.purchases.map((c) => ({
            id: c.id,
            third_party_id: Number(c.third_party_id),
            producer_id: num(c.producer_id),
            farm_id: num(c.farm_id),
            executive: c.executive || null,
            cut_date: c.cut_date || null,
            purchase_week: num(c.purchase_week),
            delivery_port_id: num(c.delivery_port_id),
            boxes: Number(c.boxes),
            official_price: num(c.official_price),
            real_price: num(c.real_price),
            negotiation_type: c.negotiation_type,
            payment_scheme: c.payment_scheme,
            transport_deduction: n(c.transport_deduction),
            transport_recognized_rate: c.reconoce_transporte ? num(c.transport_recognized_rate) : null,
            notes: c.notes || null,
            pickup_warehouse_id: num(c.pickup_warehouse_id),
            contract_id: c.negotiation_type === 'CONTRATO' ? num(c.contract_id) : null,
            contract_part: c.negotiation_type === 'CONTRATO' ? Number(c.contract_part || 0) : 0,
          })),
        })),
      });
      aplicarRespuesta(res.data);
      setToast({ tipo: 'exito', mensaje: 'Compras guardadas correctamente' });
    } catch (err) {
      console.error('ERROR AL GUARDAR LAS COMPRAS:', err);
      const e = err.response?.data?.errors;
      setErrores(e ? Object.values(e).flat() : [err.response?.data?.message || 'Error al guardar las compras']);
    } finally {
      setGuardando(false);
    }
  };

  // ---------------- Enviar a bodega (10/11/2026) ----------------

  // Se envía lo GUARDADO: con cambios pendientes, primero hay que guardar
  const enviarABodega = async (ids) => {
    if (hayCambios()) {
      setErrores(['GUARDA LOS CAMBIOS ANTES DE ENVIAR A BODEGA.']);
      return;
    }
    setErrores([]);
    setEnviando(true);
    try {
      const { data } = await sendPurchasesToWarehouse(id, ids);
      aplicarRespuesta(data);
      const partes = [data.enviadas === 1 ? '1 compra enviada a bodega' : `${data.enviadas} compras enviadas a bodega`];
      if (data.ya_enviadas) partes.push(`${data.ya_enviadas} ya estaban enviadas`);
      setToast({ tipo: data.enviadas ? 'exito' : 'error', mensaje: partes.join(' · ') });
    } catch (err) {
      const e = err.response?.data?.errors;
      setErrores(e ? Object.values(e).flat() : [err.response?.data?.message || 'NO SE PUDO ENVIAR A BODEGA.']);
    } finally {
      setEnviando(false);
    }
  };

  const confirmarQuitarEnvio = async () => {
    const c = quitarEnvio;
    setQuitarEnvio(null);
    if (hayCambios()) {
      setErrores(['GUARDA LOS CAMBIOS ANTES DE QUITAR EL ENVÍO.']);
      return;
    }
    setErrores([]);
    setEnviando(true);
    try {
      const { data } = await unsendPurchase(id, c.id);
      aplicarRespuesta(data);
      setToast({ tipo: 'exito', mensaje: 'Envío a bodega quitado' });
    } catch (err) {
      const e = err.response?.data?.errors;
      setErrores(e ? Object.values(e).flat() : [err.response?.data?.message || 'NO SE PUDO QUITAR EL ENVÍO.']);
    } finally {
      setEnviando(false);
    }
  };

  const abrirNuevaFinca = (bKey, c) => {
    const duenoId = duenoFinca(c);
    setErrorFinca('');
    setNuevaFinca({ bKey, cKey: c._key, third_party_id: duenoId, dueno: vendedores.find((v) => String(v.id) === String(duenoId))?.name || '', name: '', magap_code: '', zone: '' });
  };

  const guardarNuevaFinca = async (e) => {
    e.preventDefault();
    if (!nuevaFinca.name.trim()) { setErrorFinca('ESCRIBE EL NOMBRE DE LA FINCA.'); return; }
    setGuardandoFinca(true);
    try {
      const { data } = await createPurchaseFarm(id, {
        third_party_id: Number(nuevaFinca.third_party_id),
        name: nuevaFinca.name, magap_code: nuevaFinca.magap_code || null, zone: nuevaFinca.zone || null,
      });
      setFincas((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setBloques((prev) => prev.map((b) => (b._key !== nuevaFinca.bKey ? b : {
        ...b, purchases: b.purchases.map((c) => (c._key === nuevaFinca.cKey ? conFinca(c, data) : c)),
      })));
      setNuevaFinca(null);
      setToast({ tipo: 'exito', mensaje: `Finca ${data.name} creada` });
    } catch (err) {
      const errs = err.response?.data?.errors;
      setErrorFinca(errs ? Object.values(errs).flat().join(' ') : err.response?.data?.message || 'NO SE PUDO CREAR LA FINCA.');
    } finally {
      setGuardandoFinca(false);
    }
  };

  // ---------------- Vista ----------------

  const inputClass = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario disabled:opacity-60';
  const th = 'text-left px-2 py-2 uppercase text-xs whitespace-nowrap';
  const etiqueta = 'block text-xs font-semibold text-gray-600 uppercase mb-1';

  if (cargando) return <div className="p-6 text-gray-400">Cargando compras...</div>;
  if (!pedido) {
    return <div className="p-6">{errores.map((e) => <p key={e} className="text-red-600 text-sm">{e}</p>)}</div>;
  }

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />
      <datalist id="ejecutivos">{ejecutivos.map((e) => <option key={e} value={e} />)}</datalist>

      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-4">
        <button type="button" onClick={volver} title="Volver" className="p-2 rounded-lg hover:bg-gray-200 text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Compra de fruta — Semana {pedido.week} / {pedido.year}</h1>
          <p className="text-sm text-gray-500">Bloques por barco y marca con su meta; dentro, las compras a comerciales y productores</p>
        </div>
      </div>

      {/* Avance */}
      <div className={`rounded-xl border px-4 py-3 mb-4 ${hayExceso ? 'bg-amber-50 border-amber-300' : avance >= 100 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-gray-700">
            Comprado <strong>{formatoCajas(totalComprado)}</strong> de <strong>{formatoCajas(totalPedido)}</strong> cajas · Total real <strong>$ {formatoDinero(totalReal)}</strong>
            {totalTransporte > 0 && <> · Transporte a descontar <strong>$ {formatoDinero(totalTransporte)}</strong></>}
            {totalNotaCredito !== 0 && <> · Notas de crédito a recibir <strong>$ {formatoDinero(totalNotaCredito)}</strong></>}
          </span>
          <span className={`font-semibold ${hayExceso ? 'text-amber-800' : avance >= 100 ? 'text-green-700' : 'text-amber-700'}`}>
            {hayExceso ? '⚠ HAY CLIENTES CON MÁS CAJAS QUE LAS PEDIDAS (SE PERMITE: SE COMPLETA CON SPOT)'
              : avance >= 100 ? '✔ COMPRA COMPLETA' : `FALTAN ${formatoCajas(totalPedido - totalComprado)} CAJAS POR COMPRAR`}
          </span>
        </div>
        <div className="h-2 bg-white rounded-full mt-2 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${hayExceso ? 'bg-amber-600' : avance >= 100 ? 'bg-green-600' : 'bg-amber-500'}`} style={{ width: `${avance}%` }} />
        </div>
      </div>

      {/* Resumen por cliente */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {clientes.map((c) => {
          const comprado = compradoCliente(c.id);
          const falta = c.pedido - comprado;
          return (
            <div key={c.id} className="bg-white rounded-xl shadow p-4">
              <p className="font-bold text-gray-800">{c.name}</p>
              <p className="text-xs text-gray-500 mb-2">Marcas: {c.brands.map((b) => b.name).join(', ') || <span className="text-red-600">SIN MARCAS (asígnalas en Configuración → Terceros)</span>}</p>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div><p className="text-[10px] text-gray-500 uppercase">Pedido</p><p className="font-semibold">{formatoCajas(c.pedido)}</p></div>
                <div><p className="text-[10px] text-gray-500 uppercase">Comprado</p><p className="font-semibold text-primario">{formatoCajas(comprado)}</p></div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">{falta < 0 ? 'De más' : 'Falta'}</p>
                  <p className={`font-semibold ${falta < 0 ? 'text-amber-800' : falta === 0 ? 'text-green-700' : 'text-amber-700'}`}>{falta === 0 ? '✔' : falta < 0 ? `+${formatoCajas(-falta)}` : formatoCajas(falta)}</p>
                </div>
              </div>
              {falta < 0 && <p className="text-[11px] text-amber-800 mt-2">Se compran {formatoCajas(-falta)} cajas más de lo pedido.</p>}
              {(c.pedido_detalle || []).length > 0 && (
                <div className="mt-2 border-t pt-2 space-y-0.5">
                  {c.pedido_detalle.map((d) => {
                    const marca = c.brands.find((m) => m.id === d.brand_id);
                    const compradoDe = bloques.filter((b) => b.customer_id === String(c.id) && b.brand_id === String(d.brand_id) && b.presentation === d.presentation)
                      .reduce((s, b) => s + compradoBloque(b), 0);
                    return (
                      <p key={`${d.brand_id}|${d.presentation}`} className="flex justify-between text-xs text-gray-600">
                        <span>{marca?.name || 'SIN MARCA'} {d.presentation}</span>
                        <span><strong className="text-primario">{formatoCajas(compradoDe)}</strong> / {formatoCajas(d.cajas)}</span>
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {barcos.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3 mb-4">
          <AlertTriangle size={16} /> Esta semana aún no tiene barcos. Logística debe armarlos en <strong>Exportaciones → Distribución en barcos</strong>.
        </div>
      )}

      {/* 10/11/2026: leyenda de colores por barco */}
      {barcos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <span className="font-semibold text-gray-500 uppercase">Barcos de la semana:</span>
          {barcos.map((x) => (
            <span key={x.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${colorBarco(x.id).cabecera} ${colorBarco(x.id).borde}`}>
              <span className={`w-2 h-2 rounded-full ${colorBarco(x.id).punto}`} />
              {nombreBarco(x.id)}
            </span>
          ))}
        </div>
      )}

      {/* Bloques */}
      <div className="space-y-3 mb-4">
        {bloques.map((b, i) => {
          const abierto = abiertos[b._key];
          const comprado = compradoBloque(b);
          const meta = n(b.target_boxes);
          const falta = meta - comprado;
          const marcas = clientes.find((x) => String(x.id) === b.customer_id)?.brands || [];
          const marcaNombre = marcas.find((m) => String(m.id) === b.brand_id)?.name || 'SIN MARCA';
          const clienteNombre = clientes.find((x) => String(x.id) === b.customer_id)?.name || 'SIN CLIENTE';
          const tieneBloqueadas = b.purchases.some((c) => c.bloqueo);
          // Compras guardadas que faltan enviar a bodega (las liquidadas ya no se envían)
          const porEnviar = b.purchases.filter((c) => c.id && !c.enviada && !c.liquidada);
          const porSemana = semanasCompra.map((w) => ({ week: w.week, cajas: b.purchases.filter((c) => semanaDeCompra(c) === w.week).reduce((t, c) => t + n(c.boxes), 0) }));
          const conSiguiente = porSemana.some((w) => w.week !== pedido.week && w.cajas > 0);
          return (
            <div key={b._key} className={`bg-white rounded-xl shadow overflow-hidden border-l-8 ${colorBarco(b.shipment_id).borde}`}
              title={!meta ? 'Sin meta' : falta === 0 ? 'Meta cumplida' : falta > 0 ? `Faltan ${formatoCajas(falta)} cajas` : `${formatoCajas(-falta)} cajas sobre la meta`}>
              {/* Cabecera del bloque (como la fila de título de la hoja) */}
              <div className={`flex flex-wrap items-center gap-3 px-4 py-3 border-b ${colorBarco(b.shipment_id).cabecera}`}>
                <button type="button" onClick={() => setAbiertos((p) => ({ ...p, [b._key]: !abierto }))} className="text-primario" title={abierto ? 'Cerrar' : 'Abrir'}>
                  {abierto ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>
                <div className="flex-1 min-w-[260px] cursor-pointer" onClick={() => setAbiertos((p) => ({ ...p, [b._key]: !abierto }))}>
                  <p className="font-bold text-gray-800">{i + 1}. {marcaConPresentacion(marcaNombre, b.presentation)} · {nombreBarco(b.shipment_id)}</p>
                  <p className="text-xs text-gray-600">
                    {clienteNombre} · {MODALIDADES[b.cargo_mode]} · {puertosSalida.find((p) => String(p.id) === b.departure_port_id)?.name || 'SIN PUERTO'} · {b.purchases.length} compras
                    {conSiguiente && <span className="ml-1 font-semibold text-sky-800">· {porSemana.map((w) => `COMPRA WK${w.week}: ${formatoCajas(w.cajas)}`).join(' · ')}</span>}
                  </p>
                </div>
                <div className="flex gap-4 text-sm text-center">
                  <div><p className="text-[10px] text-gray-500 uppercase">Meta</p><p className="font-semibold">{formatoCajas(meta)}</p></div>
                  <div><p className="text-[10px] text-gray-500 uppercase">Comprado</p><p className="font-semibold text-primario">{formatoCajas(comprado)}</p></div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Falta</p>
                    <p className={`font-semibold ${falta < 0 ? 'text-red-600' : falta === 0 ? 'text-green-700' : 'text-amber-700'}`}>{falta === 0 ? '✔' : formatoCajas(falta)}</p>
                  </div>
                </div>
                {porEnviar.length > 0 && (
                  <button type="button" onClick={() => enviarABodega(porEnviar.map((c) => c.id))} disabled={enviando}
                    title="Envía a bodega las compras guardadas de este bloque que faltan (las ya enviadas no se repiten)"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50 transition">
                    <Truck size={14} /> Enviar bloque a bodega ({porEnviar.length})
                  </button>
                )}
                <button type="button" onClick={() => quitarBloque(b._key)} disabled={tieneBloqueadas} title={tieneBloqueadas ? 'Tiene compras con materiales, tarjas o liquidadas' : 'Quitar bloque'} className="text-white p-1.5 rounded-lg shadow-sm bg-red-600 hover:bg-red-700 disabled:opacity-40">
                  <Trash2 size={16} />
                </button>
              </div>

              {abierto && (
                <div className="p-4">
                  {/* Datos del bloque */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4 text-sm">
                    <div>
                      <label className={etiqueta}>Barco *</label>
                      <SelectBuscable value={b.shipment_id} onChange={(e) => cambiarBloque(b._key, 'shipment_id', e.target.value)} className={inputClass}>
                        <option value="">SELECCIONAR...</option>
                        {barcos.map((x) => <option key={x.id} value={String(x.id)}>{nombreBarco(x.id)}</option>)}
                      </SelectBuscable>
                    </div>
                    <div>
                      <label className={etiqueta}>Cliente *</label>
                      <SelectBuscable value={b.customer_id} onChange={(e) => cambiarBloque(b._key, 'customer_id', e.target.value)} disabled={tieneBloqueadas} className={inputClass}>
                        <option value="">SELECCIONAR...</option>
                        {clientes.map((x) => <option key={x.id} value={String(x.id)}>{x.name}</option>)}
                      </SelectBuscable>
                    </div>
                    <div>
                      <label className={etiqueta}>Marca *</label>
                      <SelectBuscable value={b.brand_id} onChange={(e) => cambiarBloque(b._key, 'brand_id', e.target.value)} disabled={tieneBloqueadas || !b.customer_id} className={inputClass}>
                        <option value="">{marcas.length ? 'SELECCIONAR...' : 'SIN MARCAS'}</option>
                        {marcas.map((m) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                      </SelectBuscable>
                    </div>
                    <div>
                      <label className={etiqueta}>Presentación *</label>
                      <SelectBuscable value={b.presentation} onChange={(e) => cambiarBloque(b._key, 'presentation', e.target.value)} className={inputClass}>
                        {PRESENTACIONES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </SelectBuscable>
                    </div>
                    <div>
                      <label className={etiqueta}>Modalidad</label>
                      <SelectBuscable value={b.cargo_mode} onChange={(e) => cambiarBloque(b._key, 'cargo_mode', e.target.value)} className={inputClass}>
                        {Object.entries(MODALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </SelectBuscable>
                    </div>
                    <div>
                      <label className={etiqueta}>Puerto</label>
                      <SelectBuscable value={b.departure_port_id} onChange={(e) => cambiarBloque(b._key, 'departure_port_id', e.target.value)} className={inputClass}>
                        <option value="">—</option>
                        {puertosSalida.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                      </SelectBuscable>
                    </div>
                    <div>
                      <label className={etiqueta}>Meta (cajas)</label>
                      <CampoNumero decimales={0} value={b.target_boxes} onChange={(e) => cambiarBloque(b._key, 'target_boxes', e.target.value)} placeholder="EJ. 13200" className={`${inputClass} text-right`} />
                    </div>
                  </div>

                  {/* Compras del bloque */}
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm min-w-[2340px]">
                      <thead className="bg-primario text-white">
                        <tr>
                          <th className={`${th} sticky left-0 z-20 bg-primario w-9 min-w-[36px]`}>#</th>
                          <th className={`${th} sticky left-9 z-20 bg-primario`}>Se le compra a *</th>
                          <th className={th}>Productor real</th>
                          <th className={th}>Finca</th>
                          <th className={th}>MAG</th>
                          <th className={th}>Ejecutivo</th>
                          <th className={th} title="Semana de compra: lo que llega al puerto hasta el domingo. Si la nave se queda a la semana siguiente, elige esa semana: se liquida y cuenta en el contrato ahí">Día corte · Semana</th>
                          <th className={th}>Entrega en</th>
                          <th className={th}>Retira materiales en *</th>
                          <th className={`${th} text-right`}>Cajas *</th>
                          <th className={`${th} text-right`}>P. oficial</th>
                          <th className={`${th} text-right`}>P. real</th>
                          <th className={th}>Tipo · Pago</th>
                          <th className={`${th} text-right`} title="Arriba: transporte que se le descuenta (monto). Abajo: transporte que se le reconoce por caja, según tarja">Transp. $</th>
                          <th className={`${th} text-right`}>Total real</th>
                          <th className={`${th} text-right`} title="Cajas × (precio oficial − precio real): la entrega el vendedor">Nota créd. $</th>
                          <th className={th}>Notas</th>
                          <th className={th}>Bodega</th>
                          <th className="px-2 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.purchases.length === 0 ? (
                          <tr><td colSpan={19} className="text-center py-5 text-gray-400">Agrega la primera compra de este bloque</td></tr>
                        ) : b.purchases.map((c, j) => {
                          const fijo = Boolean(c.bloqueo);
                          const esComercial = tipoDe(c.third_party_id) === 'COMERCIALIZADORA';
                          const cambiar = (campo) => (e) => cambiarCompra(b._key, c._key, campo, e.target.value);
                          const mayus = (campo) => (e) => cambiarCompra(b._key, c._key, campo, e.target.value.toUpperCase());
                          const mag = precioMagDe(b, c);
                          const nc = notaCredito(c);
                          return (
                            <tr key={c._key} className={j % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                              <td className="sticky left-0 z-10 bg-inherit w-9 min-w-[36px] px-2 py-1.5 text-gray-400">{j + 1}</td>
                              <td className="sticky left-9 z-10 bg-inherit shadow-[2px_0_0_#e5e7eb] px-2 py-1.5 min-w-[220px]">
                                <SelectBuscable value={c.third_party_id} onChange={cambiar('third_party_id')} disabled={fijo} className={`${inputClass} ${c.third_party_id ? '' : 'ring-1 ring-amber-400'}`}>
                                  <option value="">SELECCIONAR...</option>
                                  <optgroup label="COMERCIALES / COMERCIALIZADORAS">
                                    {comercializadoras.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
                                  </optgroup>
                                  <optgroup label="PRODUCTORES (COMPRA DIRECTA)">
                                    {productores.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
                                  </optgroup>
                                </SelectBuscable>
                                {fijo && <span className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5"><Lock size={10} /> {c.bloqueo}</span>}
                              </td>
                              <td className="px-2 py-1.5 min-w-[200px]">
                                <SelectBuscable value={c.producer_id} onChange={cambiar('producer_id')} disabled={!esComercial || c.liquidada} title={esComercial ? 'Productor que realmente cosecha' : 'Compra directa al productor'} className={inputClass}>
                                  <option value="">{esComercial ? '—' : 'COMPRA DIRECTA'}</option>
                                  {productores.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
                                </SelectBuscable>
                              </td>
                              <td className="px-2 py-1.5 min-w-[190px]">
                                <SelectBuscable value={c.farm_id}
                                  onChange={(e) => (e.target.value === '__nueva' ? abrirNuevaFinca(b._key, c) : cambiarCompra(b._key, c._key, 'farm_id', e.target.value))}
                                  disabled={c.liquidada || !duenoFinca(c)}
                                  title={!duenoFinca(c) ? 'Elige primero a quién se le compra' : 'Fincas del productor real (o del vendedor si es compra directa)'}
                                  className={`${inputClass} ${!c.farm_id && !c.liquidada && duenoFinca(c) ? 'ring-1 ring-amber-400' : ''}`}>
                                  <option value="">{c.farm_name && !c.farm_id ? `${c.farm_name} (SIN CATÁLOGO)` : 'SELECCIONAR...'}</option>
                                  {fincasDe(duenoFinca(c), c.farm_id).map((f) => <option key={f.id} value={String(f.id)}>{f.name}{f.magap_code ? ` · ${f.magap_code}` : ''}</option>)}
                                  <option value="__nueva">+ NUEVA FINCA</option>
                                </SelectBuscable>
                              </td>
                              <td className="px-2 py-1.5 min-w-[90px]">
                                {/* El código MAG sale de la finca: no se escribe */}
                                <input value={c.mag_code} readOnly tabIndex={-1} title="Sale de la finca elegida (se corrige en Configuración → Fincas)" className={`${inputClass} bg-gray-200 text-gray-600 cursor-not-allowed`} />
                              </td>
                              <td className="px-2 py-1.5 min-w-[130px]"><input list="ejecutivos" value={c.executive} maxLength={60} onChange={mayus('executive')} disabled={c.liquidada} className={inputClass} /></td>
                              <td className="px-2 py-1.5">
                                <input type="date" value={c.cut_date} onChange={cambiar('cut_date')} disabled={c.liquidada} className={inputClass} />
                                {semanasCompra.length > 1 && (
                                  <select value={c.purchase_week || String(pedido.week)} onChange={cambiar('purchase_week')} disabled={Boolean(c.bloqueo)}
                                    aria-label="Semana de compra"
                                    title={c.bloqueo ? `No se cambia: ${c.bloqueo}` : 'Semana de compra (se liquida y cuenta en el contrato en esa semana)'}
                                    className={`${inputClass} mt-1 text-xs ${semanaDeCompra(c) !== pedido.week ? 'bg-sky-100 font-semibold' : ''}`}>
                                    {semanasCompra.map((w) => <option key={w.week} value={String(w.week)}>COMPRA WK{w.week}</option>)}
                                  </select>
                                )}
                              </td>
                              <td className="px-2 py-1.5 min-w-[130px]">
                                <SelectBuscable value={c.delivery_port_id} onChange={cambiar('delivery_port_id')} disabled={c.liquidada} className={inputClass}>
                                  <option value="">—</option>
                                  {puertosSalida.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                                </SelectBuscable>
                              </td>
                              <td className="px-2 py-1.5 min-w-[150px]">
                                <SelectBuscable value={c.pickup_warehouse_id} onChange={cambiar('pickup_warehouse_id')} disabled={fijo} title={fijo ? `No se cambia: ${c.bloqueo}` : 'Bodega donde retira cartón y materiales'} className={`${inputClass} ${c.pickup_warehouse_id ? '' : 'ring-1 ring-amber-400'}`}>
                                  <option value="">SELECCIONAR...</option>
                                  {bodegas.filter((w) => w.status || String(w.id) === c.pickup_warehouse_id).map((w) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                                </SelectBuscable>
                              </td>
                              <td className="px-2 py-1.5 min-w-[90px]"><CampoNumero decimales={0} value={c.boxes} onChange={cambiar('boxes')} disabled={c.liquidada} className={`${inputClass} text-right font-semibold ${n(c.boxes) ? '' : 'ring-1 ring-amber-400'}`} /></td>
                              <td className="px-2 py-1.5 min-w-[90px]">
                                <CampoNumero decimales={2} value={c.official_price} onChange={cambiar('official_price')} disabled={c.liquidada} title="Precio oficial MAG: el vendedor factura a este precio" className={`${inputClass} text-right`} />
                                {mag && c.official_price !== '' && n(c.official_price) !== n(mag.price) && !c.liquidada && (
                                  <button type="button" onClick={() => cambiarCompra(b._key, c._key, 'official_price', texto(mag.price))} title="Usar el precio oficial MAG vigente" className="block w-full text-right text-[10px] font-semibold text-amber-700 hover:underline mt-0.5">
                                    MAG: {formatoDinero(mag.price)}
                                  </button>
                                )}
                                {mag && c.official_price === '' && !c.liquidada && (
                                  <button type="button" onClick={() => cambiarCompra(b._key, c._key, 'official_price', texto(mag.price))} className="block w-full text-right text-[10px] font-semibold text-primario hover:underline mt-0.5">
                                    USAR MAG {formatoDinero(mag.price)}
                                  </button>
                                )}
                              </td>
                              <td className="px-2 py-1.5 min-w-[80px]"><CampoNumero decimales={2} value={c.real_price} onChange={cambiar('real_price')} disabled={c.liquidada} className={`${inputClass} text-right font-semibold`} /></td>
                              <td className="px-2 py-1.5 min-w-[170px]">
                                {/* 02/11/2026: la fruta PACKED se compra siempre SPOT (precio negociado con cada productor) */}
                                <SelectBuscable value={c.negotiation_type} onChange={cambiar('negotiation_type')} disabled={c.liquidada || b.presentation === 'PACKED'}
                                  title={b.presentation === 'PACKED' ? 'La fruta packed se compra siempre SPOT' : ''} className={`${inputClass} text-xs mb-1`}>
                                  <option value="CONTRATO">CONTRATO</option>
                                  <option value="SPOT">SPOT</option>
                                </SelectBuscable>
                                <SelectBuscable value={c.payment_scheme} onChange={cambiar('payment_scheme')} disabled={c.liquidada} className={`${inputClass} text-xs`}>
                                  <option value="100">PAGO 100 %</option>
                                  <option value="80_20">PAGO 80 / 20</option>
                                </SelectBuscable>
                                {/* 06/11/2026: qué contrato del vendedor es y, si se liquida partido, qué parte (1, 1.1, 1.2) */}
                                {c.negotiation_type === 'CONTRATO' && c.third_party_id && (() => {
                                  const propios = contratosDe(c, c.contract_id);
                                  if (propios.length === 0) {
                                    return <span className="block text-[10px] font-semibold text-amber-700 mt-1" title="Liquidaciones registra los contratos en Contratos y retención">SIN CONTRATO VIGENTE</span>;
                                  }
                                  const k = propios.find((x) => String(x.id) === c.contract_id);
                                  const usadas = k ? cajasContrato(k.id) : 0;
                                  return (
                                    <>
                                      <div className="flex gap-1 mt-1">
                                        <SelectBuscable value={c.contract_id} onChange={cambiar('contract_id')} disabled={c.liquidada} aria-label="Contrato del vendedor"
                                          title={k ? `Contrato ${k.number} · $ ${formatoDinero(k.price)}` : 'Elige qué contrato del vendedor es'}
                                          className={`${inputClass} text-xs flex-1 min-w-[96px] ${c.contract_id ? '' : 'ring-1 ring-amber-400'}`}>
                                          <option value="">¿CONTRATO?</option>
                                          {propios.map((x) => <option key={x.id} value={String(x.id)}>{x.number} · $ {formatoDinero(x.price)}</option>)}
                                        </SelectBuscable>
                                        {k && (
                                          <SelectBuscable value={c.contract_part} onChange={cambiar('contract_part')} disabled={c.liquidada} aria-label="Parte del contrato" title="Para liquidar el contrato partido (una parte pagada y otra pendiente)" className={`${inputClass} text-xs w-14 shrink-0`}>
                                            {[0, 1, 2, 3].map((p) => <option key={p} value={String(p)}>{p === 0 ? k.number : `${k.number}.${p}`}</option>)}
                                          </SelectBuscable>
                                        )}
                                      </div>
                                      {k && (
                                        <span className={`block text-[10px] mt-0.5 ${usadas > k.weekly_boxes ? 'font-semibold text-red-600' : 'text-gray-500'}`} title="Cajas compradas esta semana con este contrato / cupo semanal">
                                          {usadas.toLocaleString('es-EC')} / {Number(k.weekly_boxes).toLocaleString('es-EC')} CAJAS{usadas > k.weekly_boxes ? ' · EXCEDE CUPO' : ''}
                                        </span>
                                      )}
                                      {k && !vigenteEn(k, c) && <span className="block text-[10px] font-semibold text-red-600" title="La vigencia del contrato no toca la semana de compra">CONTRATO NO VIGENTE EN WK{semanaDeCompra(c)}</span>}
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="px-2 py-1.5 min-w-[110px] align-top">
                                <CampoNumero decimales={2} value={c.transport_deduction} onChange={cambiar('transport_deduction')} disabled={c.liquidada} placeholder="0" title="Transporte que pusimos nosotros: monto total que se le DESCUENTA al liquidar" aria-label="Transporte a descontar" className={`${inputClass} text-right`} />
                                {/* 11/11/2026: cuando el productor pone el transporte, se le reconoce $/caja (se paga por las cajas que llegan según tarja) */}
                                <label className="flex items-center gap-1 mt-1 text-[10px] text-gray-600 whitespace-nowrap" title="El productor puso el transporte: se le paga $/caja por las cajas que lleguen según tarja">
                                  <input type="checkbox" checked={c.reconoce_transporte} disabled={c.liquidada}
                                    onChange={(e) => { cambiar('reconoce_transporte')({ target: { value: e.target.checked } }); if (!e.target.checked) cambiar('transport_recognized_rate')({ target: { value: '' } }); }} />
                                  RECONOCER $/CAJA
                                </label>
                                {c.reconoce_transporte && (
                                  <>
                                    <CampoNumero decimales={4} max={5} value={c.transport_recognized_rate} onChange={cambiar('transport_recognized_rate')} disabled={c.liquidada} placeholder="0,30" aria-label="Transporte reconocido por caja"
                                      className={`${inputClass} text-right mt-0.5 ${n(c.transport_recognized_rate) ? '' : 'ring-1 ring-amber-400'}`} />
                                    {n(c.transport_recognized_rate) > 0 && n(c.boxes) > 0 && (
                                      <span className="block text-[10px] text-green-700 text-right" title="Estimado con las cajas compradas; se paga por las que lleguen según tarja">≈ + $ {formatoDinero(n(c.boxes) * n(c.transport_recognized_rate))}</span>
                                    )}
                                  </>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-right whitespace-nowrap">{c.real_price === '' ? <span className="text-xs text-amber-600 font-semibold">SIN PRECIO</span> : `$ ${formatoDinero(n(c.boxes) * n(c.real_price))}`}</td>
                              <td className="px-2 py-1.5 text-right whitespace-nowrap">
                                {nc === null ? <span className="text-gray-400">—</span>
                                  : nc < 0 ? <span className="text-xs font-semibold text-red-600" title="El precio real es mayor al oficial">REAL &gt; OFICIAL</span>
                                    : <span className="font-semibold text-gray-700">$ {formatoDinero(nc)}</span>}
                              </td>
                              <td className="px-2 py-1.5 min-w-[160px]"><input value={c.notes} maxLength={255} onChange={mayus('notes')} placeholder="EJ. CONSOLIDADO EN PTO" className={inputClass} /></td>
                              <td className="px-2 py-1.5 min-w-[150px]">
                                {!c.id ? (
                                  <span className="text-[10px] text-gray-400" title="Primero guarda las compras">GUARDA PARA ENVIAR</span>
                                ) : c.enviada ? (
                                  <div className="leading-tight">
                                    <span className="text-[11px] font-semibold text-green-700 whitespace-nowrap" title={c.enviada_por ? `Enviada por ${c.enviada_por}` : 'Ya estaba en la bodega antes del botón (10/11/2026)'}>✔ ENVIADA {fechaHora(c.enviada)}</span>
                                    {c.enviada_por && <span className="block text-[10px] text-gray-500">{c.enviada_por}</span>}
                                    {c.cambio_envio && <span className="block text-[10px] font-semibold text-amber-700" title="La bodega lo ve como CAMBIÓ">CAMBIÓ {fechaHora(c.cambio_envio)}</span>}
                                    {!c.despachada && !c.liquidada && (
                                      <button type="button" onClick={() => setQuitarEnvio(c)} disabled={enviando} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-red-600 hover:underline mt-0.5">
                                        <Undo2 size={10} /> Quitar envío
                                      </button>
                                    )}
                                  </div>
                                ) : c.liquidada ? (
                                  <span className="text-[10px] text-gray-400">—</span>
                                ) : (
                                  <button type="button" onClick={() => enviarABodega([c.id])} disabled={enviando}
                                    title="La bodega la verá en Por despachar para entregar los materiales"
                                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg shadow-sm bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50 whitespace-nowrap transition">
                                    <Truck size={13} /> Enviar a bodega
                                  </button>
                                )}
                              </td>
                              <td className="px-2 py-1.5">
                                <button type="button" onClick={() => quitarCompra(b._key, c._key)} disabled={fijo} title={fijo ? `No se puede quitar: ${c.bloqueo}` : 'Quitar compra'} className="text-white p-1.5 rounded-lg shadow-sm bg-red-600 hover:bg-red-700 disabled:opacity-40">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" onClick={() => agregarCompra(b._key)} className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition">
                    <Plus size={18} /> Agregar compra
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={agregarBloque} disabled={barcos.length === 0} className="mb-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover disabled:opacity-50 transition">
        <Plus size={18} /> Agregar bloque (barco + marca)
      </button>

      {errores.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 max-h-48 overflow-y-auto">
          {errores.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={volver} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-cancelar text-cancelar-texto hover:bg-cancelar-hover transition">
          <X size={16} /> Cancelar
        </button>
        <button type="button" onClick={handleGuardar} disabled={guardando} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50 disabled:hover:bg-guardar transition">
          <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar compras'}
        </button>
      </div>

      {nuevaFinca && (
        <ModalShell title="Nueva finca" size="sm" onClose={() => setNuevaFinca(null)} onSubmit={guardarNuevaFinca} guardando={guardandoFinca} error={errorFinca}>
          <div>
            <label className={etiqueta}>Productor</label>
            <input value={nuevaFinca.dueno} readOnly className={`${inputClass} bg-gray-200 text-gray-600`} />
          </div>
          <div>
            <label className={etiqueta}>Nombre de la finca *</label>
            <input autoFocus value={nuevaFinca.name} maxLength={255} onChange={(e) => setNuevaFinca((p) => ({ ...p, name: e.target.value.toUpperCase() }))} placeholder="EJ. LA PACIENCIA" className={inputClass} />
          </div>
          <div>
            <label className={etiqueta}>Código MAG</label>
            <input value={nuevaFinca.magap_code} maxLength={50} onChange={(e) => setNuevaFinca((p) => ({ ...p, magap_code: e.target.value.toUpperCase() }))} placeholder="EJ. C-0040" className={inputClass} />
          </div>
          <div>
            <label className={etiqueta}>Zona</label>
            <input value={nuevaFinca.zone} maxLength={100} onChange={(e) => setNuevaFinca((p) => ({ ...p, zone: e.target.value.toUpperCase() }))} placeholder="EJ. MACHALA" className={inputClass} />
          </div>
        </ModalShell>
      )}

      {quitarEnvio && (
        <DialogoConfirmacion
          titulo="¿Quitar el envío a bodega?"
          textoAceptar="Quitar envío"
          textoCancelar="Cancelar"
          onCancelar={() => setQuitarEnvio(null)}
          onAceptar={confirmarQuitarEnvio}
        >
          La compra de {quitarEnvio.boxes} cajas deja de aparecer en Por despachar de la bodega hasta que la vuelvas a enviar.
        </DialogoConfirmacion>
      )}

      {mostrarConfirmarSalida && (
        <DialogoConfirmacion
          titulo="¿Seguro que deseas salir?"
          textoAceptar="Salir sin guardar"
          textoCancelar="Seguir editando"
          onCancelar={() => setMostrarConfirmarSalida(false)}
          onAceptar={() => navigate('/comercial/compras')}
        >
          Tienes cambios sin guardar que se perderán.
        </DialogoConfirmacion>
      )}
    </div>
  );
}
