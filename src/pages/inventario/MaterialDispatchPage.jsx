// MaterialDispatchPage.jsx
// Despacho de Materiales: UN RETIRO = UNA SOLA MARCA.
// El bodeguero elige la marca y las cajas, da clic en CALCULAR y ve:
//   - RECOMENDADO (sugerido): lo que da la receta (cajas × ratio_per_box),
//     menos lo que ya retiró de esa marca esta semana. Solo lectura.
//   - A RETIRAR (real): arranca igual al recomendado y se ajusta a mano
//     (ej. 100 cajas pero solo lleva 80 cartones porque tiene sobrante).
// Se guarda un EGRESO (motivo ENTREGA A PRODUCTOR) que descuenta stock con
// lo REAL y deja el RECOMENDADO en recommended_quantity como referencia.
// El backend recalcula y valida todo (stock, receta, cupo liquidado).
import { useState, useEffect, useMemo } from 'react';
import { Calculator, AlertTriangle, CheckCircle, Save, Info, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calcularDespacho, guardarDespacho } from '../../api/materialDispatch';
import { getWarehouses } from '../../api/warehouses';
import { getThirdParties } from '../../api/thirdParties';
import { getBrands } from '../../api/brands';

// Semana ISO 8601 (semana bananera) — SOLO para mostrarla.
// La semana real la asigna el backend al guardar.
function getISOWeek(fecha) {
    const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const diaSemana = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - diaSemana + 3);
    const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const diaSemanaPrimerJueves = (primerJueves.getUTCDay() + 6) % 7;
    primerJueves.setUTCDate(primerJueves.getUTCDate() - diaSemanaPrimerJueves + 3);
    return 1 + Math.round((d - primerJueves) / (7 * 24 * 3600 * 1000));
}

// Estilo estándar de inputs del sistema (bg-gray-100 + rounded-2xl)
const INPUT = 'w-full bg-gray-100 rounded-2xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500';
const LABEL = 'block text-sm font-semibold text-gray-700 mb-1.5';

// Formato de dinero para el valor a descontar al productor
const dinero = (v) =>
    Number(v || 0).toLocaleString('es-EC', { style: 'currency', currency: 'USD' });

// Arreglo seguro: si el backend no devuelve lista, no revienta el .map/.filter
const comoLista = (res) => (Array.isArray(res?.data) ? res.data : []);

