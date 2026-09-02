// PurchaseOrderFormPage.jsx
// Formulario para crear una Orden de Compra (OC): se le pide a un proveedor
// una lista de insumos con cantidad, precio, % IVA, % descuento y % Retención IR
// por línea — igual que el formato que ya usa Contífico. El código (OC-2026-0001)
// y la Semana se generan/calculan automáticamente.
import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPurchaseOrder, getNextPurchaseOrderCode } from '../../api/purchaseOrders';
import { getWarehouses } from '../../api/warehouses';
import { getThirdParties } from '../../api/thirdParties';
import { getSupplies } from '../../api/supplies';

// Una línea vacía nueva, para el botón "Agregar insumo".
// tax_rate arranca en 15 (el IVA más común); discount_percent y retention_rate en 0.
const lineaVacia = () => ({
    supply_id: '',
    quantity_ordered: '',
    unit_price: '',
    tax_rate: 15,
    discount_percent: 0,
    retention_rate: 0,
});

// Calcula el número de semana ISO 8601 (semana bananera) para una fecha dada
function getISOWeek(fecha) {
    const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const diaSemana = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - diaSemana + 3);
    const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const diaSemanaPrimerJueves = (primerJueves.getUTCDay() + 6) % 7;
    primerJueves.setUTCDate(primerJueves.getUTCDate() - diaSemanaPrimerJueves + 3);
    return 1 + Math.round((d - primerJueves) / (7 * 24 * 3600 * 1000));
}

// Bloquea CUALQUIER tecla que no sea parte de un número válido.
// Usamos lista blanca (en vez de lista negra) porque bloquear solo
// "e/E/+/-" deja pasar cualquier otra letra en algunos navegadores.
// Se permiten: dígitos, un solo punto decimal, teclas de edición/navegación
// (Backspace, Delete, flechas, Tab) y combinaciones con Ctrl/Cmd (copiar,
// pegar, seleccionar todo) — el pegado en sí se valida aparte, ver abajo.
function bloquearTeclasInvalidas(e) {
    const teclasPermitidas = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
    ];
    if (teclasPermitidas.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return; // Ctrl+C, Ctrl+V, Ctrl+A, etc.

    // Solo dígitos y un único punto decimal (si ya hay uno, se bloquea otro)
    const esDigito = /^[0-9]$/.test(e.key);
    const esPuntoValido = e.key === '.' && !e.target.value.includes('.');

    if (!esDigito && !esPuntoValido) {
        e.preventDefault();
    }
}

// Bloquea pegar texto que no sea un número válido (ej. pegar "abc123")
function bloquearPegadoInvalido(e) {
    const texto = e.clipboardData.getData('text');
    if (!/^\d*\.?\d*$/.test(texto)) {
        e.preventDefault();
    }
}

// --- Cálculos de una línea, en el mismo orden que el backend (PurchaseOrderLine.php) ---
// subtotalBruto = cantidad x precio
// descuento = subtotalBruto x (% desc / 100)
// subtotal = subtotalBruto - descuento (base imponible)
// iva = subtotal x (% IVA / 100)
// retencion = subtotal x (% Ret IR / 100)
// total = subtotal + iva - retencion
function calcularLinea(linea) {
    const cantidad = parseFloat(linea.quantity_ordered) || 0;
    const precio = parseFloat(linea.unit_price) || 0;
    const pctDesc = parseFloat(linea.discount_percent) || 0;
    const pctIva = parseFloat(linea.tax_rate) || 0;
    const pctRet = parseFloat(linea.retention_rate) || 0;

    const subtotalBruto = cantidad * precio;
    const descuento = subtotalBruto * (pctDesc / 100);
    const subtotal = subtotalBruto - descuento;
    const iva = subtotal * (pctIva / 100);
    const retencion = subtotal * (pctRet / 100);
    const total = subtotal + iva - retencion;

    return { subtotalBruto, descuento, subtotal, iva, retencion, total };
}

