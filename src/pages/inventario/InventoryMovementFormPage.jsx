// InventoryMovementFormPage.jsx
// Formulario para registrar un movimiento de inventario (Ingreso o Egreso)
// con líneas dinámicas de insumos. Cabecera + detalle se envían juntos y el
// backend los guarda en una sola transacción.
import { useState, useEffect } from 'react';
import { Plus, Trash2, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createInventoryMovement } from '../../api/inventoryMovements';
import { getWarehouses } from '../../api/warehouses';
import { getThirdParties } from '../../api/thirdParties';
import { getSupplies } from '../../api/supplies';
import { getActiveMovementReasonsByType } from '../../api/movementReasons';
// No hay todavía un api/purchaseOrders.js confirmado en el proyecto, así que
// se usa axios directo aquí. Si ya existe ese wrapper, reemplazar este import
// por el mismo patrón que warehouses/thirdParties/supplies.
import api from '../../api/axios';

// Una línea vacía nueva, para el botón "Agregar insumo".
const lineaVacia = () => ({
    supply_id: '',
    quantity: '',
    unit_cost: '',
    discount: '0',
    bloqueada: false, // true cuando la línea viene de una OC (insumo no editable)
    pendiente: null,  // cantidad pendiente de esa línea en la OC (solo informativo)
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
    const { user } = useAuth();
    const esBodeguero = user?.role === 'BODEGUERO';

    // Cabecera del movimiento
    const [tipo, setTipo] = useState('INGRESO');
    const [warehouseId, setWarehouseId] = useState('');
    const [thirdPartyId, setThirdPartyId] = useState('');
    const [movementReasonId, setMovementReasonId] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
    // Antes era un input de texto libre (purchaseOrder). Ahora es el ID real
    // de la OC seleccionada, para que sí quede vinculada por purchase_order_id.
    const [purchaseOrderId, setPurchaseOrderId] = useState('');
    const [week, setWeek] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [deliveryNote, setDeliveryNote] = useState('');
    const [reference, setReference] = useState('');

    // Líneas de detalle
    const [lineas, setLineas] = useState([lineaVacia()]);

    // Catálogos para los selects
    const [bodegas, setBodegas] = useState([]);
    const [terceros, setTerceros] = useState([]);
    const [insumos, setInsumos] = useState([]);
    const [motivos, setMotivos] = useState([]);
    // OCs pendientes/parciales de la bodega seleccionada, solo cuando tipo = INGRESO
    const [ordenesCompra, setOrdenesCompra] = useState([]);
    const [cargandoOrdenes, setCargandoOrdenes] = useState(false);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    // Carga los catálogos una sola vez al entrar a la página.
    useEffect(() => {
        cargarCatalogos();
    }, []);

    // Si el usuario es BODEGUERO, en cuanto llega la lista de bodegas se
    // autoselecciona SU bodega asignada (responsible_user_id) — el select
    // queda bloqueado más abajo, esto solo fija el valor inicial.
    useEffect(() => {
        if (esBodeguero && bodegas.length > 0 && !warehouseId) {
            const miBodega = bodegas.find((b) => b.responsible_user_id === user.id);
            if (miBodega) setWarehouseId(String(miBodega.id));
        }
    }, [bodegas, esBodeguero, user, warehouseId]);

    // Cada vez que cambia el tipo (INGRESO/EGRESO), recarga los motivos
    // válidos para ese tipo y limpia el motivo seleccionado (puede que ya
    // no aplique al nuevo tipo).
    useEffect(() => {
        cargarMotivos(tipo);
        setMovementReasonId('');
    }, [tipo]);

    // Cada vez que cambia el tipo o la bodega, recarga las OC disponibles
    // para elegir (solo tiene sentido en INGRESO). Si se sale de INGRESO o
    // no hay bodega seleccionada, se limpia todo lo relacionado a la OC.
    useEffect(() => {
        if (tipo === 'INGRESO' && warehouseId) {
            cargarOrdenesCompra(warehouseId);
        } else {
            setOrdenesCompra([]);
            setPurchaseOrderId('');
        }
    }, [tipo, warehouseId]);

    // Al cargar el formulario, fija la fecha a hoy y calcula semana/año automáticamente — no editable
    useEffect(() => {
        const hoy = new Date();
        setFecha(hoy.toISOString().split('T')[0]); // formato YYYY-MM-DD
        setWeek(getISOWeek(hoy));
        setYear(hoy.getFullYear());
    }, []);


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

    // Trae las OC en estado PENDIENTE o PARCIAL de la bodega seleccionada
    // (el backend ya filtra por bodega del BODEGUERO igual, esto es solo
    // para no mostrarle de entrada OCs de otra bodega en el selector).
    const cargarOrdenesCompra = async (bodegaId) => {
        try {
            setCargandoOrdenes(true);
            const res = await api.get('/purchase-orders', {
                params: { status: 'PENDIENTE,PARCIAL', warehouse_id: bodegaId },
            });
            setOrdenesCompra(res.data);
        } catch (err) {
            console.error('ERROR AL CARGAR ÓRDENES DE COMPRA:', err);
        } finally {
            setCargandoOrdenes(false);
        }
    };

    // Al elegir una OC del selector: precarga las líneas con el insumo
    // bloqueado (no editable) y la cantidad pendiente (quantity_ordered -
    // quantity_received) como valor inicial editable — el bodeguero la
    // ajusta si lo que llegó realmente es distinto (ej. pidieron 100 cajas,
    // llegaron 98 → deja 98 en vez del pendiente precargado).
    const handleSeleccionarOC = (ocId) => {
        setPurchaseOrderId(ocId);

        if (!ocId) {
            setLineas([lineaVacia()]);
            return;
        }

        const orden = ordenesCompra.find((o) => String(o.id) === String(ocId));
        if (!orden) return;

        // Precarga también el proveedor de la OC, ya que el Ingreso es de ese mismo tercero
        if (orden.third_party_id) setThirdPartyId(String(orden.third_party_id));

        const lineasDeOC = orden.lines.map((l) => {
            const pendiente = Number(l.quantity_ordered) - Number(l.quantity_received || 0);
            return {
                supply_id: String(l.supply_id),
                quantity: pendiente > 0 ? String(pendiente) : '',
                unit_cost: String(l.unit_price ?? ''),
                discount: '0',
                bloqueada: true,
                pendiente,
            };
        });

        setLineas(lineasDeOC.length > 0 ? lineasDeOC : [lineaVacia()]);
    };

    // --- Manejo de líneas dinámicas ---

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
            // de esta compra es distinto). Solo aplica a líneas libres —
            // las que vienen de una OC ya traen su propio unit_price.
            if (campo === 'supply_id' && !copia[index].bloqueada) {
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

        const lineasValidas = lineas.filter((l) => l.supply_id && l.quantity);
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

                   

                    {/* Fila 0: Tipo, Motivo */}

                    
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
                            <input disabled
                                type="date"
                                value={fecha}
                                onChange={(e) => {
                                    setFecha(e.target.value);
                                    setWeek(getISOWeek(new Date(e.target.value + 'T00:00:00')));
                                    setYear(new Date(e.target.value + 'T00:00:00').getFullYear());
                                }}
                            
                                className="w-full bg-gray-200 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 outline-none cursor-not-allowed"
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
                            </select>
                        </div>


                        {/*AQUI VA LA BODEGA */}
                         <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Bodega *
                                {esBodeguero && <Lock size={12} className="inline ml-1 text-gray-400" />}
                            </label>
                            <select
                                value={warehouseId}
                                onChange={(e) => setWarehouseId(e.target.value)}
                                required
                                // Un BODEGUERO no elige bodega: ya viene fija a la suya
                                disabled={esBodeguero}
                                className={`w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none ${
                                    esBodeguero
                                        ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                                        : 'bg-gray-100 text-gray-800'
                                }`}
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

                    {/* Fila 1: Orden de compra (selector real, solo en INGRESO), Guía de remisión */}
                    <div className="grid grid-cols-4 gap-4">

                        {tipo === 'INGRESO' && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Orden de compra a recibir
                                </label>
                                <select
                                    value={purchaseOrderId}
                                    onChange={(e) => handleSeleccionarOC(e.target.value)}
                                    disabled={!warehouseId || cargandoOrdenes}
                                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none disabled:opacity-50"
                                >
                                    <option value="">
                                        {!warehouseId
                                            ? 'Elegí una bodega primero...'
                                            : cargandoOrdenes
                                            ? 'Cargando órdenes...'
                                            : ordenesCompra.length === 0
                                            ? 'Sin OC pendientes en esta bodega'
                                            : 'Ingreso libre (sin OC)'}
                                    </option>
                                    {ordenesCompra.map((o) => (
                                        <option key={o.id} value={o.id}>
                                            {o.code} — {o.thirdParty?.name} ({o.status})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-400 mt-1">
                                    Al elegir una OC se precargan sus insumos con la cantidad pendiente por recibir.
                                </p>
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
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                (Proveedor / Productor)
                            </label>
                            {/* Filtrado según el tipo: INGRESO solo muestra PROVEEDOR, EGRESO solo PRODUCTOR/COMERCIALIZADORA.
                                Si viene de una OC, ya se precargó arriba en handleSeleccionarOC. */}
                            <select disabled
                                value={thirdPartyId}
                                onChange={(e) => setThirdPartyId(e.target.value)}
                                    className="w-full bg-gray-200 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 outline-none cursor-not-allowed"
                            >
                                <option value="" >Sin tercero (movimiento interno)</option>
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
                        <h2 className="font-semibold text-gray-800">Insumos</h2>
                        <button
                            type="button"
                            onClick={agregarLinea}
                            className="flex items-center gap-1 text-sm font-semibold text-[#3B5BDB] hover:text-[#2F49B8]"
                        >
                            <Plus size={16} />
                            Agregar insumo
                        </button>
                    </div>

                    <table className="w-full text-sm">
    <thead className="bg-[#3B5BDB] text-white">
        <tr>
            <th className="text-left px-4 py-3">Insumo</th>
            {esBodeguero ? (
                <>
                    <th className="text-right px-4 py-3 w-36">Cantidad comprada</th>
                    <th className="text-right px-4 py-3 w-36">Cantidad ingresada</th>
                </>
            ) : (
                <>
                    <th className="text-right px-4 py-3 w-36">Cantidad real</th>
                    <th className="text-right px-4 py-3 w-32">Costo unit.</th>
                    <th className="text-right px-4 py-3 w-28">Descuento</th>
                    <th className="text-right px-4 py-3 w-32">Total</th>
                </>
            )}
            <th className="px-4 py-3 w-12"></th>
        </tr>
    </thead>
    <tbody>
        {lineas.map((linea, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-4 py-2">
                    <select
                        value={linea.supply_id}
                        onChange={(e) => actualizarLinea(index, 'supply_id', e.target.value)}
                        disabled={linea.bloqueada}
                        className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3B5BDB] ${
                            linea.bloqueada ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
                        }`}
                    >
                        <option value="">Seleccionar...</option>
                        {insumos.map((i) => (
                            <option key={i.id} value={i.id}>{i.code} — {i.name}</option>
                        ))}
                    </select>
                    {linea.bloqueada && !esBodeguero && (
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Lock size={10} />
                            De la OC — pendiente: {linea.pendiente}
                        </p>
                    )}
                </td>

                {esBodeguero ? (
                    <>
                        {/* Cantidad comprada: viene de la OC (quantity_ordered - ya recibido),
                            solo lectura — el bodeguero NO puede tocar este valor */}
                        <td className="px-4 py-2">
                            <input
                                type="number"
                                value={linea.pendiente ?? ''}
                                readOnly
                                disabled
                                className="w-full bg-gray-200 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right text-gray-600 outline-none cursor-not-allowed"
                            />
                        </td>
                        {/* Cantidad ingresada: lo único que el bodeguero puede editar,
                            es el mismo campo linea.quantity de siempre */}
                        <td className="px-4 py-2">
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={linea.quantity}
                                onChange={(e) => actualizarLinea(index, 'quantity', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            />
                        </td>
                    </>
                ) : (
                    <>
                        <td className="px-4 py-2">
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={linea.quantity}
                                onChange={(e) => actualizarLinea(index, 'quantity', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            />
                        </td>
                        <td className="px-4 py-2">
                            <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={linea.unit_cost}
                                onChange={(e) => actualizarLinea(index, 'unit_cost', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            />
                        </td>
                        <td className="px-4 py-2">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={linea.discount}
                                onChange={(e) => actualizarLinea(index, 'discount', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                            />
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                            ${totalLinea(linea).toFixed(2)}
                        </td>
                    </>
                )}

                <td className="px-4 py-2 text-center">
                    {lineas.length > 1 && !linea.bloqueada && !esBodeguero && (
                        <button
                            type="button"
                            onClick={() => quitarLinea(index)}
                            className="text-red-500 hover:text-red-700"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </td>
            </tr>
        ))}
    </tbody>
    {!esBodeguero && (
        <tfoot>
            <tr className="bg-gray-50 border-t">
                <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-700">
                    Total general
                </td>
                <td className="px-4 py-3 text-right font-bold text-[#3B5BDB]">
                    ${totalGeneral.toFixed(2)}
                </td>
                <td></td>
            </tr>
        </tfoot>
    )}
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
                        className="px-5 py-2.5 text-sm font-semibold bg-[#3B5BDB] text-white rounded-lg hover:bg-[#2F49B8] disabled:opacity-50"
                    >
                        {guardando ? 'Guardando...' : 'Guardar movimiento'}
                    </button>
                </div>
            </form >
        </div >
    );
}