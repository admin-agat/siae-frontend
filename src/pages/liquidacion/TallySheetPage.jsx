// Tarjas de una semana (Liquidación) — hoja de tarjas
// Ubicación: src/pages/liquidacion/TallySheetPage.jsx
// Ruta: /liquidacion/tarjas/:id   (id = pedido semanal)
//
// Cada fila es un camión que llegó a puerto, de una compra (productor + cliente + marca):
// EMBARCADAS + CAÍDAS + RECHAZADAS = RECIBIDAS. Se pagan embarcadas + caídas.
// Ej.: 300 recibidas = 245 embarcadas + 5 caídas + 50 rechazadas → se pagan 250.
// Arriba, el resumen por compra (comprado vs recibido vs a pagar).
// Las tarjas de un productor ya liquidado quedan bloqueadas.
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, X, Lock } from 'lucide-react';
import { getOrderTallies, saveOrderTallies } from '../../api/settlements';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import SelectBuscable from '../../components/common/SelectBuscable';
import CampoNumero from '../../components/common/CampoNumero';

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const hoy = () => new Date().toISOString().slice(0, 10);

let contador = 0;
const nuevaClave = () => `tarja-${++contador}`;

const tarjaDesdeBackend = (t) => ({
  _key: `id-${t.id}`,
  id: t.id,
  producer_quota_line_id: String(t.producer_quota_line_id),
  shipment_id: t.shipment_id ? String(t.shipment_id) : '',
  date: t.date || '',
  number: t.number || '',
  truck_plate: t.truck_plate || '',
  container_number: t.container_number || '',
  boxes_shipped: String(t.boxes_shipped),
  boxes_fallen: String(t.boxes_fallen),
  boxes_rejected: String(t.boxes_rejected),
});

const n = (v) => Number(v) || 0;
const recibidas = (t) => n(t.boxes_shipped) + n(t.boxes_fallen) + n(t.boxes_rejected);
const aPagar = (t) => n(t.boxes_shipped) + n(t.boxes_fallen);

