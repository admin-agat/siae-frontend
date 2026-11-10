// Distribución del pedido semanal en barcos (Logística) — hoja de reparto
// Ubicación: src/pages/exportaciones/OrderDistributionPage.jsx
// Ruta: /exportaciones/embarques/:id   (id = pedido semanal)
//
// Arriba se arman los BARCOS de la semana (naviera, barco, puerto de salida, destino, fechas).
// Abajo, una hoja: cada fila es una línea del pedido y cada columna un barco; en la celda
// se escriben las cajas de esa línea que van en ese barco. Una línea puede ir en varios barcos.
// Se puede guardar a medias (queda "pendiente"); NO se puede asignar más de lo que tiene la línea.
// Contenedores: se embarcan contenedores completos (múltiplos de cajas por contenedor).
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, X, AlertTriangle, Printer } from 'lucide-react';
import { getOrderDistribution, saveOrderDistribution } from '../../api/customerOrders';
import { getShippingLines } from '../../api/shippingLines';
import { getVessels } from '../../api/vessels';
import { getPorts } from '../../api/ports';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import DistributionPrint from '../../components/DistributionPrint';
import { useAuth } from '../../context/AuthContext';
import SelectBuscable from '../../components/common/SelectBuscable';
import CampoNumero from '../../components/common/CampoNumero';
import { ETIQUETA_MODALIDAD } from '../../utils/modalidades';

// 10/11/2026: las 4 modalidades con los nombres de Exportaciones y Logística (utils/modalidades.js)
const TIPOS_CARGA = ETIQUETA_MODALIDAD;

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');

let contador = 0;
const nuevaClave = () => `barco-${++contador}`;

// Barco que llega del backend → formato del formulario (asign = { lineaId: 'cajas' })
const barcoDesdeBackend = (s) => ({
  _key: `id-${s.id}`,
  id: s.id,
  code: s.code,
  shipping_line_id: s.shipping_line_id ? String(s.shipping_line_id) : '',
  vessel_id: s.vessel_id ? String(s.vessel_id) : '',
  departure_port_id: s.departure_port_id ? String(s.departure_port_id) : '',
  destination_port_id: s.destination_port_id ? String(s.destination_port_id) : '',
  departure_date: s.departure_date || '',
  eta: s.eta || '',
  voyage: s.voyage || '',
  asign: Object.fromEntries((s.lines || []).map((l) => [l.customer_order_line_id, String(l.box_quantity)])),
});