export default function MaterialDispatchPage() {
    const navigate = useNavigate();

    // ---- Cabecera ----
    const [warehouseId, setWarehouseId] = useState('');
    const [thirdPartyId, setThirdPartyId] = useState('');
    const [vapor, setVapor] = useState('');
    const [deliveryNote, setDeliveryNote] = useState('');

    // ---- Quién retira físicamente (va a la guía y al historial) ----
    const [retiraNombre, setRetiraNombre] = useState('');
    const [retiraCedula, setRetiraCedula] = useState('');

    // ---- Cupo del retiro: UNA marca (brands.code) + sus cajas ----
    const [marcaCode, setMarcaCode] = useState('');
    const [cajas, setCajas] = useState('');

    // ---- Catálogos ----
    const [bodegas, setBodegas] = useState([]);
    const [terceros, setTerceros] = useState([]);
    const [marcas, setMarcas] = useState([]);

    // ---- Resultado del cálculo ----
    const [materiales, setMateriales] = useState([]);
    const [cupoExistente, setCupoExistente] = useState(null); // cupo ya registrado esta semana

    // ---- UI ----
    const [calculando, setCalculando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [toast, setToast] = useState(null); // { tipo: 'exito'|'error', mensaje }
    const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

    // Semana actual, solo informativa
    const semanaActual = useMemo(() => getISOWeek(new Date()), []);

    useEffect(() => {
        cargarCatalogos();
    }, []);

    // Si cambia bodega, productor, marca o cajas, el cálculo anterior ya no vale:
    // se limpia para obligar a recalcular (evita guardar con números viejos).
    useEffect(() => {
        setMateriales([]);
        setCupoExistente(null);
    }, [warehouseId, thirdPartyId, marcaCode, cajas]);

    const cargarCatalogos = async () => {
        try {
            const [resBodegas, resTerceros, resMarcas] = await Promise.all([
                getWarehouses(),
                getThirdParties(),
                getBrands(),
            ]);
            setBodegas(comoLista(resBodegas).filter((b) => b.status));
            // Solo quienes reciben material: PRODUCTOR / COMERCIALIZADORA
            setTerceros(comoLista(resTerceros).filter((t) => ['PRODUCTOR', 'COMERCIALIZADORA'].includes(t.type)));
            // Solo marcas ACTIVAS en el selector (las nuevas aparecen solas)
            setMarcas(comoLista(resMarcas).filter((m) => m.status));
        } catch (err) {
            console.error('ERROR AL CARGAR CATÁLOGOS:', err);
            mostrarToast('error', 'NO SE PUDIERON CARGAR BODEGAS, PRODUCTORES O MARCAS');
        }
    };

    const mostrarToast = (tipo, mensaje, ms = 2500) => {
        setToast({ tipo, mensaje });
        setTimeout(() => setToast(null), ms);
    };

    // Traduce los errores del backend (422/403) a un mensaje claro
    const mensajeDeError = (err, porDefecto) => {
        const data = err.response?.data;
        if (data?.insuficientes?.length) {
            const detalle = data.insuficientes
                .map((i) => `${i.name ?? i.supply_id} (HAY ${i.disponible})`)
                .join(', ');
            return `STOCK INSUFICIENTE: ${detalle}`;
        }
        if (data?.errors) {
            return String(Object.values(data.errors).flat()[0]).toUpperCase();
        }
        return (data?.message || porDefecto).toUpperCase();
    };

    const nombreMarca = (code) => marcas.find((m) => m.code === code)?.name ?? code;

    // ---- Cupo del retiro ----
    // Cajas enteras: solo dígitos
    const handleCajas = (valor) => setCajas(valor.replace(/[^0-9]/g, ''));
    const cajasNum = parseInt(cajas, 10) || 0;

    // Línea del cupo de la semana que corresponde a la marca elegida (si existe)
    const lineaCupoMarca = (cupoExistente?.lines || []).find((l) => l.variety === marcaCode);

    // Segundo viaje de la misma marca: carga las cajas que ya quedaron registradas
    const usarCupoRegistrado = () => {
        if (!lineaCupoMarca) return;
        setCajas(String(parseInt(lineaCupoMarca.quantity_cajas, 10) || 0));
        mostrarToast('exito', 'CUPO REGISTRADO CARGADO — VUELVE A CALCULAR');
    };

    // ---- Cálculo ----
    const handleCalcular = async () => {
        if (!warehouseId || !thirdPartyId) {
            mostrarToast('error', 'SELECCIONA BODEGA Y PRODUCTOR ANTES DE CALCULAR');
            return;
        }
        if (!marcaCode) {
            mostrarToast('error', 'SELECCIONA LA MARCA DEL RETIRO');
            return;
        }
        if (cajasNum <= 0) {
            mostrarToast('error', 'INGRESA LAS CAJAS DEL CUPO');
            return;
        }

        setCalculando(true);
        try {
            const data = await calcularDespacho({
                warehouse_id: warehouseId,
                third_party_id: thirdPartyId, // para descontar lo ya retirado de esta marca
                brand_code: marcaCode,
                cajas: cajasNum,
            });
            // "A retirar" (real) arranca igual al recomendado (sugerido); el bodeguero lo ajusta
            setMateriales(
                (data.materiales || []).map((m) => ({ ...m, valor_a_retirar: String(m.valor_recomendado) }))
            );
            setCupoExistente(data.cupo_existente || null);
            mostrarToast('exito', 'MATERIALES CALCULADOS');
        } catch (err) {
            console.error('ERROR AL CALCULAR:', err);
            mostrarToast('error', mensajeDeError(err, 'ERROR AL CALCULAR LOS MATERIALES'), 4000);
        } finally {
            setCalculando(false);
        }
    };

    // Edita "a retirar" de una fila (acepta decimales para LIBRAS)
    const handleCambiarRetirar = (supplyId, valor) => {
        const limpio = valor.replace(/[^0-9.]/g, '');
        setMateriales((prev) =>
            prev.map((m) => (m.supply_id === supplyId ? { ...m, valor_a_retirar: limpio } : m))
        );
    };

    // Vuelve todas las filas al recomendado (por si el bodeguero se equivocó)
    const restaurarRecomendado = () => {
        setMateriales((prev) => prev.map((m) => ({ ...m, valor_a_retirar: String(m.valor_recomendado) })));
    };

    // ---- Derivados de la tabla (se recalculan en cada render) ----
    const filas = materiales.map((m) => {
        const cantidad = parseFloat(m.valor_a_retirar) || 0;
        return {
            ...m,
            cantidad,
            ajustado: cantidad !== Number(m.valor_recomendado), // el real difiere del sugerido
            sinStock: cantidad > Number(m.stock_disponible),    // pide más de lo que hay en bodega
            valor: cantidad * Number(m.unit_cost),               // lo que se descontará al productor
        };
    });

    // Las columnas FÓRMULA y YA RETIRADO solo aparecen si hubo un retiro previo de esta marca
    const hayRetiroPrevio = filas.some((f) => Number(f.ya_despachado) > 0);
    const valorTotal = filas.reduce((suma, f) => suma + f.valor, 0);
    const haySinStock = filas.some((f) => f.sinStock);
    const cantAjustados = filas.filter((f) => f.ajustado).length;
    const lineasARetirar = filas.filter((f) => f.cantidad > 0);
    const cupoLiquidado = cupoExistente?.status === 'LIQUIDADO';
    const terceroSeleccionado = terceros.find((t) => String(t.id) === String(thirdPartyId));

    // ---- Guardado ----
    // Validaciones rápidas en pantalla antes de abrir la confirmación
    const abrirConfirmacion = () => {
        if (cupoLiquidado) {
            mostrarToast('error', 'EL CUPO DE ESTA SEMANA YA FUE LIQUIDADO');
            return;
        }
        if (lineasARetirar.length === 0) {
            mostrarToast('error', 'NO HAY MATERIALES CON CANTIDAD A RETIRAR');
            return;
        }
        if (haySinStock) {
            mostrarToast('error', 'HAY MATERIALES SIN STOCK SUFICIENTE (FILAS EN ROJO)');
            return;
        }
        if (!retiraNombre.trim() || !retiraCedula.trim()) {
            mostrarToast('error', 'INGRESA NOMBRE Y CÉDULA DE QUIEN RETIRA');
            return;
        }
        setMostrarConfirmacion(true);
    };

    const handleGuardar = async () => {
        setGuardando(true);
        try {
            const movimiento = await guardarDespacho({
                warehouse_id: warehouseId,
                third_party_id: thirdPartyId,
                brand_code: marcaCode,
                cajas: cajasNum,
                vapor: vapor.trim() || null,
                delivery_note: deliveryNote.trim() || null,
                received_by_name: retiraNombre.trim(),
                received_by_document: retiraCedula.trim(),
                // Se envían todas; el backend ignora las que van en 0
                lines: filas.map((f) => ({ supply_id: f.supply_id, quantity: f.cantidad })),
            });

            // Directo a la guía de despacho imprimible (mismo recibo de movimientos)
            navigate(`/inventory-movements/${movimiento.id}/recibo`, {
                state: { movement: movimiento },
            });
        } catch (err) {
            console.error('ERROR AL GUARDAR EL DESPACHO:', err);
            setMostrarConfirmacion(false);
            mostrarToast('error', mensajeDeError(err, 'ERROR AL GUARDAR EL DESPACHO'), 4000);
            setGuardando(false);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">DESPACHO DE MATERIALES</h1>
                <p className="text-gray-500 text-sm">
                    Elige la marca y las cajas, calcula el material recomendado y ajusta lo que realmente se entrega
                </p>
            </div>

            {/* Toast local (sin librerías) */}
            {toast && (
                <div
                    className={`fixed top-4 right-4 max-w-md flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg z-50 text-sm font-semibold ${
                        toast.tipo === 'exito' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                >
                    {toast.tipo === 'exito' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {toast.mensaje}
                </div>
            )}

            {/* ===== 1. DATOS DEL DESPACHO ===== */}
            <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="font-semibold mb-4">DATOS DEL DESPACHO</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className={LABEL}>Bodega *</label>
                        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={INPUT}>
                            <option value="">Seleccionar bodega...</option>
                            {bodegas.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={LABEL}>Productor / Comercializadora *</label>
                        <select value={thirdPartyId} onChange={(e) => setThirdPartyId(e.target.value)} className={INPUT}>
                            <option value="">Seleccionar...</option>
                            {terceros.map((t) => (
                                <option key={t.id} value={t.id}>{t.name} — {t.type}</option>
                            ))}
                        </select>
                    </div>

                    {/* Motivo FIJO: un despacho siempre es ENTREGA A PRODUCTOR (lo pone el backend) */}
                    <div>
                        <label className={LABEL}>Motivo</label>
                        <div className={`${INPUT} text-gray-500 cursor-not-allowed`}>ENTREGA A PRODUCTOR</div>
                    </div>

                    <div>
                        <label className={LABEL}>Semana</label>
                        <div className={`${INPUT} text-gray-500 cursor-not-allowed`}>SEMANA {semanaActual}</div>
                    </div>

                    <div>
                        <label className={LABEL}>Vapor</label>
                        <input
                            value={vapor}
                            onChange={(e) => setVapor(e.target.value.toUpperCase())}
                            maxLength={255}
                            placeholder="OPCIONAL"
                            className={INPUT}
                        />
                    </div>

                    <div>
                        <label className={LABEL}>Guía de remisión</label>
                        <input
                            value={deliveryNote}
                            onChange={(e) => setDeliveryNote(e.target.value.toUpperCase())}
                            maxLength={255}
                            placeholder="OPCIONAL"
                            className={INPUT}
                        />
                    </div>
                </div>
            </div>

            {/* ===== 2. CUPO DEL RETIRO: UNA MARCA + CAJAS ===== */}
            <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="font-semibold mb-1">CUPO DEL RETIRO</h2>
                <p className="text-xs text-gray-400 mb-4">
                    Un retiro es de una sola marca. Si el productor lleva dos marcas, registra dos retiros.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className={LABEL}>Marca *</label>
                        <select value={marcaCode} onChange={(e) => setMarcaCode(e.target.value)} className={INPUT}>
                            <option value="">Seleccionar marca...</option>
                            {marcas.map((m) => (
                                <option key={m.id} value={m.code}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={LABEL}>Cajas *</label>
                        <input
                            inputMode="numeric"
                            value={cajas}
                            onChange={(e) => handleCajas(e.target.value)}
                            placeholder="0"
                            className={INPUT}
                        />
                    </div>

                    <button
                        onClick={handleCalcular}
                        disabled={calculando}
                        className="flex items-center justify-center gap-2 bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-2xl font-semibold text-sm disabled:opacity-50"
                    >
                        <Calculator size={18} />
                        {calculando ? 'CALCULANDO...' : 'CALCULAR MATERIALES'}
                    </button>
                </div>
            </div>

            {/* ===== Aviso: el productor ya tiene cupo/retiros esta semana ===== */}
            {cupoExistente && (
                <div
                    className={`rounded-2xl p-4 border text-sm ${
                        cupoLiquidado ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                >
                    <div className="flex items-start gap-2">
                        <Info size={18} className="mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <p className="font-semibold">
                                {cupoLiquidado
                                    ? `EL CUPO DE LA SEMANA ${cupoExistente.week_number} YA FUE LIQUIDADO — NO SE PUEDE DESPACHAR MÁS`
                                    : `ESTE PRODUCTOR YA TIENE CUPO REGISTRADO EN LA SEMANA ${cupoExistente.week_number} (${cupoExistente.status})`}
                            </p>
                            <p className="mt-1">
                                {(cupoExistente.lines || [])
                                    .map((l) => `${nombreMarca(l.variety)}: ${parseInt(l.quantity_cajas, 10)} CAJAS`)
                                    .join(' · ')}
                            </p>
                            {!cupoLiquidado && lineaCupoMarca && (
                                <p className="mt-1 text-xs">
                                    El RECOMENDADO ya descuenta lo retirado antes de {nombreMarca(marcaCode)}. Al guardar, el cupo de esta marca se actualiza con las cajas de arriba; las demás marcas no se tocan.
                                </p>
                            )}
                        </div>
                        {/* Solo si esta marca ya tiene cupo y las cajas son distintas */}
                        {!cupoLiquidado && lineaCupoMarca && parseInt(lineaCupoMarca.quantity_cajas, 10) !== cajasNum && (
                            <button
                                onClick={usarCupoRegistrado}
                                className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
                            >
                                USAR ESTE CUPO
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ===== 3. MATERIALES: RECOMENDADO (sugerido) vs A RETIRAR (real) ===== */}
            {filas.length > 0 && (
                <div className="bg-white rounded-2xl shadow p-6 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-semibold">
                            MATERIALES A DESPACHAR — {nombreMarca(marcaCode)} · {cajasNum.toLocaleString('es-EC')} CAJAS
                        </h2>
                        {cantAjustados > 0 && (
                            <button
                                onClick={restaurarRecomendado}
                                className="text-xs font-semibold text-blue-600 hover:underline"
                            >
                                VOLVER AL RECOMENDADO
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b text-gray-600">
                                    <th className="py-2 pr-2">CÓDIGO</th>
                                    <th className="py-2 pr-2">INSUMO</th>
                                    <th className="py-2 pr-2">UNIDAD</th>
                                    {hayRetiroPrevio && <th className="py-2 pr-2 text-right">FÓRMULA</th>}
                                    {hayRetiroPrevio && <th className="py-2 pr-2 text-right">YA RETIRADO</th>}
                                    <th className="py-2 pr-2 text-right">RECOMENDADO</th>
                                    <th className="py-2 pr-2 text-right">STOCK</th>
                                    <th className="py-2 pr-2 text-right">A RETIRAR</th>
                                    <th className="py-2 text-right">VALOR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filas.map((f) => (
                                    <tr key={f.supply_id} className={`border-b last:border-0 ${f.sinStock ? 'bg-red-50' : ''}`}>
                                        <td className="py-2 pr-2 text-gray-500">{f.code}</td>
                                        <td className="py-2 pr-2">{f.name}</td>
                                        <td className="py-2 pr-2 text-gray-500">{f.unit}</td>
                                        {hayRetiroPrevio && (
                                            <td className="py-2 pr-2 text-right text-gray-500">{f.valor_formula}</td>
                                        )}
                                        {hayRetiroPrevio && (
                                            <td className="py-2 pr-2 text-right text-gray-500">{f.ya_despachado || '—'}</td>
                                        )}
                                        <td className="py-2 pr-2 text-right font-semibold">{f.valor_recomendado}</td>
                                        <td className={`py-2 pr-2 text-right ${f.sinStock ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                            {f.stock_disponible}
                                        </td>
                                        <td className="py-2 pr-2 text-right">
                                            {/* Rojo = sin stock · Ámbar = ajustado a mano · Gris = igual al recomendado */}
                                            <input
                                                inputMode="decimal"
                                                value={f.valor_a_retirar}
                                                onChange={(e) => handleCambiarRetirar(f.supply_id, e.target.value)}
                                                className={`w-24 rounded-xl px-2 py-1 text-right outline-none focus:ring-2 ${
                                                    f.sinStock
                                                        ? 'bg-red-100 text-red-700 focus:ring-red-400'
                                                        : f.ajustado
                                                            ? 'bg-amber-100 text-amber-800 font-semibold focus:ring-amber-400'
                                                            : 'bg-gray-100 focus:ring-blue-500'
                                                }`}
                                            />
                                        </td>
                                        <td className="py-2 text-right">{dinero(f.valor)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {cantAjustados > 0 && (
                        <p className="text-xs text-amber-700">
                            {cantAjustados} MATERIAL(ES) AJUSTADO(S) A MANO — SE ENTREGA Y SE COBRA LO DE "A RETIRAR".
                        </p>
                    )}

                    {/* ===== 4. QUIÉN RETIRA ===== */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                        <div>
                            <label className={LABEL}>Nombre de quien retira *</label>
                            <input
                                value={retiraNombre}
                                onChange={(e) => setRetiraNombre(e.target.value.toUpperCase())}
                                maxLength={150}
                                placeholder="CHOFER O PRODUCTOR QUE RETIRA"
                                className={INPUT}
                            />
                        </div>
                        <div>
                            <label className={LABEL}>Cédula de quien retira *</label>
                            <input
                                value={retiraCedula}
                                onChange={(e) => setRetiraCedula(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
                                maxLength={20}
                                placeholder="0912345678"
                                className={INPUT}
                            />
                        </div>
                    </div>

                    {/* ===== Total + confirmar ===== */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t">
                        <p className="text-sm text-gray-600">
                            VALOR A DESCONTAR AL PRODUCTOR:{' '}
                            <span className="text-lg font-bold text-gray-800">{dinero(valorTotal)}</span>
                        </p>
                        <button
                            onClick={abrirConfirmacion}
                            disabled={guardando || cupoLiquidado}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl font-semibold text-sm disabled:opacity-50"
                        >
                            <Save size={18} />
                            CONFIRMAR DESPACHO
                        </button>
                    </div>
                </div>
            )}

            {/* ===== Modal de confirmación (nunca confirm() nativo) ===== */}
            {mostrarConfirmacion && (
                <div className="fixed inset-0 flex items-center justify-center z-[60]" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md px-6 py-6">
                        <h3 className="text-base font-bold text-gray-800 mb-3">¿Confirmar el despacho?</h3>
                        <div className="text-sm text-gray-600 space-y-1 mb-6">
                            <p>PRODUCTOR: <span className="font-semibold text-gray-800">{terceroSeleccionado?.name}</span></p>
                            <p>MARCA: <span className="font-semibold text-gray-800">{nombreMarca(marcaCode)} — {cajasNum.toLocaleString('es-EC')} CAJAS</span></p>
                            <p>RETIRA: <span className="font-semibold text-gray-800">{retiraNombre} — C.I. {retiraCedula}</span></p>
                            <p>MATERIALES: <span className="font-semibold text-gray-800">{lineasARetirar.length}</span>
                                {cantAjustados > 0 && <span className="text-amber-700"> ({cantAjustados} AJUSTADOS)</span>}
                            </p>W
                            <p>VALOR A DESCONTAR: <span className="font-semibold text-gray-800">{dinero(valorTotal)}</span></p>
                            <p className="text-xs text-gray-400 pt-2">Se descontará del stock de la bodega de inmediato.</p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setMostrarConfirmacion(false)}
                                disabled={guardando}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                                style={{ backgroundColor: '#e2593f' }}
                            >
                                <X size={16} />
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleGuardar}
                                disabled={guardando}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                                style={{ backgroundColor: '#2563eb' }}
                            >
                                <Save size={16} />
                                {guardando ? 'Guardando...' : 'Guardar despacho'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}