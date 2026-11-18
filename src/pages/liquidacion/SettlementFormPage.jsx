// Nueva liquidación de un cupo (productor + semana)
// Ubicación: src/pages/liquidacion/SettlementFormPage.jsx
// Ruta: /liquidacion/cupo/:quotaId
//
// Muestra el cálculo que hace el backend (GET /settlements/preview):
//   Fruta      = (embarcadas + caídas) × precio real de cada compra (rechazadas no se pagan)
//   Materiales = (retirado − devuelto) × costo, solo categorías que se cobran al productor
//   Anticipos  = se eligen aquí (todo o parte del saldo)
// y los pagos: compras "100 %" completas en el 1er pago; "80/20" → 80 % en el 1er pago y
// 20 % en el 2do. Los descuentos salen del 1er pago. El backend recalcula todo al guardar.
// 17/11/2026 (FASE 0): el cupo se liquida en varias LQ, como el Excel: una por cada CONTRATO y una de SPOT.
//   Se pagan las RECIBIDAS (embarcadas − caídas − rechazadas − faltantes). Cada LQ lleva su retención IR
//   (tramo por sus recibidas; base = recibidas × el mayor entre el real y el oficial). Materiales y anticipos
//   se descuentan en la LQ de mayor valor de fruta.
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calculator, X, AlertTriangle } from 'lucide-react';
import { getSettlementPreview, createSettlement } from '../../api/settlements';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import CampoNumero from '../../components/common/CampoNumero';
import { hoyISO } from '../../utils/fecha';

const formatoCajas = (n) => Number(n || 0).toLocaleString('es-EC');
const formatoDinero = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatoCantidad = (n) => Number(n || 0).toLocaleString('es-EC', { maximumFractionDigits: 2 });
const formatoFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');
const r2 = (n) => Math.round(n * 100) / 100;
const hoy = () => hoyISO();

const ESQUEMA = { 100: 'PAGO 100 %', '80_20': 'PAGO 80 / 20' };

// Misma fórmula que SettlementController::pagos() (descuentos = materiales + transporte)
const calcularPagos = (lineas, descuentos, anticipos) => {
  const completo = r2(lineas.filter((l) => l.payment_scheme === '100').reduce((s, l) => s + Number(l.amount), 0));
  const ochentaVeinte = r2(lineas.filter((l) => l.payment_scheme === '80_20').reduce((s, l) => s + Number(l.amount), 0));
  let segundo = r2(ochentaVeinte * 0.2);
  let primero = r2(completo + ochentaVeinte - segundo - descuentos - anticipos);
  if (primero < 0) {
    segundo = r2(segundo + primero);
    primero = 0;
  }
  const nombre1 = ochentaVeinte === 0 ? 'PAGO ÚNICO (100 %)' : completo === 0 ? 'PRIMER PAGO (80 %)' : 'PRIMER PAGO (100 % + 80 %)';
  return [
    { installment: 1, description: nombre1, amount: primero },
    { installment: 2, description: 'SEGUNDO PAGO (20 %)', amount: segundo },
  ].filter((p) => p.amount > 0);
};