export default function OrderDistributionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pedido, setPedido] = useState(null);
  const [barcos, setBarcos] = useState([]);
  const [inicial, setInicial] = useState(null); // lo último guardado, para saber si hay cambios
  const [version, setVersion] = useState(null); // huella de lo guardado: si otro usuario guarda antes, el backend responde 409

  const [navieras, setNavieras] = useState([]);
  const [buques, setBuques] = useState([]);
  const [puertosSalida, setPuertosSalida] = useState([]);
  const [puertosDestino, setPuertosDestino] = useState([]);
  const [puertos, setPuertos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState([]);
  const [toast, setToast] = useState(null);
  const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const [resDist, resNav, resBuq, resPuertos] = await Promise.all([
          getOrderDistribution(id),
          getShippingLines({ status: true }),
          getVessels(),
          getPorts({ status: true }),
        ]);
        setPedido(resDist.data.order);
        const lista = resDist.data.shipments.map(barcoDesdeBackend);
        setBarcos(lista);
        setInicial(JSON.stringify(lista));
        setVersion(resDist.data.version);
        setNavieras(Array.isArray(resNav.data) ? resNav.data : []);
        setBuques((Array.isArray(resBuq.data) ? resBuq.data : []).filter((b) => b.status !== false));
        const puertos = Array.isArray(resPuertos.data) ? resPuertos.data : [];
        setPuertos(puertos);
        setPuertosSalida(puertos.filter((p) => p.port_type === 'SALIDA'));
        setPuertosDestino(puertos.filter((p) => p.port_type === 'DESTINO'));
      } catch (err) {
        console.error('ERROR AL CARGAR LA DISTRIBUCIÓN:', err);
        setErrores(['NO SE PUDO CARGAR LA DISTRIBUCIÓN DEL PEDIDO.']);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [id]);

  // ---------------- Cálculos ----------------

  const lineas = pedido?.lines || [];
  const asignadoLinea = (lineaId) => barcos.reduce((s, b) => s + (Number(b.asign[lineaId]) || 0), 0);
  const totalBarco = (b) => Object.values(b.asign).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalPedido = lineas.reduce((s, l) => s + l.boxes, 0);
  const totalAsignado = lineas.reduce((s, l) => s + asignadoLinea(l.id), 0);
  const avance = totalPedido ? Math.min(100, (totalAsignado / totalPedido) * 100) : 0;
  const hayExceso = lineas.some((l) => asignadoLinea(l.id) > l.boxes);
  const nombrePuerto = (pid) => puertosSalida.find((p) => String(p.id) === String(pid))?.name;

  // ---------------- Cambios ----------------

  const cambiarBarco = (key, campo, valor) => {
    setBarcos((prev) => prev.map((b) => {
      if (b._key !== key) return b;
      const nuevo = { ...b, [campo]: valor };
      if (campo === 'shipping_line_id') nuevo.vessel_id = ''; // el barco depende de la naviera
      return nuevo;
    }));
  };

  const cambiarAsignacion = (key, lineaId, valor) => {
    setBarcos((prev) => prev.map((b) => (b._key === key ? { ...b, asign: { ...b.asign, [lineaId]: valor } } : b)));
  };

  // "Completar": pone en este barco todo lo que le falta a la línea
  const completarLinea = (key, linea) => {
    const barco = barcos.find((b) => b._key === key);
    const enEste = Number(barco.asign[linea.id]) || 0;
    const falta = linea.boxes - asignadoLinea(linea.id);
    if (falta > 0) cambiarAsignacion(key, linea.id, String(enEste + falta));
  };

  const agregarBarco = () => {
    // Propone el puerto de salida más usado en las líneas y el primer destino
    const conteo = {};
    lineas.forEach((l) => { conteo[l.departure_port_id] = (conteo[l.departure_port_id] || 0) + 1; });
    const puertoComun = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    setBarcos((prev) => [...prev, {
      _key: nuevaClave(), id: null, code: null,
      shipping_line_id: '', vessel_id: '',
      departure_port_id: String(puertoComun),
      destination_port_id: puertosDestino[0] ? String(puertosDestino[0].id) : '',
      departure_date: '', eta: '', voyage: '', asign: {},
    }]);
  };

  const quitarBarco = (key) => setBarcos((prev) => prev.filter((b) => b._key !== key));

  const hayCambios = () => inicial !== null && inicial !== JSON.stringify(barcos);
  const volver = () => (hayCambios() ? setMostrarConfirmarSalida(true) : navigate('/exportaciones/embarques'));

  // ---------------- Guardar ----------------

  const handleGuardar = async () => {
    setErrores([]);
    const faltan = [];
    barcos.forEach((b, i) => {
      if (!b.shipping_line_id || !b.vessel_id) faltan.push(`BARCO ${i + 1}: ELIGE NAVIERA Y BARCO.`);
      if (!b.departure_port_id) faltan.push(`BARCO ${i + 1}: FALTA EL PUERTO DE SALIDA.`);
      if (!b.departure_date) faltan.push(`BARCO ${i + 1}: FALTA LA FECHA DE SALIDA.`);
    });
    lineas.forEach((l, i) => {
      if (asignadoLinea(l.id) > l.boxes) faltan.push(`LÍNEA ${i + 1}: TIENE ${formatoCajas(l.boxes)} CAJAS Y SE ASIGNAN ${formatoCajas(asignadoLinea(l.id))}.`);
    });
    if (faltan.length) {
      setErrores(faltan);
      return;
    }

    const data = {
      version,
      shipments: barcos.map((b) => ({
        id: b.id,
        shipping_line_id: Number(b.shipping_line_id),
        vessel_id: Number(b.vessel_id),
        departure_port_id: Number(b.departure_port_id),
        destination_port_id: b.destination_port_id ? Number(b.destination_port_id) : null,
        departure_date: b.departure_date,
        eta: b.eta || null,
        voyage: b.voyage || null,
        allocations: Object.entries(b.asign)
          .filter(([, v]) => Number(v) > 0)
          .map(([lineaId, v]) => ({ customer_order_line_id: Number(lineaId), boxes: Number(v) })),
      })),
    };

    setGuardando(true);
    try {
      const res = await saveOrderDistribution(id, data);
      const lista = res.data.shipments.map(barcoDesdeBackend);
      setBarcos(lista);
      setInicial(JSON.stringify(lista));
      setVersion(res.data.version);
      setToast({ tipo: 'exito', mensaje: 'Distribución guardada correctamente' });
    } catch (err) {
      console.error('ERROR AL GUARDAR LA DISTRIBUCIÓN:', err);
      const e = err.response?.data?.errors;
      setErrores(e ? Object.values(e).flat() : [err.response?.data?.message || 'Error al guardar la distribución']);
    } finally {
      setGuardando(false);
    }
  };

  // ---------------- Vista ----------------

  const inputClass = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';

  if (cargando) return <div className="p-6 text-gray-400">Cargando distribución...</div>;
  if (!pedido) {
    return (
      <div className="p-6">
        {errores.map((e) => <p key={e} className="text-red-600 text-sm">{e}</p>)}
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-800">Distribución en barcos — Semana {pedido.week} / {pedido.year}</h1>
          <p className="text-sm text-gray-500">Arma los barcos de la semana y reparte cada línea del pedido entre ellos</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={barcos.length === 0}
          title={barcos.length === 0 ? 'Agrega al menos un barco para imprimir' : 'Imprimir la distribución de la semana'}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover disabled:opacity-50 transition"
        >
          <Printer size={18} /> Imprimir
        </button>
      </div>

      {/* Avance de la semana */}
      <div className={`rounded-xl border px-4 py-3 mb-4 ${hayExceso ? 'bg-red-50 border-red-200' : avance >= 100 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-gray-700">En barcos <strong>{formatoCajas(totalAsignado)}</strong> de <strong>{formatoCajas(totalPedido)}</strong> cajas</span>
          <span className={`font-semibold ${hayExceso ? 'text-red-700' : avance >= 100 ? 'text-green-700' : 'text-amber-700'}`}>
            {hayExceso ? 'HAY LÍNEAS CON MÁS CAJAS DE LAS PEDIDAS'
              : avance >= 100 ? '✔ PEDIDO DISTRIBUIDO COMPLETO'
                : `FALTAN ${formatoCajas(totalPedido - totalAsignado)} CAJAS POR EMBARCAR`}
          </span>
        </div>
        <div className="h-2 bg-white rounded-full mt-2 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${hayExceso ? 'bg-red-600' : avance >= 100 ? 'bg-green-600' : 'bg-amber-500'}`} style={{ width: `${avance}%` }} />
        </div>
      </div>

      {/* Barcos de la semana */}
      <div className="bg-white rounded-xl shadow overflow-x-auto mb-4">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-primario text-white">
            <tr>
              <th className="text-left px-3 py-3 uppercase w-24">Barco</th>
              <th className="text-left px-3 py-3 uppercase">Naviera</th>
              <th className="text-left px-3 py-3 uppercase">Nombre del barco</th>
              <th className="text-left px-3 py-3 uppercase">Viaje</th>
              <th className="text-left px-3 py-3 uppercase">Puerto salida</th>
              <th className="text-left px-3 py-3 uppercase">Destino</th>
              <th className="text-left px-3 py-3 uppercase">Fecha salida</th>
              <th className="text-left px-3 py-3 uppercase">Llegada (ETA)</th>
              <th className="text-right px-3 py-3 uppercase">Cajas</th>
              <th className="px-3 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {barcos.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-6 text-gray-400">Agrega los barcos que salen esta semana</td></tr>
            ) : barcos.map((b, i) => (
              <tr key={b._key} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-3 py-2">
                  <span className="font-semibold text-primario">#{i + 1}</span>
                  {b.code && <span className="block text-[10px] text-gray-400 font-mono">{b.code}</span>}
                </td>
                <td className="px-3 py-2 min-w-[140px]">
                  <SelectBuscable value={b.shipping_line_id} onChange={(e) => cambiarBarco(b._key, 'shipping_line_id', e.target.value)} className={inputClass}>
                    <option value="">SELECCIONAR...</option>
                    {navieras.map((n) => <option key={n.id} value={String(n.id)}>{n.name}</option>)}
                  </SelectBuscable>
                </td>
                <td className="px-3 py-2 min-w-[180px]">
                  <SelectBuscable value={b.vessel_id} onChange={(e) => cambiarBarco(b._key, 'vessel_id', e.target.value)} disabled={!b.shipping_line_id} className={`${inputClass} disabled:opacity-50`}>
                    <option value="">{b.shipping_line_id ? 'SELECCIONAR...' : 'ELIGE NAVIERA'}</option>
                    {buques.filter((v) => String(v.shipping_line_id) === b.shipping_line_id).map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
                  </SelectBuscable>
                </td>
                <td className="px-3 py-2 min-w-[100px]">
                  <input value={b.voyage} maxLength={20} placeholder="UNI1401" onChange={(e) => cambiarBarco(b._key, 'voyage', e.target.value.toUpperCase())} className={inputClass} />
                </td>
                <td className="px-3 py-2 min-w-[140px]">
                  <SelectBuscable value={b.departure_port_id} onChange={(e) => cambiarBarco(b._key, 'departure_port_id', e.target.value)} className={inputClass}>
                    <option value="">SELECCIONAR...</option>
                    {puertosSalida.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                  </SelectBuscable>
                </td>
                <td className="px-3 py-2 min-w-[140px]">
                  <SelectBuscable value={b.destination_port_id} onChange={(e) => cambiarBarco(b._key, 'destination_port_id', e.target.value)} className={inputClass}>
                    <option value="">—</option>
                    {puertosDestino.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                  </SelectBuscable>
                </td>
                <td className="px-3 py-2"><input type="date" value={b.departure_date} onChange={(e) => cambiarBarco(b._key, 'departure_date', e.target.value)} className={inputClass} /></td>
                <td className="px-3 py-2"><input type="date" value={b.eta} min={b.departure_date || undefined} onChange={(e) => cambiarBarco(b._key, 'eta', e.target.value)} className={inputClass} /></td>
                <td className="px-3 py-2 text-right font-semibold">{formatoCajas(totalBarco(b))}</td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => quitarBarco(b._key)} title="Quitar barco" className="text-white p-1.5 rounded-lg shadow-sm transition bg-red-600 hover:bg-red-700">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t bg-gray-50">
          <button type="button" onClick={agregarBarco} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition">
            <Plus size={18} /> Agregar barco
          </button>
        </div>
      </div>

      {/* Hoja de reparto: líneas del pedido × barcos */}
      {barcos.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead className="bg-primario text-white">
              <tr>
                <th className="text-left px-3 py-3 uppercase">#</th>
                <th className="text-left px-3 py-3 uppercase">Cliente</th>
                <th className="text-left px-3 py-3 uppercase">Modalidad</th>
                <th className="text-left px-3 py-3 uppercase">Puerto</th>
                <th className="text-left px-3 py-3 uppercase">Tipo</th>
                <th className="text-right px-3 py-3 uppercase">Pedido</th>
                {barcos.map((b, i) => (
                  <th key={b._key} className="text-center px-3 py-3 uppercase min-w-[130px]">
                    Barco #{i + 1}
                    <span className="block text-[10px] font-normal normal-case opacity-80">
                      {buques.find((v) => String(v.id) === b.vessel_id)?.name || 'sin barco'}{b.voyage ? ` · ${b.voyage}` : ''}
                    </span>
                  </th>
                ))}
                <th className="text-right px-3 py-3 uppercase">En barcos</th>
                <th className="text-right px-3 py-3 uppercase">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => {
                const asignado = asignadoLinea(l.id);
                const pendiente = l.boxes - asignado;
                return (
                  <tr key={l.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{l.customer?.third_party?.name}</td>
                    <td className="px-3 py-2 text-xs">
                      {TIPOS_CARGA[l.cargo_type] || l.cargo_type}
                      {l.boxes_per_container && <span className="block text-gray-500">{l.containers_qty} × {formatoCajas(l.boxes_per_container)}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">{l.departure_port?.name}</td>
                    <td className="px-3 py-2 text-xs">{l.incoterm} · {l.negotiation_type}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatoCajas(l.boxes)}</td>
                    {barcos.map((b) => {
                      const valor = b.asign[l.id] ?? '';
                      // Aviso (no bloquea): la línea sale de otro puerto que el barco
                      const otroPuerto = Number(valor) > 0 && b.departure_port_id && String(l.departure_port_id) !== b.departure_port_id;
                      const contenedores = l.boxes_per_container && Number(valor) ? Number(valor) / l.boxes_per_container : null;
                      return (
                        <td key={b._key} className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <CampoNumero decimales={0} value={valor}
                              onChange={(e) => cambiarAsignacion(b._key, l.id, e.target.value)}
                              title={otroPuerto ? `La línea sale de ${l.departure_port?.name} y el barco de ${nombrePuerto(b.departure_port_id)}` : ''}
                              className={`${inputClass} text-right ${otroPuerto ? 'ring-2 ring-amber-400' : ''}`}
                            />
                            {pendiente > 0 && (
                              <button type="button" onClick={() => completarLinea(b._key, l)} title="Poner aquí todo lo pendiente" className="text-xs font-semibold text-primario hover:text-primario-hover px-1">
                                +
                              </button>
                            )}
                          </div>
                          {contenedores !== null && (
                            <span className={`block text-[10px] text-right ${Number.isInteger(contenedores) ? 'text-gray-500' : 'text-red-600 font-semibold'}`}>
                              {Number.isInteger(contenedores) ? `${contenedores} cont.` : 'no son contenedores completos'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right">{formatoCajas(asignado)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${pendiente < 0 ? 'text-red-600' : pendiente === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                      {pendiente === 0 ? '✔' : formatoCajas(pendiente)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2">
              <tr>
                <td colSpan={5} className="px-3 py-2 font-bold">TOTAL</td>
                <td className="px-3 py-2 text-right font-bold">{formatoCajas(totalPedido)}</td>
                {barcos.map((b) => <td key={b._key} className="px-3 py-2 text-right font-bold">{formatoCajas(totalBarco(b))}</td>)}
                <td className="px-3 py-2 text-right font-bold">{formatoCajas(totalAsignado)}</td>
                <td className="px-3 py-2 text-right font-bold">{formatoCajas(totalPedido - totalAsignado)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="px-4 py-2 text-xs text-gray-500 flex items-center gap-1 border-t">
            <AlertTriangle size={14} className="text-amber-500" />
            Borde amarillo: la línea pide salir de otro puerto distinto al del barco (se permite, solo es un aviso).
            El botón <strong>+</strong> pone en ese barco todo lo que le falta a la línea.
          </p>
        </div>
      )}

      {errores.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {errores.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={volver} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-cancelar text-cancelar-texto hover:bg-cancelar-hover transition">
          <X size={16} /> Cancelar
        </button>
        <button type="button" onClick={handleGuardar} disabled={guardando || hayExceso} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50 disabled:hover:bg-guardar transition">
          <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar distribución'}
        </button>
      </div>

      {mostrarConfirmarSalida && (
        <DialogoConfirmacion
          titulo="¿Seguro que deseas salir?"
          textoAceptar="Salir sin guardar"
          textoCancelar="Seguir editando"
          onCancelar={() => setMostrarConfirmarSalida(false)}
          onAceptar={() => navigate('/exportaciones/embarques')}
        >
          Tienes cambios sin guardar que se perderán.
        </DialogoConfirmacion>
      )}
    </div>

    <DistributionPrint
      pedido={pedido}
      barcos={barcos}
      navieras={navieras}
      buques={buques}
      puertos={puertos}
      usuario={user?.name}
      borrador={hayCambios()}
    />
    </>
  );
}
