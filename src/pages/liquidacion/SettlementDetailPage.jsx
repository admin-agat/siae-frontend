// Detalle de una liquidación: fruta, materiales, anticipos, pagos — imprimible
// Ubicación: src/pages/liquidacion/SettlementDetailPage.jsx
// Ruta: /liquidacion/:id
//
// Cada pago (1er pago 100 % / 80 %, 2do pago 20 %) se registra con fecha y comprobante.
// Anular solo se puede sin pagos registrados: el cupo vuelve a quedar abierto y los
// anticipos recuperan su saldo. Las clases print:* solo aplican al imprimir.
// 30/10/2026: el vendedor factura al precio oficial MAG y entrega una NOTA DE CRÉDITO por la diferencia
// con el real; aquí se registran el N° de factura y de NC cuando llegan (no bloquea los pagos).
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Ban, CheckCircle, Undo2, Save } from 'lucide-react';
import { getSettlement, paySettlement, unpaySettlement, annulSettlement, saveSettlementDocuments } from '../../api/settlements';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ToastFlotante from '../../components/common/ToastFlotante';
import { useAuth } from '../../context/AuthContext';
import { puede } from '../../routes/menu';
import { hoyISO } from '../../utils/fecha';

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const formatoDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatoCantidad = (n) => Number(n || 0).toLocaleString('es-EC', { maximumFractionDigits: 2 });
const formatoFecha = (f) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—');
const hoy = () => hoyISO();
const ESQUEMA = { 100: '100 %', '80_20': '80 / 20' };

