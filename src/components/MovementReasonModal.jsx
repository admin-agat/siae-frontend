// InventoryMovementFormPage.jsx
// Formulario para registrar un movimiento de inventario (Ingreso o Egreso)
// con líneas dinámicas de insumos. Cabecera + detalle se envían juntos y el
// backend los guarda en una sola transacción.
//
// NUEVO: cuando el Tipo es INGRESO y hay un Proveedor elegido, aparece un
// selector de Orden de Compra (solo las PENDIENTE/PARCIAL de ese proveedor).
// Al elegir una, las líneas se generan solas a partir de lo pedido en la OC
// — el insumo queda fijo, y el bodeguero solo edita cuánto llegó realmente
// (puede ser menos de lo pedido: recepción parcial).
import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createInventoryMovement } from '../../api/inventoryMovements';
import { getWarehouses } from '../../api/warehouses';
import { getThirdParties } from '../../api/thirdParties';
import { getSupplies } from '../../api/supplies';
import { getActiveMovementReasonsByType } from '../../api/movementReasons';
import { getPurchaseOrders, getPurchaseOrder } from '../../api/purchaseOrders';

// Una línea vacía nueva, para el botón "Agregar insumo" (modo libre, sin OC).
const lineaVacia = () => ({
    supply_id: '',
    quantity: '',
    unit_cost: '',
    discount: '0',
});

// Calcula el número de semana ISO 8601 (lunes-domingo) para una fecha dada.
// Esta es la "semana bananera" que usa AGAT — coincide con la semana ISO estándar.
function getISOWeek(fecha) {
    const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const diaSemana = (d.getUTCDay() + 6) % 7; // lunes=0 ... domingo=6
    d.setUTCDate(d.getUTCDate() - diaSemana + 3); // mover al jueves de esa semana
    const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const diaSemanaPrimerJueves = (primerJueves.getUTCDay() + 6) % 7;
    primerJueves.setUTCDate(primerJueves.getUTCDate() - diaSemanaPrimerJueves + 3);
    return 1 + Math.round((d - primerJueves) / (7 * 24 * 3600 * 1000));
}

