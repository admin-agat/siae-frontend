// ShipmentFormPage.jsx
// Formulario de Registro de Embarque: cabecera (Naviera, Barco, Puerto de salida,
// semanas, año) + líneas de detalle por Cliente/Destino/SKU. El código
// (EMB-00000018) se genera automáticamente. Mismo patrón que PurchaseOrderFormPage.
import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createShipment, getNextShipmentCode } from '../../api/shipments';
import { getShippingLines } from '../../api/shippingLines';
import { getPorts } from '../../api/ports';
import { getDestinations } from '../../api/destinations';
import { getCustomers } from '../../api/customers';
import { getSkus } from '../../api/skus'; // ajustar nombre real si difiere

// Combinaciones válidas de tipo de carga (cruce Granel/Caja × Bajo cubierta/Contenedor)
const TIPOS_CARGA = [
    { value: 'GRANEL_BAJO_CUBIERTA', label: 'Granel — Bajo cubierta' },
    { value: 'GRANEL_CONTENEDOR', label: 'Granel — Contenedor' },
    { value: 'CAJA_BAJO_CUBIERTA', label: 'Caja paletizada — Bajo cubierta (48/palet)' },
    { value: 'CAJA_CONTENEDOR', label: 'Caja paletizada — Contenedor (54/palet)' },
];

const NEGOTIATION_TYPES = ['CONTRATO', 'SPOT'];
const INCOTERMS = ['FOB', 'CFR', 'CIF'];

// Una línea vacía nueva, para el botón "Agregar línea".
const lineaVacia = (weekPorDefecto = '') => ({
    customer_id: '',
    week: weekPorDefecto,
    destination_port_id: '',
    arrival_date: '',
    sku_id: '',
    booking_id: '',
    type: '',
    incoterm: '',
    negotiation_type: '',
    container_quantity: '',
    box_quantity: '',
});

// Bloquea cualquier tecla que no sea parte de un número válido (mismo patrón que OC)
function bloquearTeclasInvalidas(e) {
    const teclasPermitidas = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
    ];
    if (teclasPermitidas.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return;

    const esDigito = /^[0-9]$/.test(e.key);
    const esPuntoValido = e.key === '.' && !e.target.value.includes('.');

    if (!esDigito && !esPuntoValido) {
        e.preventDefault();
    }
}

function bloquearPegadoInvalido(e) {
    const texto = e.clipboardData.getData('text');
    if (!/^\d*\.?\d*$/.test(texto)) {
        e.preventDefault();
    }
}

