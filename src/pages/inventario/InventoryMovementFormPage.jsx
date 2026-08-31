// InventoryMovementFormPage.jsx
// Formulario para registrar un movimiento de inventario (Ingreso o Egreso)
// con líneas dinámicas de insumos. Cabecera + detalle se envían juntos y el
// backend los guarda en una sola transacción.
import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createInventoryMovement } from '../../api/inventoryMovements';
import { getWarehouses } from '../../api/warehouses';
import { getThirdParties } from '../../api/thirdParties';
import { getSupplies } from '../../api/supplies';
import { getActiveMovementReasonsByType } from '../../api/movementReasons';

// Una línea vacía nueva, para el botón "Agregar insumo".
const lineaVacia = () => ({
    supply_id: '',
    quantity: '',
    unit_cost: '',
    discount: '0',
});

export default function InventoryMovementFormPage() {
    const navigate = useNavigate();

    // Cabecera del movimiento
    const [tipo, setTipo] = useState('INGRESO');
    const [warehouseId, setWarehouseId] = useState('');
    const [thirdPartyId, setThirdPartyId] = useState('');
    const [movementReasonId, setMovementReasonId] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
    const [purchaseOrder, setPurchaseOrder] = useState('');
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

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    // Carga los catálogos una sola vez al entrar a la página.
    useEffect(() => {
        cargarCatalogos();
    }, []);

    // Cada vez que cambia el tipo (INGRESO/EGRESO), recarga los motivos
    // válidos para ese tipo y limpia el motivo seleccionado (puede que ya
    // no aplique al nuevo tipo).
    useEffect(() => {
        cargarMotivos(tipo);
        setMovementReasonId('');
    }, [tipo]);

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
            // de esta compra es distinto).
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
                purchase_order: purchaseOrder || null,
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
        <div className="p-6 max-w-4xl">
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
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipo *</label>
                            <select
                                value={tipo}
                                onChange={(e) => setTipo(e.target.value)}
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                            >
                                <option value="INGRESO">INGRESO</option>
                                <option value="EGRESO">EGRESO</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Fecha *</label>
                            <input
                                type="date"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bodega *</label>
                            <select
                                value={warehouseId}
                                onChange={(e) => setWarehouseId(e.target.value)}
                                required
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
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
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                            >
                                <option value="">Seleccionar motivo...</option>
                                {motivos.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Tercero (Proveedor / Productor)
                        </label>
                        <select
                            value={thirdPartyId}
                            onChange={(e) => setThirdPartyId(e.target.value)}
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                        >
                            <option value="">Sin tercero (movimiento interno)</option>
                            {terceros.map((t) => (
                                <option key={t.id} value={t.id}>{t.name} — {t.type}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Orden de compra</label>
                            <input
                                value={purchaseOrder}
                                onChange={(e) => setPurchaseOrder(e.target.value.toUpperCase())}
                                placeholder="Ej: OC-2026-045"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Guía de remisión</label>
                            <input
                                value={deliveryNote}
                                onChange={(e) => setDeliveryNote(e.target.value.toUpperCase())}
                                placeholder="Ej: 001-002-000123"
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Semana</label>
                            <input
                                type="number"
                                min="1"
                                max="53"
                                value={week}
                                onChange={(e) => setWeek(e.target.value)}
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Año</label>
                            <input
                                type="number"
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Referencia / Observación</label>
                        <input
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="Nota libre, opcional"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0F6E56]"
                        />
                    </div>
                </div>

                {/* Líneas de detalle */}
                <div className="bg-white rounded-xl shadow overflow-hidden">
                    <div className="flex justify-between items-center px-6 py-4 border-b">
                        <h2 className="font-semibold text-gray-800">Insumos</h2>
                        <button
                            type="button"
                            onClick={agregarLinea}
                            className="flex items-center gap-1 text-sm font-semibold text-[#0F6E56] hover:text-[#0a5a45]"
                        >
                            <Plus size={16} />
                            Agregar insumo
                        </button>
                    </div>

                    <table className="w-full text-sm">
                        <thead className="bg-[#0F6E56] text-white">
                            <tr>
                                <th className="text-left px-4 py-3">Insumo</th>
                                <th className="text-right px-4 py-3 w-28">Cantidad</th>
                                <th className="text-right px-4 py-3 w-32">Costo unit.</th>
                                <th className="text-right px-4 py-3 w-28">Descuento</th>
                                <th className="text-right px-4 py-3 w-32">Total</th>
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
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#0F6E56]"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {insumos.map((i) => (
                                                <option key={i.id} value={i.id}>{i.code} — {i.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
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
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50 border-t">
                                <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-700">
                                    Total general
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-[#0F6E56]">
                                    ${totalGeneral.toFixed(2)}
                                </td>
                                <td></td>
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
            </form>
        </div>
    );
}