export default function PurchaseOrderFormPage() {
    const navigate = useNavigate();

    // Cabecera de la OC
    const [thirdPartyId, setThirdPartyId] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
    const [reference, setReference] = useState('');
    const [week, setWeek] = useState('');
    const [previewCode, setPreviewCode] = useState('');

    // Líneas de detalle
    const [lineas, setLineas] = useState([lineaVacia()]);

    // Catálogos
    const [bodegas, setBodegas] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [insumos, setInsumos] = useState([]);
    const [cargandoInsumos, setCargandoInsumos] = useState(false);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [codigoCreado, setCodigoCreado] = useState('');

    // Bodegas y Proveedores se cargan una sola vez al montar la página.
    // Los Insumos YA NO se cargan aquí — dependen del Proveedor elegido (ver abajo).
    useEffect(() => {
        cargarCatalogos();
    }, []);

    // Cada vez que cambia la fecha, recalcula la semana ISO y consulta al
    // backend el próximo código de OC como vista previa (no reserva nada).
    useEffect(() => {
        if (!fecha) return;
        setWeek(getISOWeek(new Date(fecha + 'T00:00:00')));
        getNextPurchaseOrderCode(fecha)
            .then((res) => setPreviewCode(res.data.code))
            .catch(() => setPreviewCode(''));
    }, [fecha]);

    // Cada vez que cambia el Proveedor, volvemos a pedir los insumos —
    // ahora filtrados por third_party_id, así el select de "Insumo" solo
    // muestra lo que ESE proveedor realmente vende (tabla third_party_supplies).
    // Si no hay proveedor elegido, la lista queda vacía (no tiene sentido
    // mostrar insumos de nadie todavía).
    useEffect(() => {
        if (!thirdPartyId) {
            setInsumos([]);
            return;
        }

        setCargandoInsumos(true);
        getSupplies('', null, thirdPartyId)
            .then((res) => setInsumos(res.data))
            .catch((err) => {
                console.error('ERROR AL CARGAR INSUMOS DEL PROVEEDOR:', err);
                setError('NO SE PUDIERON CARGAR LOS INSUMOS DE ESTE PROVEEDOR');
            })
            .finally(() => setCargandoInsumos(false));

        // Al cambiar de proveedor, reiniciamos las líneas: un insumo ya
        // seleccionado podría no pertenecer al proveedor nuevo.
        setLineas([lineaVacia()]);
    }, [thirdPartyId]);

    const cargarCatalogos = async () => {
        try {
            const [resBodegas, resTerceros] = await Promise.all([
                getWarehouses(),
                getThirdParties(),
            ]);
            setBodegas(resBodegas.data);
            // Solo proveedores — una OC siempre se le hace a un proveedor, nunca a un productor
            setProveedores(resTerceros.data.filter((t) => t.type === 'PROVEEDOR'));
        } catch (err) {
            console.error('ERROR AL CARGAR CATÁLOGOS:', err);
            setError('NO SE PUDIERON CARGAR LOS CATÁLOGOS (BODEGAS/PROVEEDORES)');
        }
    };

    // Proveedor seleccionado, para mostrar su RUC (columna "identification" en third_parties)
    const proveedorSeleccionado = proveedores.find((p) => String(p.id) === String(thirdPartyId));

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

            // Al elegir un insumo, autocompletamos su costo de referencia como
            // punto de partida (editable si el precio pactado con el proveedor es distinto).
            if (campo === 'supply_id') {
                const insumo = insumos.find((i) => String(i.id) === String(valor));
                if (insumo && !copia[index].unit_price) {
                    copia[index].unit_price = insumo.cost || '';
                }
            }
            return copia;
        });
    };

    // --- Totales generales, agrupados por tasa de IVA (igual que el reporte de Contífico) ---
    const calculosLineas = lineas.map(calcularLinea);

    const subtotal15 = lineas.reduce(
        (acc, l, i) => acc + (parseFloat(l.tax_rate) === 15 ? calculosLineas[i].subtotal : 0), 0
    );
    const subtotal5 = lineas.reduce(
        (acc, l, i) => acc + (parseFloat(l.tax_rate) === 5 ? calculosLineas[i].subtotal : 0), 0
    );
    const subtotal0 = lineas.reduce(
        (acc, l, i) => acc + (parseFloat(l.tax_rate) === 0 ? calculosLineas[i].subtotal : 0), 0
    );
    const iva15 = lineas.reduce(
        (acc, l, i) => acc + (parseFloat(l.tax_rate) === 15 ? calculosLineas[i].iva : 0), 0
    );
    const iva5 = lineas.reduce(
        (acc, l, i) => acc + (parseFloat(l.tax_rate) === 5 ? calculosLineas[i].iva : 0), 0
    );
    const retencionTotal = calculosLineas.reduce((acc, c) => acc + c.retencion, 0);
    const totalGeneral = calculosLineas.reduce((acc, c) => acc + c.total, 0);

    // --- Guardar ---

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!thirdPartyId || !warehouseId || !fecha) {
            setError('PROVEEDOR, BODEGA DESTINO Y FECHA SON OBLIGATORIOS');
            return;
        }

        const lineasValidas = lineas.filter((l) => l.supply_id && l.quantity_ordered && l.unit_price);
        if (lineasValidas.length === 0) {
            setError('AGREGÁ AL MENOS UN INSUMO CON CANTIDAD Y PRECIO');
            return;
        }

        setGuardando(true);
        try {
            const res = await createPurchaseOrder({
                third_party_id: thirdPartyId,
                warehouse_id: warehouseId,
                date: fecha,
                reference: reference || null,
                lines: lineasValidas.map((l) => ({
                    supply_id: l.supply_id,
                    quantity_ordered: l.quantity_ordered,
                    unit_price: l.unit_price,
                    tax_rate: l.tax_rate,
                    discount_percent: l.discount_percent,
                    retention_rate: l.retention_rate,
                })),
            });

            // OC creada — mostramos el toast de confirmación y esperamos un momento
            // antes de volver al listado, para que el usuario alcance a leer el código.
            setCodigoCreado(res.data.code);
            setTimeout(() => {
                navigate('/ordenes-compra');
            }, 1800);
        } catch (err) {
            console.error('ERROR AL GUARDAR LA ORDEN DE COMPRA:', err);
            setError(
                err.response?.data?.message || 'OCURRIÓ UN ERROR AL GUARDAR LA ORDEN DE COMPRA'
            );
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="max-w-full mx-auto p-6 space-y-4">
            {codigoCreado && (
                <div className="fixed top-6 right-6 z-50 bg-white border border-green-200 shadow-lg rounded-xl px-5 py-4 flex items-center gap-3">
                    <CheckCircle size={22} className="text-[#0F6E56] flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-gray-800 text-sm">Orden de compra creada</p>
                        <p className="text-gray-500 text-sm">{codigoCreado}</p>
                    </div>
                </div>
            )}

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Nueva Orden de Compra</h1>
                <p className="text-gray-500 text-sm">
                    Registrá lo pedido a un proveedor — el código se genera automáticamente
                </p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-4">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Cabecera */}
                <div className="bg-white rounded-xl shadow p-4 space-y-3">

                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">N° de OC (previo)</label>
                            <input
                                value={previewCode}
                                readOnly
                                disabled
                                className="w-full bg-gray-200 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 outline-none cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Semana</label>
                            <input
                                type="number"
                                value={week}
                                readOnly
                                disabled
                                className="w-full bg-gray-200 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 outline-none cursor-not-allowed"
                            />
                        </div>

                        

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bodega destino *</label>
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
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Fecha *</label>
                            <input
                                type="date"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Proveedor *</label>
                            <select
                                value={thirdPartyId}
                                onChange={(e) => setThirdPartyId(e.target.value)}
                                required
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none"
                            >
                                <option value="">Seleccionar proveedor...</option>
                                {proveedores.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            {/* RUC del proveedor seleccionado — columna "identification" en third_parties */}
                            {proveedorSeleccionado?.identification && (
                                <p className="text-xs text-gray-400 mt-1">
                                    RUC: {proveedorSeleccionado.identification}
                                </p>
                            )}
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
                    <div className="flex justify-between items-center px-4 py-3 border-b">
                        <h2 className="font-semibold text-gray-800">Insumos pedidos</h2>
                        <button
                            type="button"
                            onClick={agregarLinea}
                            disabled={!thirdPartyId}
                            className="flex items-center gap-1 text-sm font-semibold text-[#0F6E56] hover:text-[#0a5a45] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Plus size={16} />
                            Agregar insumo
                        </button>
                    </div>

                    {!thirdPartyId && (
                        <div className="px-4 py-3 text-sm text-gray-500 bg-yellow-50 border-b border-yellow-100">
                            Elegí un proveedor arriba para ver los insumos que vende.
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#0F6E56] text-white">
                                <tr>
                                    <th className="text-left px-3 py-3">Insumo</th>
                                    <th className="text-right px-3 py-3 w-28">Cantidad</th>
                                    <th className="text-right px-3 py-3 w-28">Precio unit.</th>
                                    <th className="text-center px-3 py-3 w-24">% IVA</th>
                                    <th className="text-center px-3 py-3 w-24">% Desc</th>
                                    <th className="text-center px-3 py-3 w-24">% Ret IR</th>
                                    <th className="text-right px-3 py-3 w-28">Subtotal</th>
                                    <th className="px-3 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineas.map((linea, index) => {
                                    const calculo = calculosLineas[index];
                                    return (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={linea.supply_id}
                                                    onChange={(e) => actualizarLinea(index, 'supply_id', e.target.value)}
                                                    disabled={!thirdPartyId || cargandoInsumos}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#0F6E56] disabled:bg-gray-100"
                                                >
                                                    <option value="">
                                                        {cargandoInsumos ? 'Cargando...' : 'Seleccionar...'}
                                                    </option>
                                                    {insumos.map((i) => (
                                                        <option key={i.id} value={i.id}>{i.code} — {i.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    value={linea.quantity_ordered}
                                                    onChange={(e) => actualizarLinea(index, 'quantity_ordered', e.target.value)}
                                                    onKeyDown={bloquearTeclasInvalidas}
                                                    onPaste={bloquearPegadoInvalido}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#0F6E56]"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    min="0"
                                                    value={linea.unit_price}
                                                    onChange={(e) => actualizarLinea(index, 'unit_price', e.target.value)}
                                                    onKeyDown={bloquearTeclasInvalidas}
                                                    onPaste={bloquearPegadoInvalido}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#0F6E56]"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={linea.tax_rate}
                                                    onChange={(e) => actualizarLinea(index, 'tax_rate', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-[#0F6E56]"
                                                >
                                                    <option value={15}>15%</option>
                                                    <option value={5}>5%</option>
                                                    <option value={0}>0%</option>
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={linea.discount_percent}
                                                    onChange={(e) => actualizarLinea(index, 'discount_percent', e.target.value)}
                                                    onKeyDown={bloquearTeclasInvalidas}
                                                    onPaste={bloquearPegadoInvalido}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-[#0F6E56]"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={linea.retention_rate}
                                                    onChange={(e) => actualizarLinea(index, 'retention_rate', e.target.value)}
                                                    onKeyDown={bloquearTeclasInvalidas}
                                                    onPaste={bloquearPegadoInvalido}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-[#0F6E56]"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                                                ${calculo.subtotal.toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 text-center">
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
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Resumen de totales — mismo desglose que el reporte de Contífico */}
                <div className="bg-white rounded-xl shadow p-4">
                     <h2 className="font-semibold text-gray-800 mb-3">Resumen</h2>
                    <div className="flex justify-end">
                        <div className="w-full max-w-xs space-y-1 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal 15%</span>
                                <span>${subtotal15.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal 5%</span>
                                <span>${subtotal5.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal 0%</span>
                                <span>${subtotal0.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>IVA 15%</span>
                                <span>${iva15.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>IVA 5%</span>
                                <span>${iva5.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Retención IR</span>
                                <span>-${retencionTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-[#0F6E56] text-base pt-2 border-t">
                                <span>Total</span>
                                <span>${totalGeneral.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/ordenes-compra')}
                        className="px-5 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={guardando}
                        className="px-5 py-2.5 text-sm font-semibold bg-[#0F6E56] text-white rounded-lg hover:bg-[#0a5a45] disabled:opacity-50"
                    >
                        {guardando ? 'Guardando...' : 'Guardar orden de compra'}
                    </button>
                </div>
            </form>
        </div>
    );
}