export default function ShipmentFormPage() {
    const navigate = useNavigate();

    // Cabecera del Embarque
    const [shippingLineId, setShippingLineId] = useState('');
    const [vesselName, setVesselName] = useState('');
    const [departurePortId, setDeparturePortId] = useState('');
    const [departureDate, setDepartureDate] = useState(new Date().toISOString().slice(0, 10));
    const [weekStart, setWeekStart] = useState('');
    const [weekEnd, setWeekEnd] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [comment, setComment] = useState('');
    const [previewCode, setPreviewCode] = useState('');

    // Líneas de detalle
    const [lineas, setLineas] = useState([lineaVacia()]);

    // Catálogos
    const [navieras, setNavieras] = useState([]);
    const [puertos, setPuertos] = useState([]);
    const [destinos, setDestinos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [skus, setSkus] = useState([]);

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [codigoCreado, setCodigoCreado] = useState('');

    // Catálogos y preview de código se cargan una sola vez al montar
    useEffect(() => {
        cargarCatalogos();
        getNextShipmentCode()
            .then((res) => setPreviewCode(res.data.code))
            .catch(() => setPreviewCode(''));
    }, []);

    const cargarCatalogos = async () => {
        try {
            const [resNavieras, resPuertos, resDestinos, resClientes, resSkus] = await Promise.all([
                getShippingLines({ status: true }),
                getPorts({ status: true }),
                getDestinations({ status: true }),
                getCustomers({ status: true }),
                getSkus({ status: true }),
            ]);
            setNavieras(resNavieras.data);
            setPuertos(resPuertos.data);
            setDestinos(resDestinos.data);
            setClientes(resClientes.data);
            setSkus(resSkus.data);
        } catch (err) {
            console.error('ERROR AL CARGAR CATÁLOGOS:', err);
            setError('NO SE PUDIERON CARGAR LOS CATÁLOGOS (NAVIERAS/PUERTOS/DESTINOS/CLIENTES/SKU)');
        }
    };

    // --- Manejo de líneas dinámicas ---

    const agregarLinea = () => {
        setLineas((prev) => [...prev, lineaVacia(weekStart)]);
    };

    const quitarLinea = (index) => {
        setLineas((prev) => prev.filter((_, i) => i !== index));
    };

    const actualizarLinea = (index, campo, valor) => {
        setLineas((prev) => {
            const copia = [...prev];
            copia[index] = { ...copia[index], [campo]: valor };
            return copia;
        });
    };

    // Cajas por palet sugeridas, solo informativo — para tipos CAJA_*
    const cajasPorPaletSugerido = (tipo) => {
        if (tipo === 'CAJA_BAJO_CUBIERTA') return 48;
        if (tipo === 'CAJA_CONTENEDOR') return 54;
        return null;
    };

    // Muestra Marca/Tipo caja/Empaque/Stickers derivados del SKU elegido (solo lectura)
    const infoSku = (skuId) => skus.find((s) => String(s.id) === String(skuId));

    // --- Guardar ---

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!shippingLineId || !vesselName.trim() || !departureDate || !weekStart || !weekEnd || !year) {
            setError('NAVIERA, BARCO, FECHA DE ZARPE, SEMANAS Y AÑO SON OBLIGATORIOS');
            return;
        }

        const lineasValidas = lineas.filter(
            (l) => l.customer_id && l.destination_port_id && l.sku_id && l.type && l.box_quantity
        );
        if (lineasValidas.length === 0) {
            setError('AGREGÁ AL MENOS UNA LÍNEA CON CLIENTE, DESTINO, SKU, TIPO Y CANTIDAD DE CAJAS');
            return;
        }

        setGuardando(true);
        try {
            const res = await createShipment({
                shipping_line_id: shippingLineId,
                vessel_name: vesselName.trim().toUpperCase(),
                departure_port_id: departurePortId || null,
                departure_date: departureDate,
                week_start: weekStart,
                week_end: weekEnd,
                year,
                comment: comment || null,
                lines: lineasValidas.map((l) => ({
                    customer_id: l.customer_id,
                    week: l.week,
                    destination_port_id: l.destination_port_id,
                    arrival_date: l.arrival_date || null,
                    sku_id: l.sku_id,
                    booking_id: l.booking_id || null,
                    type: l.type,
                    incoterm: l.incoterm || null,
                    negotiation_type: l.negotiation_type || null,
                    container_quantity: l.container_quantity || 0,
                    box_quantity: l.box_quantity,
                })),
            });

            setCodigoCreado(res.data.code);
            setTimeout(() => {
                navigate('/exportaciones/embarques');
            }, 1800);
        } catch (err) {
            console.error('ERROR AL GUARDAR EL EMBARQUE:', err);
            setError(
                err.response?.data?.message || 'OCURRIÓ UN ERROR AL GUARDAR EL EMBARQUE'
            );
        } finally {
            setGuardando(false);
        }
    };

    const inputClass =
        'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500';
    const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5';

    return (
        <div className="max-w-full mx-auto p-6 space-y-4">
            {codigoCreado && (
                <div className="fixed top-6 right-6 z-50 bg-white border border-green-200 shadow-lg rounded-xl px-5 py-4 flex items-center gap-3">
                    <CheckCircle size={22} className="text-[#3B5BDB] flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-gray-800 text-sm">Embarque registrado</p>
                        <p className="text-gray-500 text-sm">{codigoCreado}</p>
                    </div>
                </div>
            )}

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Nuevo Registro de Embarque</h1>
                <p className="text-gray-500 text-sm">
                    Registrá el embarque completo — el código se genera automáticamente
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
                            <label className={labelClass}>Id Embarque (previo)</label>
                            <input value={previewCode} readOnly disabled className="w-full bg-gray-200 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 outline-none cursor-not-allowed" />
                        </div>

                        <div>
                            <label className={labelClass}>Naviera *</label>
                            <select value={shippingLineId} onChange={(e) => setShippingLineId(e.target.value)} required className={inputClass}>
                                <option value="">Seleccionar...</option>
                                {navieras.map((n) => (
                                    <option key={n.id} value={n.id}>{n.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Barco / Viaje *</label>
                            <input
                                value={vesselName}
                                onChange={(e) => setVesselName(e.target.value.toUpperCase())}
                                placeholder="Ej: STAR SPIRIT UNI1224"
                                required
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Puerto de Salida</label>
                            <select value={departurePortId} onChange={(e) => setDeparturePortId(e.target.value)} className={inputClass}>
                                <option value="">Seleccionar...</option>
                                {puertos.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className={labelClass}>Fecha de Zarpe *</label>
                            <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} required className={inputClass} />
                        </div>

                        <div>
                            <label className={labelClass}>Semana Inicial *</label>
                            <input type="number" min="1" max="53" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} required className={inputClass} />
                        </div>

                        <div>
                            <label className={labelClass}>Semana Final *</label>
                            <input type="number" min="1" max="53" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} required className={inputClass} />
                        </div>

                        <div>
                            <label className={labelClass}>Año *</label>
                            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} required className={inputClass} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Comentario</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={2}
                            placeholder="Ej: 6033 BOXES CONTAINING FRESH GREEN BANANAS..."
                            className={inputClass}
                        />
                    </div>
                </div>

                {/* Líneas de detalle */}
                <div className="bg-white rounded-xl shadow overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-3 border-b">
                        <h2 className="font-semibold text-gray-800">Líneas del embarque</h2>
                        <button
                            type="button"
                            onClick={agregarLinea}
                            className="flex items-center gap-1 text-sm font-semibold text-[#3B5BDB] hover:text-[#2F49B8]"
                        >
                            <Plus size={16} />
                            Agregar línea
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#3B5BDB] text-white">
                                <tr>
                                    <th className="text-left px-3 py-3 w-48">Cliente</th>
                                    <th className="text-center px-3 py-3 w-20">Semana</th>
                                    <th className="text-left px-3 py-3 w-44">Destino</th>
                                    <th className="text-left px-3 py-3 w-40">SKU</th>
                                    <th className="text-left px-3 py-3 w-56">Tipo de carga</th>
                                    <th className="text-center px-3 py-3 w-24">Incoterm</th>
                                    <th className="text-center px-3 py-3 w-28">Modalidad</th>
                                    <th className="text-right px-3 py-3 w-24">Contenedores</th>
                                    <th className="text-right px-3 py-3 w-24">Cajas</th>
                                    <th className="px-3 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineas.map((linea, index) => {
                                    const sku = infoSku(linea.sku_id);
                                    const cajasPorPalet = cajasPorPaletSugerido(linea.type);
                                    return (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={linea.customer_id}
                                                    onChange={(e) => actualizarLinea(index, 'customer_id', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {clientes.map((c) => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.customer_code} — {c.thirdParty?.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number" min="1" max="53"
                                                    value={linea.week}
                                                    onChange={(e) => actualizarLinea(index, 'week', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={linea.destination_port_id}
                                                    onChange={(e) => actualizarLinea(index, 'destination_port_id', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {destinos.map((d) => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={linea.sku_id}
                                                    onChange={(e) => actualizarLinea(index, 'sku_id', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {skus.map((s) => (
                                                        <option key={s.id} value={s.id}>{s.code}</option>
                                                    ))}
                                                </select>
                                                {sku && (
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {sku.brand?.name} · {sku.box_type?.name} · {sku.package_type?.name}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={linea.type}
                                                    onChange={(e) => actualizarLinea(index, 'type', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {TIPOS_CARGA.map((t) => (
                                                        <option key={t.value} value={t.value}>{t.label}</option>
                                                    ))}
                                                </select>
                                                {cajasPorPalet && (
                                                    <p className="text-xs text-gray-400 mt-1">{cajasPorPalet} cajas/palet</p>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={linea.incoterm}
                                                    onChange={(e) => actualizarLinea(index, 'incoterm', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                                                >
                                                    <option value="">—</option>
                                                    {INCOTERMS.map((i) => (
                                                        <option key={i} value={i}>{i}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={linea.negotiation_type}
                                                    onChange={(e) => actualizarLinea(index, 'negotiation_type', e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                                                >
                                                    <option value="">—</option>
                                                    {NEGOTIATION_TYPES.map((n) => (
                                                        <option key={n} value={n}>{n}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number" step="1" min="0"
                                                    value={linea.container_quantity}
                                                    onChange={(e) => actualizarLinea(index, 'container_quantity', e.target.value)}
                                                    onKeyDown={bloquearTeclasInvalidas}
                                                    onPaste={bloquearPegadoInvalido}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number" step="1" min="0"
                                                    value={linea.box_quantity}
                                                    onChange={(e) => actualizarLinea(index, 'box_quantity', e.target.value)}
                                                    onKeyDown={bloquearTeclasInvalidas}
                                                    onPaste={bloquearPegadoInvalido}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-[#3B5BDB]"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {lineas.length > 1 && (
                                                    <button type="button" onClick={() => quitarLinea(index)} className="text-red-500 hover:text-red-700">
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

                {/* Resumen simple: total de cajas */}
                <div className="bg-white rounded-xl shadow p-4">
                    <div className="flex justify-end">
                        <div className="w-full max-w-xs space-y-1 text-sm">
                            <div className="flex justify-between font-bold text-[#3B5BDB] text-base pt-2 border-t">
                                <span>Total cajas</span>
                                <span>
                                    {lineas.reduce((acc, l) => acc + (parseFloat(l.box_quantity) || 0), 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/exportaciones/embarques')}
                        className="px-5 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={guardando}
                        className="px-5 py-2.5 text-sm font-semibold bg-[#3B5BDB] text-white rounded-lg hover:bg-[#2F49B8] disabled:opacity-50"
                    >
                        {guardando ? 'Guardando...' : 'Guardar embarque'}
                    </button>
                </div>
            </form>
        </div>
    );
}