export default function InventoryMovementFormPage() {
    const navigate = useNavigate();

    // Cabecera del movimiento
    const [tipo, setTipo] = useState('INGRESO');
    const [warehouseId, setWarehouseId] = useState('');
    const [thirdPartyId, setThirdPartyId] = useState('');
    const [movementReasonId, setMovementReasonId] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
    const [week, setWeek] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [deliveryNote, setDeliveryNote] = useState('');
    const [reference, setReference] = useState('');

    // Orden de Compra ligada (solo aplica si Tipo = INGRESO)
    const [purchaseOrderId, setPurchaseOrderId] = useState('');
    const [ordenesDisponibles, setOrdenesDisponibles] = useState([]);
    const [cargandoOrdenes, setCargandoOrdenes] = useState(false);
    const [cargandoLineasOC, setCargandoLineasOC] = useState(false);

    // Líneas de detalle
    const [lineas, setLineas] = useState([lineaVacia()]);

    // Catálogos para los selects
    const [bodegas, setBodegas] = useState([]);
    const [terceros, setTerceros] = useState([]);
    const [insumos, setInsumos] = useState([]);
    const [motivos, setMotivos] = useState([]);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    // Carga los catálogos una sola vez al entrar a la página.
    useEffect(() => {
        cargarCatalogos();
    }, []);

    // Cada vez que cambia el tipo (INGRESO/EGRESO/DEVOLUCION), recarga los
    // motivos válidos para ese tipo, limpia el motivo seleccionado, y si ya
    // no es INGRESO limpia también todo lo relacionado a la OC.
    useEffect(() => {
        cargarMotivos(tipo);
        setMovementReasonId('');

        if (tipo !== 'INGRESO') {
            setPurchaseOrderId('');
            setOrdenesDisponibles([]);
            setLineas([lineaVacia()]);
        }
    }, [tipo]);

    // Al cargar el formulario, fija la fecha a hoy y calcula semana/año automáticamente — no editable
    useEffect(() => {
        const hoy = new Date();
        setFecha(hoy.toISOString().split('T')[0]); // formato YYYY-MM-DD
        setWeek(getISOWeek(hoy));
        setYear(hoy.getFullYear());
    }, []);

    // Cada vez que cambia el Proveedor (y el Tipo es INGRESO), busca sus OCs
    // que todavía tienen algo pendiente de recibir (PENDIENTE o PARCIAL).
    // Si no hay proveedor o el tipo no es INGRESO, la lista queda vacía.
    useEffect(() => {
        if (tipo !== 'INGRESO' || !thirdPartyId) {
            setOrdenesDisponibles([]);
            setPurchaseOrderId('');
            return;
        }

        setCargandoOrdenes(true);
        getPurchaseOrders('PENDIENTE,PARCIAL', thirdPartyId)
            .then((res) => setOrdenesDisponibles(res.data))
            .catch((err) => {
                console.error('ERROR AL CARGAR ÓRDENES DE COMPRA DEL PROVEEDOR:', err);
            })
            .finally(() => setCargandoOrdenes(false));

        // Al cambiar de proveedor, cualquier OC elegida antes ya no aplica
        setPurchaseOrderId('');
        setLineas([lineaVacia()]);
    }, [thirdPartyId, tipo]);

    // Cada vez que se elige una Orden de Compra, trae sus líneas y arma
    // automáticamente las líneas del movimiento: insumo fijo (no editable,
    // debe coincidir con lo pedido), cantidad prellenada con lo que falta
    // por recibir (pedido - ya recibido en entregas anteriores).
    useEffect(() => {
        if (!purchaseOrderId) {
            return;
        }

        setCargandoLineasOC(true);
        getPurchaseOrder(purchaseOrderId)
            .then((res) => {
                const orden = res.data;
                const lineasDesdeOC = orden.lines.map((l) => {
                    const pedido = parseFloat(l.quantity_ordered) || 0;
                    const recibido = parseFloat(l.quantity_received) || 0;
                    const pendiente = Math.max(pedido - recibido, 0);

                    return {
                        supply_id: String(l.supply_id),
                        quantity: pendiente > 0 ? String(pendiente) : '',
                        unit_cost: l.unit_price,
                        discount: '0',
                        // Campos solo para mostrar contexto en la UI —
                        // no se envían al backend (ver handleSubmit).
                        _supplyLabel: l.supply ? `${l.supply.code} — ${l.supply.name}` : `#${l.supply_id}`,
                        _pedido: pedido,
                        _recibido: recibido,
                    };
                });
                setLineas(lineasDesdeOC.length > 0 ? lineasDesdeOC : [lineaVacia()]);
            })
            .catch((err) => {
                console.error('ERROR AL CARGAR LÍNEAS DE LA ORDEN DE COMPRA:', err);
                setError('NO SE PUDIERON CARGAR LOS INSUMOS DE ESTA ORDEN DE COMPRA');
            })
            .finally(() => setCargandoLineasOC(false));
    }, [purchaseOrderId]);

    const cargarCatalogos = async () => {
        try {
            const [resBodegas, resTerceros, resInsumos] = await Promise.all([
                getWarehouses(),
                getThirdParties(),
                getSupplies(),
            ]);
            setBodegas(resBodegas.data);
            setTerceros(resTerceros.data);
            setInsumos(resInsumos.data);
        } catch (err) {
            console.error('ERROR AL CARGAR CATÁLOGOS:', err);
            setError('NO SE PUDIERON CARGAR LOS CATÁLOGOS (BODEGAS/TERCEROS/INSUMOS)');
        }
    };

    const cargarMotivos = async (tipoSeleccionado) => {
        try {
            const res = await getActiveMovementReasonsByType(tipoSeleccionado);
            setMotivos(res.data);
        } catch (err) {
            console.error('ERROR AL CARGAR MOTIVOS:', err);
        }
    };

    // Cuando hay una OC elegida, las líneas vienen fijas desde ella —
    // no tiene sentido agregar o quitar insumos sueltos que no fueron
    // pedidos. Esto solo aplica en modo libre (sin OC).
    const enModoOC = Boolean(purchaseOrderId);

    // --- Manejo de líneas dinámicas (solo modo libre) ---

    const agregarLinea = () => {
        setLineas((prev) => [...prev, lineaVacia()]);
    };

    const quitarLinea = (index) => {
        setLineas((prev) => prev.filter((_, i) => i !== index));
    };

    const actualizarLinea = (index, campo, valor) => {
        setLineas((prev) => {
            const copia = [...prev];
            copia[index] = { ...copia[index], [campo]: valor };

            // Al elegir un insumo, autocompletamos su costo de referencia
            // como punto de partida (el usuario lo puede editar si el precio
            // de esta compra es distinto). Solo aplica en modo libre — en
            // modo OC el costo ya viene fijado desde el precio pactado.
            if (campo === 'supply_id') {
                const insumo = insumos.find((i) => String(i.id) === String(valor));
                if (insumo && !copia[index].unit_cost) {
                    copia[index].unit_cost = insumo.cost || '';
                }
            }
            return copia;
        });
    };

    // Total de una línea: cantidad * costo unitario - descuento
    const totalLinea = (linea) => {
        const cantidad = parseFloat(linea.quantity) || 0;
        const costo = parseFloat(linea.unit_cost) || 0;
        const descuento = parseFloat(linea.discount) || 0;
        return cantidad * costo - descuento;
    };

    const totalGeneral = lineas.reduce((acc, l) => acc + totalLinea(l), 0);

    // --- Guardar ---

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!warehouseId || !movementReasonId || !fecha) {
            setError('BODEGA, MOTIVO Y FECHA SON OBLIGATORIOS');
            return;
        }

        const lineasValidas = lineas.filter((l) => l.supply_id && l.quantity && parseFloat(l.quantity) > 0);
        if (lineasValidas.length === 0) {
            setError('AGREGÁ AL MENOS UN INSUMO CON CANTIDAD');
            return;
        }

        setGuardando(true);
        try {
            await createInventoryMovement({
                warehouse_id: warehouseId,
                movement_reason_id: movementReasonId,
                third_party_id: thirdPartyId || null,
                type: tipo,
                date: fecha,
                purchase_order_id: purchaseOrderId || null,
                week: week || null,
                year: year || null,
                delivery_note: deliveryNote || null,
                reference: reference || null,
                lines: lineasValidas.map((l) => ({
                    supply_id: l.supply_id,
                    quantity: l.quantity,
                    unit_cost: l.unit_cost || 0,
                    discount: l.discount || 0,
                })),
            });

            // Movimiento guardado: volvemos a Stock General para ver el resultado.
            navigate('/stock');
        } catch (err) {
            console.error('ERROR AL GUARDAR EL MOVIMIENTO:', err);
            setError(
                err.response?.data?.message || 'OCURRIÓ UN ERROR AL GUARDAR EL MOVIMIENTO'
            );
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="max-w-full mx-auto p-6 space-y-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Nuevo Movimiento de Inventario</h1>
                <p className="text-gray-500 text-sm">Registrá un Ingreso o Egreso con sus insumos</p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-4">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Cabecera */}
                <div className="bg-white rounded-xl shadow p-6 space-y-4">

                    {/* Fila 0: Semana, Fecha, Tipo, Bodega, Motivo */}
                    <div className="grid grid-cols-5 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Semana</label>
                            {/* Calculada automáticamente (semana ISO) a partir de la fecha — solo lectura */}
                            <input
                                type="number"
                                value={week}
                                readOnly
                                disabled
                                className="w-full bg-gray-200 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 outline-none cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Fecha *</label>
                            {/* Editable — al cambiarla, recalcula la semana ISO automáticamente */}
                            <input
                                type="date"
                                value={fecha}
                                onChange={(e) => {
                                    setFecha(e.target.value);
                                    setWeek(getISOWeek(new Date(e.target.value + 'T00:00:00')));
                                    setYear(new Date(e.target.value + 'T00:00:00').getFullYear());
                                }}
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipo *</label>
                            <select
                                value={tipo}
                                onChange={(e) => setTipo(e.target.value)}
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none"
                            >
                                <option value="INGRESO">INGRESO</option>
                                <option value="EGRESO">EGRESO</option>
                                <option value="DEVOLUCION">DEVOLUCIÓN</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bodega *</label>
                            <select
                                value={warehouseId}
                                onChange={(e) => setWarehouseId(e.target.value)}
                                required
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none"
                            >
                                <option value="">Seleccionar bodega...</option>
                                {bodegas.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Motivo *</label>
                            <select
                                value={movementReasonId}
                                onChange={(e) => setMovementReasonId(e.target.value)}
                                required
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none"
                            >
                                <option value="">Seleccionar motivo...</option>
                                {motivos.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Fila 1: Tercero, Orden de Compra (solo INGRESO), Guía de remisión, Referencia */}
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Tercero (Proveedor / Productor)
                            </label>
                            {/* Filtrado según el tipo: INGRESO solo muestra PROVEEDOR, EGRESO solo PRODUCTOR/COMERCIALIZADORA */}
                            <select
                                value={thirdPartyId}
                                onChange={(e) => setThirdPartyId(e.target.value)}
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none"
                            >
                                <option value="">Sin tercero (movimiento interno)</option>
                                {terceros
                                    .filter((t) => {
                                        if (tipo === 'INGRESO') return t.type === 'PROVEEDOR';
                                        if (tipo === 'EGRESO') return ['PRODUCTOR', 'COMERCIALIZADORA'].includes(t.type);
                                        return true;
                                    })
                                    .map((t) => (
                                        <option key={t.id} value={t.id}>{t.name} — {t.type}</option>
                                    ))}
                            </select>
                        </div>

                        {/* Orden de Compra: solo tiene sentido en un INGRESO con Proveedor elegido.
                            Si el Ingreso no viene de una OC (ej. Ajuste de Inventario), se deja en
                            blanco y las líneas se llenan libremente como antes. */}
                        {tipo === 'INGRESO' && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Orden de Compra
                                </label>
                                <select
                                    value={purchaseOrderId}
                                    onChange={(e) => setPurchaseOrderId(e.target.value)}
                                    disabled={!thirdPartyId || cargandoOrdenes}
                                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none disabled:bg-gray-200 disabled:cursor-not-allowed"
                                >
                                    <option value="">
                                        {!thirdPartyId
                                            ? 'Elegí un proveedor primero'
                                            : cargandoOrdenes
                                                ? 'Cargando...'
                                                : ordenesDisponibles.length === 0
                                                    ? 'Este proveedor no tiene OCs pendientes'
                                                    : 'Sin OC (ingreso libre)'}
                                    </option>
                                    {ordenesDisponibles.map((oc) => (
                                        <option key={oc.id} value={oc.id}>
                                            {oc.code} — {oc.status}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Guía de remisión</label>
                            <input
                                value={deliveryNote}
                                onChange={(e) => setDeliveryNote(e.target.value.toUpperCase())}
                                placeholder="Ej: 001-002-000123"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Referencia / Observación</label>
                            <input
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="Nota libre, opcional"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none"
                            />
                        </div>
                    </div>
                </div>


                {/* Líneas de detalle */}
                <div className="bg-white rounded-xl shadow overflow-hidden">
                    <div className="flex justify-between items-center px-6 py-4 border-b">
                        <div>
                            <h2 className="font-semibold text-gray-800">Insumos</h2>
                            {enModoOC && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Precargado desde la OC — editá solo la cantidad que llegó realmente
                                </p>
                            )}
                        </div>
                        {!enModoOC && (
                            <button
                                type="button"
                                onClick={agregarLinea}
                                className="flex items-center gap-1 text-sm font-semibold text-[#0F6E56] hover:text-[#0a5a45]"
                            >
                                <Plus size={16} />
                                Agregar insumo
                            </button>
                        )}
                    </div>

                    <table className="w-full text-sm">
                        <thead className="bg-[#0F6E56] text-white">
                            <tr>
                                <th className="text-left px-4 py-3">Insumo</th>
                                {enModoOC && <th className="text-right px-4 py-3 w-24">Pedido</th>}
                                {enModoOC && <th className="text-right px-4 py-3 w-24">Recibido antes</th>}
                                <th className="text-right px-4 py-3 w-28">
                                    {enModoOC ? 'Recibido ahora' : 'Cantidad'}
                                </th>
                                <th className="text-right px-4 py-3 w-32">Costo unit.</th>
                                <th className="text-right px-4 py-3 w-28">Descuento</th>
                                <th className="text-right px-4 py-3 w-32">Total</th>
                                {!enModoOC && <th className="px-4 py-3 w-12"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {cargandoLineasOC && (
                                <tr>
                                    <td colSpan={enModoOC ? 7 : 6} className="px-4 py-6 text-center text-gray-400">
                                        Cargando insumos de la orden de compra...
                                    </td>
                                </tr>
                            )}
                            {!cargandoLineasOC && lineas.map((linea, index) => (
                                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className="px-4 py-2">
                                        {enModoOC ? (
                                            // En modo OC el insumo viene fijo — no editable, para
                                            // que solo se reciba lo que realmente se pidió.
                                            <span className="block px-2 py-1.5 text-sm text-gray-700">
                                                {linea._supplyLabel}
                                            </span>
                                        ) : (
                                            <select
                                                value={linea.supply_id}
                                                onChange={(e) => actualizarLinea(index, 'supply_id', e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#0F6E56]"
                                            >
                                                <option value="">Seleccionar...</option>
                                                {insumos.map((i) => (
                                                    <option key={i.id} value={i.id}>{i.code} — {i.name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </td>
                                    {enModoOC && (
                                        <td className="px-4 py-2 text-right text-gray-500">
                                            {linea._pedido}
                                        </td>
                                    )}
                                    {enModoOC && (
                                        <td className="px-4 py-2 text-right text-gray-500">
                                            {linea._recibido}
                                        </td>
                                    )}
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={linea.quantity}
                                            onChange={(e) => actualizarLinea(index, 'quantity', e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#0F6E56]"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            step="0.0001"
                                            min="0"
                                            value={linea.unit_cost}
                                            onChange={(e) => actualizarLinea(index, 'unit_cost', e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#0F6E56]"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={linea.discount}
                                            onChange={(e) => actualizarLinea(index, 'discount', e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#0F6E56]"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-right font-medium">
                                        ${totalLinea(linea).toFixed(2)}
                                    </td>
                                    {!enModoOC && (
                                        <td className="px-4 py-2 text-center">
                                            {lineas.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => quitarLinea(index)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50 border-t">
                                <td colSpan={enModoOC ? 5 : 4} className="px-4 py-3 text-right font-semibold text-gray-700">
                                    Total general
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-[#0F6E56]">
                                    ${totalGeneral.toFixed(2)}
                                </td>
                                {!enModoOC && <td></td>}
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/stock')}
                        className="text-sm font-semibold text-gray-700 hover:text-gray-900 px-2"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={guardando}
                        className="px-5 py-2.5 text-sm font-semibold bg-[#0F6E56] text-white rounded-lg hover:bg-[#0a5a45] disabled:opacity-50"
                    >
                        {guardando ? 'Guardando...' : 'Guardar movimiento'}
                    </button>
                </div>
            </form >
        </div >
    );
}