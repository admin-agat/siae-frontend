// 13/11/2026: DIVIDIR COMPRA (Compra de fruta). Una comercializadora (ASCUPOESPE…) avisa el retiro de
// material para N cajas y esa noche manda el CUADRO DE DESPACHO con productor, finca, marca y cajas.
// Aquí se pega el cuadro (o se llenan las filas a mano) y la compra se divide: la compra original queda
// como la primera fila de su bloque y se crean las demás. Las filas BANDA van al bloque PACKED (SPOT).
// Diseño: docs/modulos/compra-global-division.md. El backend vuelve a validar todo.
import { useMemo, useState } from 'react';
import { Plus, Trash2, ClipboardPaste } from 'lucide-react';
import ModalShell from './common/ModalShell';
import SelectBuscable from './common/SelectBuscable';
import CampoNumero from './common/CampoNumero';
import DialogoConfirmacion from './common/DialogoConfirmacion';
import { splitPurchase, createPurchaseFarm } from '../api/customerOrders';
import { leerCuadro, buscarPorNombre, normalizar } from '../utils/cuadroDespacho';

let contador = 0;
const clave = () => `d-${++contador}`;
const n = (v) => Number(v) || 0;
const cajasTexto = (v) => n(v).toLocaleString('es-EC');

export default function DividirCompraModal({
  orderId, version, compra, bloque, bloques, etiquetaBloque, vendedor, esComercializadora,
  productores, fincas, onFincaCreada, onClose, onDividido,
}) {
  const original = n(compra.boxes);
  const filaVacia = (extra = {}) => ({
    _key: clave(), purchase_block_id: String(bloque.id), producer_id: '', farm_id: '', boxes: '', real_price: '', notes: '',
    texto_productor: '', texto_finca: '', ...extra,
  });
  // Arranca con la compra tal como está (si ya tiene productor/finca) para completar las demás filas
  const [filas, setFilas] = useState(() => [filaVacia({
    producer_id: compra.pending_split ? '' : (compra.producer_id || ''),
    farm_id: compra.pending_split ? '' : (compra.farm_id || ''),
    boxes: compra.boxes,
  })]);
  const [pegado, setPegado] = useState('');
  const [saldo, setSaldo] = useState('REDUCE');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [nuevaFinca, setNuevaFinca] = useState(null); // { key, producer_id, dueno, name, magap_code }

  // Bloques guardados del pedido: primero los del mismo barco
  const opcionesBloque = useMemo(() => bloques.filter((b) => b.id)
    .sort((a, b) => (a.shipment_id === bloque.shipment_id ? 0 : 1) - (b.shipment_id === bloque.shipment_id ? 0 : 1)), [bloques, bloque]);
  const bloqueDe = (id) => bloques.find((b) => String(b.id) === String(id));
  const duenoDe = (f) => (esComercializadora ? f.producer_id : String(compra.third_party_id));
  const fincasDe = (tpId) => fincas.filter((x) => String(x.third_party_id) === String(tpId) && x.status);

  const suma = filas.reduce((s, f) => s + n(f.boxes), 0);
  const falta = original - suma;

  const cambiar = (key, campo, valor) => setFilas((prev) => prev.map((f) => {
    if (f._key !== key) return f;
    const nueva = { ...f, [campo]: valor };
    // Al elegir productor se propone su finca si tiene una sola
    if (campo === 'producer_id') {
      const propias = fincasDe(valor);
      nueva.farm_id = propias.length === 1 ? String(propias[0].id) : '';
    }
    return nueva;
  }));
  const quitar = (key) => setFilas((prev) => prev.filter((f) => f._key !== key));

  // Marca del cuadro → bloque del mismo barco. "BANDA …" = PACKED; si no dice marca, el bloque de la compra.
  const bloqueParaMarca = (marca) => {
    const m = normalizar(marca);
    const delBarco = opcionesBloque.filter((b) => b.shipment_id === bloque.shipment_id);
    if (!m) return bloque;
    const packed = m.includes('BANDA');
    const candidatos = delBarco.filter((b) => (b.presentation === 'PACKED') === packed);
    // etiquetaBloque(b, true) = solo el nombre de la marca ("GLOBAL VILLAGE")
    const porNombre = candidatos.filter((b) => {
      const nombre = normalizar(etiquetaBloque(b, true));
      return nombre && m.includes(nombre);
    });
    if (porNombre.length === 1) return porNombre[0];
    if (candidatos.length === 1) return candidatos[0];
    if (!packed && bloque.presentation !== 'PACKED') return bloque;
    return null;
  };

  const leer = () => {
    setError('');
    const leidas = leerCuadro(pegado);
    if (!leidas.length) { setAviso('NO SE ENCONTRARON FILAS CON PRODUCTOR Y CAJAS EN LO PEGADO.'); return; }
    const sinCruce = [];
    const nuevas = leidas.map((x, i) => {
      const prod = esComercializadora ? buscarPorNombre(productores, x.productor) : null;
      const dueno = esComercializadora ? prod?.id : compra.third_party_id;
      const propias = dueno ? fincasDe(dueno) : [];
      const finca = x.finca ? buscarPorNombre(propias, x.finca) : (propias.length === 1 ? propias[0] : null);
      const b = bloqueParaMarca(x.marca);
      if ((esComercializadora && !prod) || !finca || !b) sinCruce.push(i + 1);
      return filaVacia({
        purchase_block_id: b ? String(b.id) : '',
        producer_id: prod ? String(prod.id) : '',
        farm_id: finca ? String(finca.id) : '',
        boxes: String(x.cajas),
        notes: [x.zona, x.magap, x.ubicacion].filter(Boolean).join(' · ').toUpperCase().slice(0, 255),
        texto_productor: x.productor.toUpperCase(),
        texto_finca: (x.finca || '').toUpperCase(),
        texto_marca: (x.marca || '').toUpperCase(),
      });
    });
    setFilas(nuevas);
    setAviso(`SE LEYERON ${nuevas.length} FILAS (${cajasTexto(nuevas.reduce((s, f) => s + n(f.boxes), 0))} CAJAS).`
      + (sinCruce.length ? ` REVISA LAS FILAS EN ROJO (${sinCruce.join(', ')}): ELIGE A MANO EL PRODUCTOR, LA FINCA O LA MARCA.` : ''));
  };

  const validar = () => {
    if (!filas.length) return 'AGREGA AL MENOS UNA FILA.';
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const b = bloqueDe(f.purchase_block_id);
      if (!b) return `FILA ${i + 1}: ELIGE EL BLOQUE (MARCA).`;
      if (esComercializadora && !f.producer_id) return `FILA ${i + 1}: ELIGE EL PRODUCTOR${f.texto_productor ? ` (EN EL CUADRO: ${f.texto_productor})` : ''}.`;
      if (!f.farm_id) return `FILA ${i + 1}: FALTA LA FINCA.`;
      if (!n(f.boxes)) return `FILA ${i + 1}: FALTAN LAS CAJAS.`;
      if (b.presentation === 'PACKED' && String(b.id) !== String(bloque.id) && f.real_price === '') {
        return `FILA ${i + 1}: LA FRUTA PACKED SE COMPRA SIEMPRE SPOT: ESCRIBE EL PRECIO REAL.`;
      }
    }
    if (!filas.some((f) => String(f.purchase_block_id) === String(bloque.id))) {
      return `AL MENOS UNA FILA DEBE QUEDAR EN EL BLOQUE ORIGINAL (${etiquetaBloque(bloque)}).`;
    }
    if (filas.length < 2 && !(falta > 0 && saldo === 'KEEP')) return 'EL CUADRO DEBE TENER AL MENOS DOS FILAS.';
    return '';
  };

  const pedirConfirmacion = (e) => {
    e.preventDefault();
    const msg = validar();
    setError(msg);
    if (!msg) setConfirmar(true);
  };

  const dividir = async () => {
    setConfirmar(false);
    setGuardando(true);
    setError('');
    const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    try {
      const { data } = await splitPurchase(orderId, compra.id, {
        version,
        remainder: falta > 0 ? saldo : null,
        rows: filas.map((f) => ({
          purchase_block_id: Number(f.purchase_block_id),
          producer_id: esComercializadora ? num(f.producer_id) : null,
          farm_id: num(f.farm_id),
          boxes: Number(f.boxes),
          real_price: num(f.real_price),
          notes: f.notes || null,
        })),
      });
      onDividido(data);
    } catch (err) {
      const e = err.response?.data?.errors;
      setError(e ? Object.values(e).flat().join(' ') : err.response?.data?.message || 'NO SE PUDO DIVIDIR LA COMPRA.');
      setGuardando(false);
    }
  };

  const guardarNuevaFinca = async () => {
    if (!nuevaFinca.name.trim()) { setError('ESCRIBE EL NOMBRE DE LA FINCA.'); return; }
    try {
      const { data } = await createPurchaseFarm(orderId, {
        third_party_id: Number(nuevaFinca.producer_id), name: nuevaFinca.name, magap_code: nuevaFinca.magap_code || null,
      });
      onFincaCreada(data);
      setFilas((prev) => prev.map((f) => (f._key === nuevaFinca.key ? { ...f, farm_id: String(data.id) } : f)));
      setNuevaFinca(null);
      setError('');
    } catch (err) {
      const e = err.response?.data?.errors;
      setError(e ? Object.values(e).flat().join(' ') : err.response?.data?.message || 'NO SE PUDO CREAR LA FINCA.');
    }
  };

  const inputClass = 'w-full bg-gray-100 rounded-2xl border border-gray-200 px-2 py-1.5 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-primario';
  const rojo = 'ring-1 ring-red-500';
  const productorNombre = (id) => productores.find((p) => String(p.id) === String(id))?.name || '';

  return (
    <>
      <ModalShell title="Dividir compra" size="lg" onClose={onClose} onSubmit={pedirConfirmacion} guardando={guardando} error={error}>
        {/* Cabecera: qué compra se divide */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs bg-gray-50 rounded-xl p-3">
          <div><span className="block text-gray-500">Vendedor</span><span className="font-semibold">{vendedor}</span></div>
          <div><span className="block text-gray-500">Bloque</span><span className="font-semibold">{etiquetaBloque(bloque)}</span></div>
          <div><span className="block text-gray-500">Cajas de la compra</span><span className="font-semibold">{cajasTexto(original)}</span></div>
          <div>
            <span className="block text-gray-500">Estado</span>
            <span className="font-semibold">
              {compra.pending_split ? 'POR DIVIDIR' : 'CON PRODUCTOR'}{compra.enviada ? ' · ENVIADA A BODEGA' : ''}{compra.despachada ? ' · YA RETIRÓ MATERIAL' : ''}
            </span>
          </div>
        </div>

        {/* Pegar el cuadro de despacho */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Pega el cuadro de despacho (desde Excel o WhatsApp)</label>
          <textarea value={pegado} onChange={(e) => setPegado(e.target.value)} rows={4}
            placeholder={'ZONA\tMARCA\tPRODUCTOR\tCANTIDAD\tNOMBRE DE FINCA\tMAGAP\tUBICACIÓN'}
            className="w-full bg-gray-100 rounded-2xl border border-gray-200 px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primario" />
          <div className="flex items-center gap-3 mt-1">
            <button type="button" onClick={leer} disabled={!pegado.trim()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primario text-white hover:opacity-90 disabled:opacity-40">
              <ClipboardPaste size={14} /> Leer cuadro
            </button>
            {aviso && <span className="text-xs text-gray-600">{aviso}</span>}
          </div>
        </div>

        {/* Filas de la división */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-1 py-1">#</th>
                <th className="px-1 py-1 min-w-[170px]">Bloque (marca)</th>
                {esComercializadora && <th className="px-1 py-1 min-w-[180px]">Productor</th>}
                <th className="px-1 py-1 min-w-[160px]">Finca</th>
                <th className="px-1 py-1 w-20">Cajas</th>
                <th className="px-1 py-1 w-20" title="Vacío = el de la compra. Obligatorio en filas PACKED de otro bloque">P. real</th>
                <th className="px-1 py-1 min-w-[150px]">Notas</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => {
                const b = bloqueDe(f.purchase_block_id);
                const dueno = duenoDe(f);
                const propias = dueno ? fincasDe(dueno) : [];
                const pidePrecio = b?.presentation === 'PACKED' && String(b.id) !== String(bloque.id);
                return (
                  <tr key={f._key} className={i % 2 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-1 py-1 text-gray-400">{i + 1}</td>
                    <td className="px-1 py-1">
                      <SelectBuscable value={f.purchase_block_id} onChange={(e) => cambiar(f._key, 'purchase_block_id', e.target.value)}
                        aria-label={`Fila ${i + 1}: bloque`} className={`${inputClass} ${b ? '' : rojo}`}>
                        <option value="">{f.texto_marca ? `${f.texto_marca}: ELEGIR…` : 'ELEGIR…'}</option>
                        {opcionesBloque.map((x) => <option key={x.id} value={String(x.id)}>{etiquetaBloque(x)}</option>)}
                      </SelectBuscable>
                      {b?.presentation === 'PACKED' && <span className="block text-[11px] text-amber-700">PACKED: SIEMPRE SPOT</span>}
                    </td>
                    {esComercializadora && (
                      <td className="px-1 py-1">
                        <SelectBuscable value={f.producer_id} onChange={(e) => cambiar(f._key, 'producer_id', e.target.value)}
                          aria-label={`Fila ${i + 1}: productor`} className={`${inputClass} ${f.producer_id ? '' : rojo}`}>
                          <option value="">{f.texto_productor ? `${f.texto_productor}: ELEGIR…` : 'ELEGIR…'}</option>
                          {productores.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                        </SelectBuscable>
                        {f.texto_productor && !f.producer_id && (
                          <span className="block text-[11px] text-red-600">NO ESTÁ EN TERCEROS: PÍDELE A ADMIN QUE LO CREE O QUITA LA FILA</span>
                        )}
                      </td>
                    )}
                    <td className="px-1 py-1">
                      <SelectBuscable value={f.farm_id}
                        onChange={(e) => (e.target.value === '__nueva'
                          ? setNuevaFinca({ key: f._key, producer_id: dueno, dueno: esComercializadora ? productorNombre(dueno) : vendedor, name: f.texto_finca, magap_code: '' })
                          : cambiar(f._key, 'farm_id', e.target.value))}
                        disabled={!dueno} aria-label={`Fila ${i + 1}: finca`} className={`${inputClass} ${f.farm_id || !dueno ? '' : rojo}`}>
                        <option value="">{f.texto_finca ? `${f.texto_finca}: ELEGIR…` : 'ELEGIR…'}</option>
                        {propias.map((x) => <option key={x.id} value={String(x.id)}>{x.name}{x.magap_code ? ` · ${x.magap_code}` : ''}</option>)}
                        <option value="__nueva">+ NUEVA FINCA</option>
                      </SelectBuscable>
                    </td>
                    <td className="px-1 py-1">
                      <CampoNumero decimales={0} value={f.boxes} onChange={(e) => cambiar(f._key, 'boxes', e.target.value)}
                        aria-label={`Fila ${i + 1}: cajas`} className={`${inputClass} text-right`} />
                    </td>
                    <td className="px-1 py-1">
                      <CampoNumero decimales={2} value={f.real_price} onChange={(e) => cambiar(f._key, 'real_price', e.target.value)}
                        placeholder={pidePrecio ? 'OBLIG.' : (compra.real_price || '')} aria-label={`Fila ${i + 1}: precio real`}
                        className={`${inputClass} text-right ${pidePrecio && f.real_price === '' ? rojo : ''}`} />
                    </td>
                    <td className="px-1 py-1">
                      <input value={f.notes} maxLength={255} onChange={(e) => cambiar(f._key, 'notes', e.target.value.toUpperCase())}
                        aria-label={`Fila ${i + 1}: notas`} className={inputClass} />
                    </td>
                    <td className="px-1 py-1">
                      <button type="button" onClick={() => quitar(f._key)} title="Quitar fila" aria-label={`Quitar fila ${i + 1}`}
                        className="text-white p-1 rounded-lg bg-red-600 hover:bg-red-700"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="button" onClick={() => setFilas((prev) => [...prev, filaVacia()])}
            className="mt-2 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover">
            <Plus size={14} /> Agregar fila
          </button>
        </div>

        {/* Nueva finca para una fila */}
        {nuevaFinca && (
          <div className="rounded-xl border border-primario/30 p-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_8rem_auto] gap-2 items-end text-xs">
            <div><span className="block text-gray-500">Productor</span><span className="font-semibold">{nuevaFinca.dueno}</span></div>
            <label className="block">
              <span className="block text-gray-500">Nombre de la finca *</span>
              <input autoFocus value={nuevaFinca.name} maxLength={255} onChange={(e) => setNuevaFinca((p) => ({ ...p, name: e.target.value.toUpperCase() }))} className={inputClass} />
            </label>
            <label className="block">
              <span className="block text-gray-500">Código MAG</span>
              <input value={nuevaFinca.magap_code} maxLength={50} onChange={(e) => setNuevaFinca((p) => ({ ...p, magap_code: e.target.value.toUpperCase() }))} className={inputClass} />
            </label>
            <div className="flex gap-1">
              <button type="button" onClick={guardarNuevaFinca} className="px-3 py-1.5 rounded-lg font-semibold bg-guardar text-guardar-texto hover:bg-guardar-hover">Crear finca</button>
              <button type="button" onClick={() => setNuevaFinca(null)} className="px-3 py-1.5 rounded-lg font-semibold bg-cancelar text-cancelar-texto hover:bg-cancelar-hover">Cancelar</button>
            </div>
          </div>
        )}

        {/* Cuadre contra la compra */}
        <div className="rounded-xl bg-gray-50 p-3 text-sm">
          <span className="font-semibold">DIVIDIDO {cajasTexto(suma)} DE {cajasTexto(original)} CAJAS</span>
          {falta > 0 && (
            <div className="mt-2 flex flex-col gap-1 text-xs">
              <label className="flex items-center gap-2">
                <input type="radio" name="saldo" checked={saldo === 'REDUCE'} onChange={() => setSaldo('REDUCE')} />
                BAJAR LA COMPRA A {cajasTexto(suma)} CAJAS
              </label>
              {esComercializadora && (
                <label className="flex items-center gap-2">
                  <input type="radio" name="saldo" checked={saldo === 'KEEP'} onChange={() => setSaldo('KEEP')} />
                  DEJAR {cajasTexto(falta)} CAJAS POR DIVIDIR (VIENE OTRO CUADRO)
                </label>
              )}
              {compra.despachada && saldo === 'REDUCE' && (
                <span className="text-amber-700">LA BODEGA YA ENTREGÓ MATERIAL: EL SOBRANTE SE DEVUELVE COMO DEVOLUCIÓN LIGADA AL CUPO.</span>
              )}
            </div>
          )}
          {falta < 0 && (
            <span className="block mt-1 text-xs font-semibold text-amber-700">SE COMPRAN {cajasTexto(-falta)} CAJAS MÁS: LA BODEGA DEBE ENTREGAR MÁS MATERIAL.</span>
          )}
        </div>
      </ModalShell>

      {confirmar && (
        <DialogoConfirmacion
          titulo="¿Dividir la compra?"
          textoAceptar="Dividir"
          textoCancelar="Revisar"
          onCancelar={() => setConfirmar(false)}
          onAceptar={dividir}
        >
          Se dividirá en {filas.length} {filas.length === 1 ? 'fila' : 'filas'} · {cajasTexto(suma)} cajas
          {falta > 0 ? (saldo === 'KEEP' ? ` · quedan ${cajasTexto(falta)} por dividir` : ` · la compra baja de ${cajasTexto(original)} a ${cajasTexto(suma)}`) : ''}.
        </DialogoConfirmacion>
      )}
    </>
  );
}