export default function TallySheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [compras, setCompras] = useState([]);
  const [barcos, setBarcos] = useState([]);
  const [tarjas, setTarjas] = useState([]);
  const [inicial, setInicial] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState([]);
  const [toast, setToast] = useState(null);
  const [mostrarConfirmarSalida, setMostrarConfirmarSalida] = useState(false);

  const aplicarRespuesta = (data) => {
    setPedido(data.order);
    setCompras(data.purchases);
    setBarcos(data.shipments);
    const lista = data.tallies.map(tarjaDesdeBackend);
    setTarjas(lista);
    setInicial(JSON.stringify(lista));
  };

  useEffect(() => {
    getOrderTallies(id)
      .then((res) => aplicarRespuesta(res.data))
      .catch((err) => {
        console.error('ERROR AL CARGAR LAS TARJAS:', err);
        setErrores(['NO SE PUDIERON CARGAR LAS TARJAS DE ESTA SEMANA.']);
      })
      .finally(() => setCargando(false));
  }, [id]);

  // ---------------- Cálculos ----------------

  const compraDe = (t) => compras.find((c) => String(c.id) === t.producer_quota_line_id);
  // "COMERCIAL / PRODUCTOR · FINCA — MARCA (CLIENTE)"
  const etiquetaCompra = (c) => `${c.third_party?.name}${c.producer ? ` / ${c.producer}` : ''}${c.farm_name ? ` · ${c.farm_name}` : ''} — ${c.brand?.name} (${c.customer})`;
  const tarjasDeCompra = (compraId) => tarjas.filter((t) => t.producer_quota_line_id === String(compraId));
  const suma = (lista, fn) => lista.reduce((s, t) => s + fn(t), 0);
  const totales = {
    embarcadas: suma(tarjas, (t) => n(t.boxes_shipped)),
    caidas: suma(tarjas, (t) => n(t.boxes_fallen)),
    rechazadas: suma(tarjas, (t) => n(t.boxes_rejected)),
  };

  // ---------------- Cambios ----------------

  const cambiar = (key, campo, valor) => {
    setTarjas((prev) => prev.map((t) => {
      if (t._key !== key) return t;
      const nueva = { ...t, [campo]: valor };
      // Al elegir la compra se propone el barco de su bloque
      if (campo === 'producer_quota_line_id') {
        const barco = compras.find((c) => String(c.id) === valor)?.shipment_id;
        if (barco) nueva.shipment_id = String(barco);
      }
      return nueva;
    }));
  };

  const agregarTarja = () => {
    // Copia fecha y barco de la última tarja (suelen llegar varios camiones el mismo día)
    const ultima = tarjas[tarjas.length - 1];
    setTarjas((prev) => [...prev, {
      _key: nuevaClave(), id: null,
      producer_quota_line_id: '', shipment_id: ultima?.shipment_id || '',
      date: ultima?.date || hoy(), number: '', truck_plate: '', container_number: '',
      boxes_shipped: '', boxes_fallen: '0', boxes_rejected: '0',
    }]);
  };

  const quitarTarja = (key) => setTarjas((prev) => prev.filter((t) => t._key !== key));

  const hayCambios = () => inicial !== null && inicial !== JSON.stringify(tarjas);
  const volver = () => (hayCambios() ? setMostrarConfirmarSalida(true) : navigate('/liquidacion/tarjas'));

  // ---------------- Guardar ----------------

  const handleGuardar = async () => {
    setErrores([]);
    const faltan = [];
    tarjas.forEach((t, i) => {
      if (!t.producer_quota_line_id) faltan.push(`TARJA ${i + 1}: ELIGE EL PRODUCTOR Y LA MARCA.`);
      if (!t.date) faltan.push(`TARJA ${i + 1}: FALTA LA FECHA.`);
      if (recibidas(t) === 0) faltan.push(`TARJA ${i + 1}: NO TIENE CAJAS.`);
    });
    if (faltan.length) {
      setErrores(faltan);
      return;
    }

    setGuardando(true);
    try {
      const res = await saveOrderTallies(id, {
        tallies: tarjas.map((t) => ({
          id: t.id,
          producer_quota_line_id: Number(t.producer_quota_line_id),
          shipment_id: t.shipment_id ? Number(t.shipment_id) : null,
          date: t.date,
          number: t.number || null,
          truck_plate: t.truck_plate || null,
          container_number: t.container_number || null,
          boxes_shipped: n(t.boxes_shipped),
          boxes_fallen: n(t.boxes_fallen),
          boxes_rejected: n(t.boxes_rejected),
        })),
      });
      aplicarRespuesta(res.data);
      setToast({ tipo: 'exito', mensaje: 'Tarjas guardadas correctamente' });
    } catch (err) {
      console.error('ERROR AL GUARDAR LAS TARJAS:', err);
      const e = err.response?.data?.errors;
      setErrores(e ? Object.values(e).flat() : [err.response?.data?.message || 'Error al guardar las tarjas']);
    } finally {
      setGuardando(false);
    }
  };

  // ---------------- Vista ----------------

  const inputClass = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario disabled:opacity-60';

  if (cargando) return <div className="p-6 text-gray-400">Cargando tarjas...</div>;
  if (!pedido) {
    return <div className="p-6">{errores.map((e) => <p key={e} className="text-red-600 text-sm">{e}</p>)}</div>;
  }

  return (
    <div className="p-6">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-4">
        <button type="button" onClick={volver} title="Volver" className="p-2 rounded-lg hover:bg-gray-200 text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tarjas — Semana {pedido.week} / {pedido.year}</h1>
          <p className="text-sm text-gray-500">Registra lo que llegó a puerto por camión. Se pagan embarcadas + caídas; las rechazadas no.</p>
        </div>
      </div>

      {/* Resumen por compra */}
      <div className="bg-white rounded-xl shadow overflow-x-auto mb-4">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-primario text-white">
            <tr>
              <th className="text-left px-3 py-3 uppercase">Productor — Marca (Cliente)</th>
              <th className="text-right px-3 py-3 uppercase">Comprado</th>
              <th className="text-right px-3 py-3 uppercase">Recibidas</th>
              <th className="text-right px-3 py-3 uppercase">Embarcadas</th>
              <th className="text-right px-3 py-3 uppercase">Caídas</th>
              <th className="text-right px-3 py-3 uppercase">Rechazadas</th>
              <th className="text-right px-3 py-3 uppercase">A pagar</th>
            </tr>
          </thead>
          <tbody>
            {compras.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-6 text-gray-400">Comercial aún no compra fruta para esta semana</td></tr>
            ) : compras.map((c, i) => {
              const lista = tarjasDeCompra(c.id);
              const rec = suma(lista, recibidas);
              const rech = suma(lista, (t) => n(t.boxes_rejected));
              return (
                <tr key={c.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-3 py-2 font-medium">
                    {etiquetaCompra(c)}
                    {c.liquidada && <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-gray-500"><Lock size={10} /> LIQUIDADO</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{formatoCajas(c.boxes)}</td>
                  <td className={`px-3 py-2 text-right ${rec > c.boxes ? 'text-amber-700 font-semibold' : ''}`} title={rec > c.boxes ? 'Llegó más de lo comprado' : ''}>{formatoCajas(rec)}</td>
                  <td className="px-3 py-2 text-right">{formatoCajas(suma(lista, (t) => n(t.boxes_shipped)))}</td>
                  <td className="px-3 py-2 text-right">{formatoCajas(suma(lista, (t) => n(t.boxes_fallen)))}</td>
                  <td className="px-3 py-2 text-right text-red-600">
                    {formatoCajas(rech)}
                    {rec > 0 && <span className="block text-[10px] text-gray-500">{((rech / rec) * 100).toFixed(1)} %</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-green-700">{formatoCajas(suma(lista, aPagar))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tarjas */}
      <div className="bg-white rounded-xl shadow overflow-x-auto mb-4">
        <table className="w-full text-sm min-w-[1400px]">
          <thead className="bg-primario text-white">
            <tr>
              <th className="text-left px-3 py-3 uppercase">#</th>
              <th className="text-left px-3 py-3 uppercase">Productor — Marca (Cliente)</th>
              <th className="text-left px-3 py-3 uppercase">Barco</th>
              <th className="text-left px-3 py-3 uppercase">Fecha</th>
              <th className="text-left px-3 py-3 uppercase">N° tarja</th>
              <th className="text-left px-3 py-3 uppercase">Placa</th>
              <th className="text-left px-3 py-3 uppercase">Contenedor</th>
              <th className="text-right px-3 py-3 uppercase">Embarcadas</th>
              <th className="text-right px-3 py-3 uppercase">Caídas</th>
              <th className="text-right px-3 py-3 uppercase">Rechazadas</th>
              <th className="text-right px-3 py-3 uppercase">Recibidas</th>
              <th className="text-right px-3 py-3 uppercase">A pagar</th>
              <th className="px-3 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {tarjas.length === 0 ? (
              <tr><td colSpan={13} className="text-center py-6 text-gray-400">Agrega la primera tarja de esta semana</td></tr>
            ) : tarjas.map((t, i) => {
              const bloqueada = Boolean(t.id) && compraDe(t)?.liquidada;
              return (
                <tr key={t._key} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 min-w-[260px]">
                    <SelectBuscable value={t.producer_quota_line_id} onChange={(e) => cambiar(t._key, 'producer_quota_line_id', e.target.value)} disabled={bloqueada} className={inputClass}>
                      <option value="">SELECCIONAR...</option>
                      {compras.filter((c) => !c.liquidada || String(c.id) === t.producer_quota_line_id).map((c) => (
                        <option key={c.id} value={String(c.id)}>{etiquetaCompra(c)}</option>
                      ))}
                    </SelectBuscable>
                    {bloqueada && <span className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5"><Lock size={10} /> YA LIQUIDADO</span>}
                  </td>
                  <td className="px-3 py-2 min-w-[150px]">
                    <SelectBuscable value={t.shipment_id} onChange={(e) => cambiar(t._key, 'shipment_id', e.target.value)} disabled={bloqueada} className={inputClass}>
                      <option value="">—</option>
                      {barcos.map((b) => <option key={b.id} value={String(b.id)}>{b.vessel?.name || b.vessel_name || b.code}{b.voyage ? ` · ${b.voyage}` : ''}</option>)}
                    </SelectBuscable>
                  </td>
                  <td className="px-3 py-2"><input type="date" value={t.date} onChange={(e) => cambiar(t._key, 'date', e.target.value)} disabled={bloqueada} className={inputClass} /></td>
                  <td className="px-3 py-2 min-w-[90px]"><input value={t.number} maxLength={30} onChange={(e) => cambiar(t._key, 'number', e.target.value.toUpperCase())} disabled={bloqueada} className={inputClass} /></td>
                  <td className="px-3 py-2 min-w-[90px]"><input value={t.truck_plate} maxLength={15} onChange={(e) => cambiar(t._key, 'truck_plate', e.target.value.toUpperCase())} disabled={bloqueada} placeholder="GBC-1234" className={inputClass} /></td>
                  <td className="px-3 py-2 min-w-[120px]"><input value={t.container_number} maxLength={15} onChange={(e) => cambiar(t._key, 'container_number', e.target.value.toUpperCase())} disabled={bloqueada} placeholder="OTPU6756531" className={inputClass} /></td>
                  <td className="px-3 py-2 min-w-[90px]"><CampoNumero decimales={0} value={t.boxes_shipped} onChange={(e) => cambiar(t._key, 'boxes_shipped', e.target.value)} disabled={bloqueada} className={`${inputClass} text-right`} /></td>
                  <td className="px-3 py-2 min-w-[80px]"><CampoNumero decimales={0} value={t.boxes_fallen} onChange={(e) => cambiar(t._key, 'boxes_fallen', e.target.value)} disabled={bloqueada} className={`${inputClass} text-right`} /></td>
                  <td className="px-3 py-2 min-w-[80px]"><CampoNumero decimales={0} value={t.boxes_rejected} onChange={(e) => cambiar(t._key, 'boxes_rejected', e.target.value)} disabled={bloqueada} className={`${inputClass} text-right text-red-600`} /></td>
                  <td className="px-3 py-2 text-right">{formatoCajas(recibidas(t))}</td>
                  <td className="px-3 py-2 text-right font-semibold text-green-700">{formatoCajas(aPagar(t))}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => quitarTarja(t._key)} disabled={bloqueada} title={bloqueada ? 'Ya liquidado: no se puede quitar' : 'Quitar tarja'} className="text-white p-1.5 rounded-lg shadow-sm transition bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {tarjas.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2">
              <tr>
                <td colSpan={7} className="px-3 py-2 font-bold">TOTAL SEMANA {pedido.week}</td>
                <td className="px-3 py-2 text-right font-bold">{formatoCajas(totales.embarcadas)}</td>
                <td className="px-3 py-2 text-right font-bold">{formatoCajas(totales.caidas)}</td>
                <td className="px-3 py-2 text-right font-bold text-red-600">{formatoCajas(totales.rechazadas)}</td>
                <td className="px-3 py-2 text-right font-bold">{formatoCajas(totales.embarcadas + totales.caidas + totales.rechazadas)}</td>
                <td className="px-3 py-2 text-right font-bold text-green-700">{formatoCajas(totales.embarcadas + totales.caidas)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
        <div className="px-4 py-3 border-t bg-gray-50 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={agregarTarja} disabled={compras.length === 0} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover disabled:opacity-50 transition">
            <Plus size={18} /> Agregar tarja
          </button>
          <p className="text-xs text-gray-500">Recibidas = embarcadas + caídas + rechazadas · A pagar = embarcadas + caídas</p>
        </div>
      </div>

      {errores.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {errores.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={volver} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-cancelar text-cancelar-texto hover:bg-cancelar-hover transition">
          <X size={16} /> Cancelar
        </button>
        <button type="button" onClick={handleGuardar} disabled={guardando} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50 disabled:hover:bg-guardar transition">
          <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar tarjas'}
        </button>
      </div>

      {mostrarConfirmarSalida && (
        <DialogoConfirmacion
          titulo="¿Seguro que deseas salir?"
          textoAceptar="Salir sin guardar"
          textoCancelar="Seguir editando"
          onCancelar={() => setMostrarConfirmarSalida(false)}
          onAceptar={() => navigate('/liquidacion/tarjas')}
        >
          Tienes cambios sin guardar que se perderán.
        </DialogoConfirmacion>
      )}
    </div>
  );
}