export default function SettlementFormPage() {
  const { quotaId } = useParams();
  const navigate = useNavigate();

  const [datos, setDatos] = useState(null);
  const [aplicar, setAplicar] = useState({}); // { anticipoId: 'monto' }
  const [fecha, setFecha] = useState(hoy());
  const [notas, setNotas] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    getSettlementPreview(quotaId)
      .then((res) => {
        // Si ya está liquidado, se va directo a la liquidación (17/11/2026: la primera de sus LQ)
        if (res.data.settlements?.length) {
          navigate(`/liquidacion/${res.data.settlements[0].id}`, { replace: true });
          return;
        }
        setDatos(res.data);
      })
      .catch((err) => {
        console.error('ERROR AL CALCULAR LA LIQUIDACIÓN:', err);
        setError(err.response?.data?.message || 'NO SE PUDO CALCULAR LA LIQUIDACIÓN.');
      })
      .finally(() => setCargando(false));
  }, [quotaId, navigate]);

  if (cargando) return <div className="p-6 text-gray-400">Calculando liquidación...</div>;
  if (!datos) return <div className="p-6 text-red-600 text-sm">{error}</div>;

  const totalAnticipos = r2(Object.values(aplicar).reduce((s, v) => s + (Number(v) || 0), 0));
  // 17/11/2026: una LQ por grupo (igual que SettlementController::store). Descuentos fijos de cada LQ:
  // materiales (solo la de mayor valor) + transporte negociado − transporte reconocido − bono + retención IR
  const lqs = (datos.groups || []).map((g) => {
    const materiales = g.lleva_descuentos ? Number(datos.materials_amount) : 0;
    const anticipos = g.lleva_descuentos ? totalAnticipos : 0;
    const fijos = r2(materiales + Number(g.transport_amount) - Number(g.transport_recognized_amount) - Number(g.bonus_amount) + Number(g.retention_amount));
    const neto = r2(Number(g.fruit_amount) - fijos - anticipos);
    return { ...g, materiales, anticipos, neto, pagos: calcularPagos(g.lines, fijos, anticipos) };
  });
  const principal = lqs.find((g) => g.lleva_descuentos);
  const neto = r2(lqs.reduce((s, g) => s + g.neto, 0));
  const grupoDe = Object.fromEntries(lqs.flatMap((g) => g.lines.map((l) => [l.producer_quota_line_id, g.group_label])));
  const anticipoExcedido = datos.advances.some((a) => Number(aplicar[a.id] || 0) > a.saldo);
  const puedeLiquidar = datos.problemas.length === 0 && lqs.length > 0 && lqs.every((g) => g.neto >= 0) && !anticipoExcedido && fecha;

  const marcarAnticipo = (a, marcado) => {
    setAplicar((prev) => {
      const nuevo = { ...prev };
      if (marcado) {
        // Propone descontar todo el saldo, sin pasar lo que queda en la LQ que lleva los descuentos
        const disponible = principal ? principal.neto : 0;
        nuevo[a.id] = String(Math.max(0, Math.min(a.saldo, disponible)));
      } else {
        delete nuevo[a.id];
      }
      return nuevo;
    });
  };

  const handleLiquidar = async () => {
    setGuardando(true);
    setError('');
    try {
      const res = await createSettlement({
        producer_quota_id: Number(quotaId),
        date: fecha,
        notes: notas || null,
        advances: Object.entries(aplicar)
          .filter(([, v]) => Number(v) > 0)
          .map(([anticipoId, v]) => ({ id: Number(anticipoId), amount: Number(v) })),
      });
      navigate(`/liquidacion/${res.data.id}`, { replace: true });
    } catch (err) {
      console.error('ERROR AL LIQUIDAR:', err);
      const e = err.response?.data?.errors;
      setError(e ? Object.values(e).flat().join(' ') : (err.response?.data?.message || 'Error al liquidar'));
      setConfirmar(false);
    } finally {
      setGuardando(false);
    }
  };

  const { quota } = datos;
  const thClass = 'px-3 py-2 uppercase text-xs';
  const inputClass = 'bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
  // 18/11/2026 (Peter): fruta y materiales como las listas compactas (# gris, línea fina, filas alternadas) y los
  // anticipos como la grilla de Compra de fruta (tipo SAP): la fila donde se trabaja en verde, la celda en amarillo
  const tdLectura = 'px-3 py-1.5 border border-gray-200';
  const tdGrilla = 'px-0.5 py-0 border border-gray-200 align-middle focus-within:bg-yellow-100 focus-within:text-gray-900';
  const celda = 'bg-transparent border-0 rounded-none px-1.5 py-0.5 text-sm text-inherit outline-none disabled:opacity-60 disabled:cursor-not-allowed';
  const tdNumero = 'bg-gray-200 border border-gray-300 px-1 py-0.5 text-center text-sm font-bold text-gray-700 whitespace-nowrap cursor-pointer outline-none';

  return (
    <div className="p-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-4">
        <button type="button" onClick={() => navigate('/liquidacion')} title="Volver" className="p-2 rounded-lg hover:bg-gray-200 text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Liquidar — {quota.third_party?.name}</h1>
          <p className="text-sm text-gray-500">Semana {quota.week} / {quota.year} · revisa el cálculo, elige los anticipos a descontar y liquida</p>
        </div>
      </div>

      {datos.problemas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3 mb-4 flex gap-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Todavía no se puede liquidar:</p>
            {datos.problemas.map((p) => <p key={p}>{p}</p>)}
          </div>
        </div>
      )}

      {/* 13/11/2026: avisos que no impiden liquidar (ej. compras POR DIVIDIR de una comercializadora) */}
      {datos.avisos?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3 mb-4 flex gap-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>{datos.avisos.map((p) => <p key={p}>{p}</p>)}</div>
        </div>
      )}

      {/* 1. Fruta */}
      <div className="bg-white rounded-xl shadow overflow-x-auto mb-4">
        <h2 className="px-4 py-3 font-semibold text-gray-800 border-b">1. Fruta (según tarjas: se pagan las recibidas)</h2>
        <table className="w-full text-sm border-collapse min-w-[950px]">
          <thead className="bg-primario text-white">
            <tr>
              <th className="text-center px-2 py-2 text-xs w-10">#</th>
              <th className={`${thClass} text-left`}>Marca (Cliente)</th>
              <th className={`${thClass} text-left`}>LQ · Pago</th>
              <th className={`${thClass} text-right`}>Comprado</th>
              <th className={`${thClass} text-right`}>Embarcadas</th>
              <th className={`${thClass} text-right`}>Caídas</th>
              <th className={`${thClass} text-right`}>Rechazadas</th>
              <th className={`${thClass} text-right`}>Faltantes</th>
              <th className={`${thClass} text-right`}>Recibidas</th>
              <th className={`${thClass} text-right`}>P. oficial</th>
              <th className={`${thClass} text-right`}>Precio real</th>
              <th className={`${thClass} text-right`}>Valor</th>
              <th className={`${thClass} text-right`} title="Recibidas × (oficial − real)">Nota créd.</th>
            </tr>
          </thead>
          <tbody>
            {datos.lines.map((l, i) => (
              <tr key={l.producer_quota_line_id} className={i % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-violet-50 hover:bg-yellow-50'}>
                <td className="bg-gray-200 border border-gray-300 px-1 py-1.5 text-center text-sm font-bold text-gray-700">{i + 1}</td>
                <td className={`${tdLectura} font-medium`}>{l.brand} <span className="text-gray-500 font-normal">({l.customer})</span>{(l.producer || l.farm_name) && <span className="block text-xs text-gray-500 font-normal">{[l.producer, l.farm_name].filter(Boolean).join(' · ')}</span>}{l.transport_deduction > 0 && <span className="block text-xs text-red-600 font-normal">Transporte − $ {formatoDinero(l.transport_deduction)}</span>}{l.transport_recognized > 0 && <span className="block text-xs text-green-700 font-normal">Transporte reconocido + $ {formatoDinero(l.transport_recognized)} ({formatoCajas(l.boxes_paid)} × $ {l.transport_recognized_rate})</span>}{l.bonus_amount > 0 && <span className="block text-xs text-green-700 font-normal">Bono {(l.bonus_reason || '').replace('_', ' ')}{l.bonus_detail ? ` (${l.bonus_detail})` : ''} + $ {formatoDinero(l.bonus_amount)} ({formatoCajas(l.boxes_paid)} × $ {l.bonus_rate})</span>}</td>
                <td className={`${tdLectura} text-xs`}><span className="font-semibold">{grupoDe[l.producer_quota_line_id] || l.negotiation_type}</span> · {ESQUEMA[l.payment_scheme]}</td>
                <td className={`${tdLectura} text-right`}>{formatoCajas(l.boxes_purchased)}</td>
                <td className={`${tdLectura} text-right`}>{formatoCajas(l.boxes_shipped)}</td>
                <td className={`${tdLectura} text-right`}>{formatoCajas(l.boxes_fallen)}</td>
                <td className={`${tdLectura} text-right text-red-600`}>{formatoCajas(l.boxes_rejected)}</td>
                <td className={`${tdLectura} text-right`}>{formatoCajas(l.boxes_missing)}</td>
                <td className={`${tdLectura} text-right font-semibold`}>{formatoCajas(l.boxes_paid)}</td>
                <td className={`${tdLectura} text-right`}>{l.official_price === null ? <span className="text-xs font-semibold text-red-600">FALTA</span> : `$ ${formatoDinero(l.official_price)}`}</td>
                <td className={`${tdLectura} text-right`}>$ {formatoDinero(l.real_price)}</td>
                <td className={`${tdLectura} text-right font-semibold`}>$ {formatoDinero(l.amount)}</td>
                <td className={`${tdLectura} text-right`}>$ {formatoDinero(l.credit_note_amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 font-bold">
            <tr>
              <td colSpan={4} className={tdLectura}>TOTAL FRUTA</td>
              <td className={`${tdLectura} text-right`}>{formatoCajas(datos.boxes_shipped)}</td>
              <td className={`${tdLectura} text-right`}>{formatoCajas(datos.boxes_fallen)}</td>
              <td className={`${tdLectura} text-right text-red-600`}>{formatoCajas(datos.boxes_rejected)}</td>
              <td className={`${tdLectura} text-right`}>{formatoCajas(datos.boxes_missing)}</td>
              <td className={`${tdLectura} text-right`}>{formatoCajas(datos.boxes_paid)}</td>
              <td className="border border-gray-200"></td>
              <td className="border border-gray-200"></td>
              <td className={`${tdLectura} text-right text-green-700`}>$ {formatoDinero(datos.fruit_amount)}</td>
              <td className={`${tdLectura} text-right`}>$ {formatoDinero(datos.credit_note_amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 2. Materiales */}
      <div className="bg-white rounded-xl shadow overflow-x-auto mb-4">
        <h2 className="px-4 py-3 font-semibold text-gray-800 border-b">2. Materiales retirados (se descuentan{principal && lqs.length > 1 ? ` en ${principal.group_label}` : ''})</h2>
        {datos.materials.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400">No retiró materiales que se cobren al productor.</p>
        ) : (
          <table className="w-full text-sm border-collapse min-w-[750px]">
            <thead className="bg-primario text-white">
              <tr>
              <th className="text-center px-2 py-2 text-xs w-10">#</th>
                <th className={`${thClass} text-left`}>Material</th>
                <th className={`${thClass} text-right`}>Retirado</th>
                <th className={`${thClass} text-right`}>Devuelto</th>
                <th className={`${thClass} text-right`}>Se cobra</th>
                <th className={`${thClass} text-right`}>Costo unit.</th>
                <th className={`${thClass} text-right`}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {datos.materials.map((m, i) => (
                <tr key={m.supply_id} className={i % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-violet-50 hover:bg-yellow-50'}>
                  <td className="bg-gray-200 border border-gray-300 px-1 py-1.5 text-center text-sm font-bold text-gray-700">{i + 1}</td>
                  <td className={tdLectura}>{m.name} <span className="text-xs text-gray-400">{m.unit}</span></td>
                  <td className={`${tdLectura} text-right`}>{formatoCantidad(m.dispatched_qty)}</td>
                  <td className={`${tdLectura} text-right text-green-700`}>{m.returned_qty > 0 ? formatoCantidad(m.returned_qty) : '—'}</td>
                  <td className={`${tdLectura} text-right font-semibold`}>{formatoCantidad(m.charged_qty)}</td>
                  <td className={`${tdLectura} text-right`}>$ {Number(m.unit_cost).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                  <td className={`${tdLectura} text-right font-semibold`}>$ {formatoDinero(m.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 font-bold">
              <tr>
                <td colSpan={6} className={tdLectura}>TOTAL MATERIALES</td>
                <td className={`${tdLectura} text-right text-red-600`}>− $ {formatoDinero(datos.materials_amount)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* 3. Anticipos */}
      <div className="bg-white rounded-xl shadow overflow-x-auto mb-4">
        <h2 className="px-4 py-3 font-semibold text-gray-800 border-b">3. Anticipos y préstamos con saldo{principal && lqs.length > 1 ? ` (se descuentan en ${principal.group_label})` : ''}</h2>
        {datos.advances.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400">El productor no tiene anticipos ni préstamos pendientes.</p>
        ) : (
          <table className="w-full text-sm border-collapse min-w-[750px]">
            <thead className="bg-primario text-white">
              <tr>
                <th className="text-center px-2 py-2 text-xs w-10">#</th>
                <th className={`${thClass} text-left w-24`}>Descontar</th>
                <th className={`${thClass} text-left`}>Fecha</th>
                <th className={`${thClass} text-left`}>Tipo · Concepto</th>
                <th className={`${thClass} text-right`}>Saldo</th>
                <th className={`${thClass} text-right`}>A descontar</th>
              </tr>
            </thead>
            <tbody>
              {datos.advances.map((a, i) => {
                const marcado = aplicar[a.id] !== undefined;
                const excede = Number(aplicar[a.id] || 0) > a.saldo;
                return (
                  <tr key={a.id} className={`fila-grilla group text-gray-800 ${i % 2 === 0 ? 'bg-white' : 'bg-violet-50'} focus-within:bg-green-600 focus-within:text-white`}>
                    <td tabIndex={-1} title="Clic para marcar la fila" className={tdNumero}><span className="hidden group-focus-within:inline text-primario mr-0.5" aria-hidden="true">▶</span>{i + 1}</td>
                    <td className={`${tdGrilla} px-3`}><input type="checkbox" checked={marcado} onChange={(e) => marcarAnticipo(a, e.target.checked)} className="w-4 h-4 accent-primario" /></td>
                    <td className={tdLectura}>{formatoFecha(a.date)}</td>
                    <td className={tdLectura}>{a.type === 'PRESTAMO' ? 'PRÉSTAMO' : 'ANTICIPO'}{a.concept ? ` · ${a.concept}` : ''}</td>
                    <td className={`${tdLectura} text-right`}>$ {formatoDinero(a.saldo)}</td>
                    <td className={`${tdGrilla} text-right`}>
                      <CampoNumero decimales={2}
                        value={aplicar[a.id] ?? ''} disabled={!marcado}
                        onChange={(e) => setAplicar((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        className={`${celda} w-32 text-right disabled:opacity-40 ${excede ? 'shadow-[inset_0_0_0_2px_#ef4444]' : ''}`}
                      />
                      {excede && <span className="block text-[10px] text-red-600">Mayor que el saldo</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Resumen y pagos. 17/11/2026: una tarjeta por LQ (cada contrato y SPOT) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {lqs.map((g) => (
          <div key={g.key} className="bg-white rounded-xl shadow p-4 text-sm">
            <h2 className="font-semibold text-gray-800 mb-3">{g.group_label}{g.lleva_descuentos && lqs.length > 1 && <span className="ml-2 text-xs font-normal text-gray-500">(lleva materiales y anticipos)</span>}</h2>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span>Fruta ({formatoCajas(g.boxes_paid)} cajas recibidas)</span><span className="font-semibold">$ {formatoDinero(g.fruit_amount)}</span></div>
              <div className="flex justify-between text-red-600">
                <span title={`Base $ ${formatoDinero(g.retention_base)} (recibidas × el mayor entre el precio real y el oficial)`}>(−) Retención IR {g.retention_regime === 'NO_RETENER' ? '(NO RETENER)' : `${(Number(g.retention_rate) * 100).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %${g.retention_regime === 'BPA' ? ' BPA' : ''}`}</span>
                <span>$ {formatoDinero(g.retention_amount)}</span>
              </div>
              {g.lleva_descuentos && <div className="flex justify-between text-red-600"><span>(−) Materiales</span><span>$ {formatoDinero(g.materiales)}</span></div>}
              {Number(g.transport_amount) > 0 && <div className="flex justify-between text-red-600"><span>(−) Transporte de contenedor</span><span>$ {formatoDinero(g.transport_amount)}</span></div>}
              {Number(g.transport_recognized_amount) > 0 && <div className="flex justify-between text-green-700"><span>(+) Transporte reconocido</span><span>$ {formatoDinero(g.transport_recognized_amount)}</span></div>}
              {/* 13/11/2026: bono / extra (pago aparte, va en el 1er pago) */}
              {Number(g.bonus_amount) > 0 && <div className="flex justify-between text-green-700"><span>(+) Bono / extra</span><span>$ {formatoDinero(g.bonus_amount)}</span></div>}
              {g.lleva_descuentos && <div className="flex justify-between text-red-600"><span>(−) Anticipos / préstamos</span><span>$ {formatoDinero(g.anticipos)}</span></div>}
              <div className={`flex justify-between border-t pt-2 text-base font-bold ${g.neto < 0 ? 'text-red-600' : 'text-green-700'}`}>
                <span>NETO A PAGAR</span><span>$ {formatoDinero(g.neto)}</span>
              </div>
              {g.neto < 0 && <p className="text-xs text-red-600">Los descuentos superan el valor de la fruta: descuenta menos anticipo.</p>}
              {/* 30/10/2026: el vendedor factura al precio oficial MAG y devuelve la diferencia con una nota de crédito */}
              <div className="mt-3 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 space-y-1">
                <div className="flex justify-between"><span>Factura del vendedor (precio oficial)</span><span className="font-semibold">$ {formatoDinero(g.invoice_amount)}</span></div>
                <div className="flex justify-between"><span>Nota de crédito que debe entregar</span><span className="font-semibold text-primario">$ {formatoDinero(g.credit_note_amount)}</span></div>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Pagos</p>
                {g.pagos.length === 0 ? <p className="text-gray-400">No hay nada que pagar.</p> : g.pagos.map((p) => (
                  <div key={p.installment} className="flex justify-between py-1 border-b last:border-0">
                    <span>{p.description}</span><span className="font-semibold">$ {formatoDinero(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {lqs.length > 1 && (
        <div className="bg-white rounded-xl shadow px-4 py-3 mb-4 flex justify-between text-base font-bold text-green-700">
          <span>NETO TOTAL ({lqs.length} liquidaciones)</span><span>$ {formatoDinero(neto)}</span>
        </div>
      )}
      <p className="text-xs text-gray-500 mb-4">Factura − nota de crédito = valor de la fruta. Los descuentos salen del primer pago. Cada pago y los números de factura y NC se registran después en el detalle de cada liquidación.</p>

      {/* Datos de la liquidación */}
      <div className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Fecha de liquidación *</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${inputClass} w-full`} />
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Observaciones</label>
          <input value={notas} maxLength={500} onChange={(e) => setNotas(e.target.value.toUpperCase())} className={`${inputClass} w-full`} />
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate('/liquidacion')} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-cancelar text-cancelar-texto hover:bg-cancelar-hover transition">
          <X size={16} /> Cancelar
        </button>
        <button type="button" onClick={() => setConfirmar(true)} disabled={!puedeLiquidar} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50 disabled:hover:bg-guardar transition">
          <Calculator size={16} /> Liquidar
        </button>
      </div>

      {confirmar && (
        <DialogoConfirmacion
          titulo="¿Liquidar este cupo?"
          peligro={false}
          textoAceptar={guardando ? 'Liquidando...' : 'Sí, liquidar'}
          procesando={guardando}
          onCancelar={() => setConfirmar(false)}
          onAceptar={handleLiquidar}
        >
          {quota.third_party?.name}, semana {quota.week}: {lqs.length > 1 ? `${lqs.length} liquidaciones (${lqs.map((g) => g.group_label).join(', ')}), ` : ''}neto <strong>$ {formatoDinero(neto)}</strong>.
          Después ya no se le podrá despachar ni devolver material de esta semana, ni cambiar sus tarjas.
        </DialogoConfirmacion>
      )}
    </div>
  );
}