export default function SettlementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // 02/11/2026: cada acción es de su pantalla (igual que en el backend): anular = Liquidar,
  // pagos = Pagos, factura y N° de NC = Notas de crédito o Liquidar. Las tres ven el detalle.
  const puedeAnular = puede(user, 'liquidar');
  const puedePagar = puede(user, 'pagos');
  const puedeDocumentos = puede(user, 'notas_credito', 'liquidar');

  const [liq, setLiq] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pagoForm, setPagoForm] = useState({}); // { installment: { paid_at, reference } }
  const [procesando, setProcesando] = useState(false);
  const [toast, setToast] = useState(null);
  const [deshacer, setDeshacer] = useState(null); // pago a deshacer
  const [anular, setAnular] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [documentos, setDocumentos] = useState({ invoice_number: '', credit_note_number: '', credit_note_date: '' });

  const recibir = (data) => {
    setLiq(data);
    setDocumentos({ invoice_number: data.invoice_number || '', credit_note_number: data.credit_note_number || '', credit_note_date: data.credit_note_date || '' });
  };

  const cargar = useCallback(() => {
    getSettlement(id)
      .then((res) => recibir(res.data))
      .catch((err) => console.error('ERROR AL CARGAR LA LIQUIDACIÓN:', err))
      .finally(() => setCargando(false));
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const mostrarError = (err, texto) => setToast({ tipo: 'error', mensaje: err.response?.data?.message || texto });

  const registrarPago = async (p) => {
    const f = pagoForm[p.installment] || {};
    setProcesando(true);
    try {
      const res = await paySettlement(liq.id, p.installment, { paid_at: f.paid_at || hoy(), reference: f.reference || null });
      setLiq(res.data);
      setToast({ tipo: 'exito', mensaje: 'Pago registrado correctamente' });
    } catch (err) {
      mostrarError(err, 'Error al registrar el pago');
    } finally {
      setProcesando(false);
    }
  };

  const deshacerPago = async () => {
    setProcesando(true);
    try {
      const res = await unpaySettlement(liq.id, deshacer.installment);
      setLiq(res.data);
      setToast({ tipo: 'exito', mensaje: 'Pago deshecho' });
    } catch (err) {
      mostrarError(err, 'Error al deshacer el pago');
    } finally {
      setProcesando(false);
      setDeshacer(null);
    }
  };

  const guardarDocumentos = async () => {
    setProcesando(true);
    try {
      const res = await saveSettlementDocuments(liq.id, {
        invoice_number: documentos.invoice_number || null,
        credit_note_number: documentos.credit_note_number || null,
        credit_note_date: documentos.credit_note_number ? (documentos.credit_note_date || hoy()) : null,
      });
      recibir(res.data);
      setToast({ tipo: 'exito', mensaje: 'Factura y nota de crédito guardadas' });
    } catch (err) {
      const e = err.response?.data?.errors;
      setToast({ tipo: 'error', mensaje: e ? Object.values(e).flat().join(' ') : (err.response?.data?.message || 'Error al guardar los documentos') });
    } finally {
      setProcesando(false);
    }
  };

  const anularLiquidacion = async () => {
    if (!motivo.trim()) return;
    setProcesando(true);
    try {
      const res = await annulSettlement(liq.id, motivo);
      setLiq(res.data);
      setToast({ tipo: 'exito', mensaje: 'Liquidación anulada' });
    } catch (err) {
      mostrarError(err, 'Error al anular la liquidación');
    } finally {
      setProcesando(false);
      setAnular(false);
    }
  };

  if (cargando) return <div className="p-6 text-gray-400">Cargando liquidación...</div>;
  if (!liq) return <div className="p-6 text-red-600 text-sm">No se encontró la liquidación.</div>;

  const hayPagosRegistrados = liq.payments.some((p) => p.paid_at);
  const pendiente = liq.payments.filter((p) => !p.paid_at).reduce((s, p) => s + Number(p.amount), 0);
  const th = 'px-3 py-2 print:px-1.5 print:py-1 uppercase text-xs print:text-[9px]';
  const td = 'px-3 py-2 print:px-1.5 print:py-0.5';
  const caja = 'bg-white rounded-xl shadow print:shadow-none print:border print:border-gray-300 overflow-hidden mb-4 print:mb-2';
  const titulo = 'px-4 py-3 print:px-2 print:py-1 font-semibold text-gray-800 border-b print:text-xs';
  const inputClass = 'bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';

  return (
    <div id="area-impresion" className="p-6 print:p-3 print:text-[10px]">
      <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />

      {/* Encabezado de impresión */}
      <div className="hidden print:flex justify-between items-start pb-1 mb-2 border-b-2 border-gray-800">
        <div>
          <p className="font-bold text-sm">AGAT-ECUAGREEN S.A.</p>
          <p className="font-bold text-base">LIQUIDACIÓN {liq.code}</p>
        </div>
        <div className="text-right text-[10px] text-gray-600 leading-tight">
          <p>Usuario: {user?.name || '—'}</p>
          <p>Fecha de impresión: {new Date().toLocaleString('es-EC')}</p>
          {!liq.status && <p className="font-bold text-red-700 text-xs">ANULADA</p>}
        </div>
      </div>

      {/* Encabezado en pantalla */}
      <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
        <button type="button" onClick={() => navigate('/liquidacion')} title="Volver" className="p-2 rounded-lg hover:bg-gray-200 text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">
            Liquidación {liq.code}
            {!liq.status && <span className="ml-3 text-sm align-middle px-2 py-0.5 rounded bg-red-100 text-red-700">ANULADA</span>}
          </h1>
          <p className="text-sm text-gray-500">{liq.third_party?.name} · Semana {liq.week} / {liq.year}</p>
        </div>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-primario text-white hover:bg-primario-hover transition">
          <Printer size={18} /> Imprimir
        </button>
        {liq.status && puedeAnular && (
          <button
            type="button"
            onClick={() => (hayPagosRegistrados ? setToast({ tipo: 'error', mensaje: 'Tiene pagos registrados: deshazlos antes de anular' }) : setAnular(true))}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm bg-red-600 text-white hover:bg-red-700 transition"
          >
            <Ban size={18} /> Anular
          </button>
        )}
      </div>

      {!liq.status && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4 print:mb-2">
          ANULADA — Motivo: {liq.cancel_reason}
        </div>
      )}

      {/* Datos generales */}
      <div className={`${caja} p-4 print:p-2 grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-3 print:gap-1 text-sm print:text-[10px]`}>
        <div><p className="text-xs print:text-[9px] text-gray-500 uppercase">Productor</p><p className="font-semibold">{liq.third_party?.name}</p></div>
        <div><p className="text-xs print:text-[9px] text-gray-500 uppercase">RUC / Cédula</p><p>{liq.third_party?.identification || '—'}</p></div>
        <div><p className="text-xs print:text-[9px] text-gray-500 uppercase">Semana</p><p>{liq.week} / {liq.year}</p></div>
        <div><p className="text-xs print:text-[9px] text-gray-500 uppercase">Fecha liquidación</p><p>{formatoFecha(liq.date)}</p></div>
        {liq.notes && <div className="col-span-2 md:col-span-4 print:col-span-4"><p className="text-xs print:text-[9px] text-gray-500 uppercase">Observaciones</p><p>{liq.notes}</p></div>}
      </div>

      {/* Fruta */}
      <div className={caja}>
        <h2 className={titulo}>Fruta</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm print:text-[10px]">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className={`${th} text-left`}>Marca (Cliente)</th>
                <th className={`${th} text-left`}>Tipo · Pago</th>
                <th className={`${th} text-right`}>Comprado</th>
                <th className={`${th} text-right`}>Embarcadas</th>
                <th className={`${th} text-right`}>Caídas</th>
                <th className={`${th} text-right`}>Rechazadas</th>
                <th className={`${th} text-right`}>Pagadas</th>
                <th className={`${th} text-right`}>P. oficial</th>
                <th className={`${th} text-right`}>Precio real</th>
                <th className={`${th} text-right`}>Valor</th>
                <th className={`${th} text-right`}>Nota créd.</th>
              </tr>
            </thead>
            <tbody>
              {liq.lines.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className={td}>{l.purchase?.brand?.name} ({l.purchase?.customer?.third_party?.name}){(l.purchase?.producer || l.purchase?.farm_name) && <span className="block text-xs print:text-[9px] text-gray-500">{[l.purchase?.producer?.name, l.purchase?.farm_name].filter(Boolean).join(' · ')}</span>}</td>
                  <td className={td}>{l.negotiation_type} · {ESQUEMA[l.payment_scheme]}</td>
                  <td className={`${td} text-right`}>{formatoCajas(l.boxes_purchased)}</td>
                  <td className={`${td} text-right`}>{formatoCajas(l.boxes_shipped)}</td>
                  <td className={`${td} text-right`}>{formatoCajas(l.boxes_fallen)}</td>
                  <td className={`${td} text-right`}>{formatoCajas(l.boxes_rejected)}</td>
                  <td className={`${td} text-right font-semibold`}>{formatoCajas(l.boxes_paid)}</td>
                  <td className={`${td} text-right`}>{l.official_price === null ? '—' : `$ ${formatoDinero(l.official_price)}`}</td>
                  <td className={`${td} text-right`}>$ {formatoDinero(l.real_price)}</td>
                  <td className={`${td} text-right font-semibold`}>$ {formatoDinero(l.amount)}</td>
                  <td className={`${td} text-right`}>$ {formatoDinero(l.credit_note_amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 font-bold">
              <tr>
                <td colSpan={3} className={td}>TOTAL FRUTA</td>
                <td className={`${td} text-right`}>{formatoCajas(liq.boxes_shipped)}</td>
                <td className={`${td} text-right`}>{formatoCajas(liq.boxes_fallen)}</td>
                <td className={`${td} text-right`}>{formatoCajas(liq.boxes_rejected)}</td>
                <td className={`${td} text-right`}>{formatoCajas(liq.boxes_paid)}</td>
                <td></td>
                <td></td>
                <td className={`${td} text-right`}>$ {formatoDinero(liq.fruit_amount)}</td>
                <td className={`${td} text-right`}>$ {formatoDinero(liq.credit_note_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 print:grid-cols-2 gap-4 print:gap-2">
        {/* Materiales */}
        <div className={caja}>
          <h2 className={titulo}>Materiales descontados</h2>
          {liq.materials.length === 0 ? <p className="px-4 py-3 text-sm text-gray-400">Sin materiales.</p> : (
            <table className="w-full text-sm print:text-[10px]">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className={`${th} text-left`}>Material</th>
                  <th className={`${th} text-right`}>Retirado</th>
                  <th className={`${th} text-right`}>Devuelto</th>
                  <th className={`${th} text-right`}>Cobrado</th>
                  <th className={`${th} text-right`}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {liq.materials.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className={td}>{m.supply?.name}</td>
                    <td className={`${td} text-right`}>{formatoCantidad(m.dispatched_qty)}</td>
                    <td className={`${td} text-right`}>{Number(m.returned_qty) > 0 ? formatoCantidad(m.returned_qty) : '—'}</td>
                    <td className={`${td} text-right`}>{formatoCantidad(m.charged_qty)}</td>
                    <td className={`${td} text-right`}>$ {formatoDinero(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 font-bold">
                <tr><td colSpan={4} className={td}>TOTAL</td><td className={`${td} text-right`}>$ {formatoDinero(liq.materials_amount)}</td></tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Resumen */}
        <div className={`${caja} p-4 print:p-2 text-sm print:text-[10px]`}>
          <h2 className="font-semibold text-gray-800 mb-2 print:text-xs">Resumen</h2>
          <div className="space-y-1">
            <div className="flex justify-between"><span>Fruta ({formatoCajas(liq.boxes_paid)} cajas)</span><span className="font-semibold">$ {formatoDinero(liq.fruit_amount)}</span></div>
            <div className="flex justify-between text-red-600 print:text-black"><span>(−) Materiales</span><span>$ {formatoDinero(liq.materials_amount)}</span></div>
            {Number(liq.transport_amount) > 0 && <div className="flex justify-between text-red-600 print:text-black"><span>(−) Transporte de contenedor</span><span>$ {formatoDinero(liq.transport_amount)}</span></div>}
            {Number(liq.transport_recognized_amount) > 0 && <div className="flex justify-between text-green-700 print:text-black"><span>(+) Transporte reconocido</span><span>$ {formatoDinero(liq.transport_recognized_amount)}</span></div>}
            <div className="flex justify-between text-red-600 print:text-black"><span>(−) Anticipos / préstamos</span><span>$ {formatoDinero(liq.advances_amount)}</span></div>
            {liq.advances.map((a) => (
              <div key={a.id} className="flex justify-between text-xs print:text-[9px] text-gray-500 pl-4">
                <span>{a.advance?.type === 'PRESTAMO' ? 'Préstamo' : 'Anticipo'} del {formatoFecha(a.advance?.date)}{a.advance?.concept ? ` · ${a.advance.concept}` : ''}</span>
                <span>$ {formatoDinero(a.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-base print:text-xs font-bold text-green-700 print:text-black">
              <span>NETO A PAGAR</span><span>$ {formatoDinero(liq.net_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Factura y nota de crédito del vendedor */}
      <div className={`${caja} p-4 print:p-2 text-sm print:text-[10px]`}>
        <h2 className="font-semibold text-gray-800 mb-2 print:text-xs">
          Factura y nota de crédito del vendedor
          {liq.status && Number(liq.credit_note_amount) > 0 && !liq.credit_note_number && <span className="ml-2 text-xs font-semibold text-amber-700 print:hidden">NOTA DE CRÉDITO PENDIENTE</span>}
          {liq.credit_note_number && <span className="ml-2 text-xs font-semibold text-green-700 print:hidden">✔ RECIBIDA</span>}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-3 print:gap-1 mb-3 print:mb-1">
          <div><p className="text-xs text-gray-500 uppercase">Factura (precio oficial)</p><p className="font-semibold">$ {formatoDinero(liq.invoice_amount)}</p></div>
          <div><p className="text-xs text-gray-500 uppercase">(−) Nota de crédito</p><p className="font-semibold text-primario print:text-black">$ {formatoDinero(liq.credit_note_amount)}</p></div>
          <div><p className="text-xs text-gray-500 uppercase">= Valor de la fruta (precio real)</p><p className="font-semibold">$ {formatoDinero(liq.fruit_amount)}</p></div>
        </div>
        {liq.status && puedeDocumentos && (
          <div className="flex flex-wrap items-end gap-3 print:hidden">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">N° de factura</label>
              <input value={documentos.invoice_number} maxLength={30} onChange={(e) => setDocumentos((d) => ({ ...d, invoice_number: e.target.value.toUpperCase() }))} placeholder="001-001-000000123" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">N° de nota de crédito</label>
              <input value={documentos.credit_note_number} maxLength={30} onChange={(e) => setDocumentos((d) => ({ ...d, credit_note_number: e.target.value.toUpperCase() }))} placeholder="001-001-000000045" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Fecha de la NC</label>
              <input type="date" value={documentos.credit_note_date} onChange={(e) => setDocumentos((d) => ({ ...d, credit_note_date: e.target.value }))} disabled={!documentos.credit_note_number} className={`${inputClass} disabled:opacity-50`} />
            </div>
            <button type="button" onClick={guardarDocumentos} disabled={procesando} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50 transition">
              <Save size={16} /> Guardar
            </button>
          </div>
        )}
        {(liq.invoice_number || liq.credit_note_number) && (
          <p className="text-xs text-gray-500 mt-2 print:mt-0">
            Factura: <strong>{liq.invoice_number || '—'}</strong> · Nota de crédito: <strong>{liq.credit_note_number || '—'}</strong>
            {liq.credit_note_date && ` del ${formatoFecha(liq.credit_note_date)}`}
            {liq.documents_user?.name && <span className="print:hidden"> · registró {liq.documents_user.name}</span>}
          </p>
        )}
      </div>

      {/* Pagos */}
      <div className={caja}>
        <h2 className={titulo}>
          Pagos
          {liq.status && pendiente > 0 && <span className="ml-2 text-xs font-normal text-amber-700 print:hidden">Pendiente: $ {formatoDinero(pendiente)}</span>}
        </h2>
        {liq.payments.length === 0 ? <p className="px-4 py-3 text-sm text-gray-400">Sin pagos (neto cero).</p> : (
          <table className="w-full text-sm print:text-[10px]">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className={`${th} text-left`}>Pago</th>
                <th className={`${th} text-right`}>Monto</th>
                <th className={`${th} text-left`}>Estado</th>
                <th className={`${th} text-left`}>Fecha · Comprobante</th>
                <th className={`${th} print:hidden`}></th>
              </tr>
            </thead>
            <tbody>
              {liq.payments.map((p) => {
                const f = pagoForm[p.installment] || {};
                const setF = (campo, valor) => setPagoForm((prev) => ({ ...prev, [p.installment]: { ...f, [campo]: valor } }));
                return (
                  <tr key={p.id} className="border-t">
                    <td className={`${td} font-medium`}>{p.description}</td>
                    <td className={`${td} text-right font-semibold`}>$ {formatoDinero(p.amount)}</td>
                    <td className={td}>
                      {p.paid_at
                        ? <span className="inline-flex items-center gap-1 text-green-700 font-semibold"><CheckCircle size={14} className="print:hidden" /> PAGADO</span>
                        : <span className="text-amber-700 font-semibold">PENDIENTE</span>}
                    </td>
                    <td className={td}>
                      {p.paid_at ? (
                        <span>{formatoFecha(p.paid_at)}{p.reference ? ` · ${p.reference}` : ''}{p.payer ? <span className="text-xs text-gray-400"> ({p.payer.name})</span> : ''}</span>
                      ) : liq.status && puedePagar ? (
                        <div className="flex flex-wrap gap-2 print:hidden">
                          <input type="date" value={f.paid_at ?? hoy()} onChange={(e) => setF('paid_at', e.target.value)} className={inputClass} />
                          <input placeholder="COMPROBANTE / TRANSFERENCIA" maxLength={60} value={f.reference ?? ''} onChange={(e) => setF('reference', e.target.value.toUpperCase())} className={`${inputClass} w-56`} />
                        </div>
                      ) : '—'}
                    </td>
                    <td className={`${td} text-right print:hidden`}>
                      {liq.status && puedePagar && (p.paid_at ? (
                        <button type="button" onClick={() => setDeshacer(p)} title="Deshacer el registro de este pago" className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                          <Undo2 size={14} /> Deshacer
                        </button>
                      ) : (
                        <button type="button" onClick={() => registrarPago(p)} disabled={procesando} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50">
                          <CheckCircle size={14} /> Registrar pago
                        </button>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Firmas (solo impresión) */}
      <div className="hidden print:flex justify-around mt-10">
        <div className="text-center w-48 border-t border-gray-800 pt-1">ELABORADO POR</div>
        <div className="text-center w-48 border-t border-gray-800 pt-1">RECIBÍ CONFORME (PRODUCTOR)</div>
      </div>

      {deshacer && (
        <DialogoConfirmacion
          titulo="Deshacer pago"
          procesando={procesando}
          onCancelar={() => setDeshacer(null)}
          onAceptar={deshacerPago}
        >
          ¿Seguro que el <strong>{deshacer.description}</strong> por $ {formatoDinero(deshacer.amount)} no se pagó? Se borrará su fecha y comprobante.
        </DialogoConfirmacion>
      )}

      {anular && (
        <DialogoConfirmacion
          titulo={`Anular ${liq.code}`}
          textoAceptar="Anular"
          procesando={procesando || !motivo.trim()}
          onCancelar={() => setAnular(false)}
          onAceptar={anularLiquidacion}
        >
          El cupo de la semana {liq.week} vuelve a quedar abierto y los anticipos recuperan su saldo.
          <input
            autoFocus value={motivo} maxLength={255} onChange={(e) => setMotivo(e.target.value.toUpperCase())}
            placeholder="MOTIVO DE LA ANULACIÓN *"
            className="mt-3 w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-red-500"
          />
        </DialogoConfirmacion>
      )}
    </div>
  );
}
