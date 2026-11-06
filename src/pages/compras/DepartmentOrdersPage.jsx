// DepartmentOrdersPage.jsx — 05/11/2026: órdenes de compra de un departamento.
// Cada departamento (Compras, Sistemas, Asistente de Gerencia, Logística...) llena aquí sus OC:
// proveedor, concepto y líneas de texto libre (no entran a bodega). Le llegan a Contabilidad, que es la
// única que aprueba y después las paga por el banco. Ve solo las de su departamento.
// Se corrige mientras está POR APROBAR o RECHAZADA (al guardar vuelve a POR APROBAR).
import { useEffect, useState } from 'react';
import { Plus, Trash2, Eye, Pencil, XCircle, X } from 'lucide-react';
import { getDepartmentOrders, createDepartmentOrder, updateDepartmentOrder, cancelDepartmentOrder } from '../../api/departmentOrders';
import { getThirdParties } from '../../api/thirdParties';
import { useAuth } from '../../context/AuthContext';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import ModalShell from '../../components/common/ModalShell';
import ToastFlotante from '../../components/common/ToastFlotante';
import SelectBuscable from '../../components/common/SelectBuscable';
import CampoNumero from '../../components/common/CampoNumero';
import OrdenCompraDetalle from '../../components/OrdenCompraDetalle';
import { dinero } from '../../utils/formato';
import { hoyISO } from '../../utils/fecha';
import { calcularLinea, totalesOC, estadoOC, fechaVer } from '../../utils/ordenCompra';

const lineaVacia = () => ({ description: '', quantity_ordered: '', unit_price: '', tax_rate: 15, discount_percent: 0, retention_rate: 0 });

const FILTROS = [
    { clave: 'TODAS', etiqueta: 'TODAS', pasa: () => true },
    { clave: 'POR_APROBAR', etiqueta: 'POR APROBAR', pasa: (o) => estadoOC(o).clave === 'POR_APROBAR' },
    { clave: 'RECHAZADA', etiqueta: 'RECHAZADAS', pasa: (o) => estadoOC(o).clave === 'RECHAZADA' },
    { clave: 'APROBADA', etiqueta: 'APROBADAS', pasa: (o) => ['APROBADA', 'EN_BANCO'].includes(estadoOC(o).clave) },
    { clave: 'PAGADA', etiqueta: 'PAGADAS', pasa: (o) => estadoOC(o).clave === 'PAGADA' },
];

const editable = (o) => o.status !== 'CANCELADA' && !o.payment_status && ['POR_APROBAR', 'RECHAZADA'].includes(o.approval_status);
const cancelable = (o) => o.status !== 'CANCELADA' && !o.payment_status;

function Resumen({ titulo, valor, detalle, clase }) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500">{titulo}</p>
            <p className={`text-2xl font-bold ${clase}`}>{valor}</p>
            <p className="text-xs text-gray-500">{detalle}</p>
        </div>
    );
}

function OrdenModal({ orden, proveedores, onClose, onGuardado }) {
    const esEdicion = Boolean(orden?.id);
    const [form, setForm] = useState(() => (orden ? {
        third_party_id: String(orden.third_party_id), date: String(orden.date).slice(0, 10), reference: orden.reference || '',
        lines: orden.lines.map((l) => ({
            description: l.description || '', quantity_ordered: String(Number(l.quantity_ordered)), unit_price: String(Number(l.unit_price)),
            tax_rate: Number(l.tax_rate), discount_percent: Number(l.discount_percent || 0), retention_rate: Number(l.retention_rate || 0),
        })),
    } : { third_party_id: '', date: hoyISO(), reference: '', lines: [lineaVacia()] }));
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [exito, setExito] = useState('');

    const cambiarLinea = (i, campo, valor) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)) }));
    const t = totalesOC(form.lines);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.third_party_id) return setError('Elige el proveedor.');
        if (form.reference.trim().length < 3) return setError('Escribe el concepto: para qué es la compra.');
        const lineas = form.lines.filter((l) => l.description.trim() || l.quantity_ordered || l.unit_price);
        if (!lineas.length) return setError('Agrega al menos una línea.');
        if (lineas.some((l) => !l.description.trim() || !(parseFloat(l.quantity_ordered) > 0) || l.unit_price === '')) {
            return setError('Cada línea necesita descripción, cantidad y precio.');
        }
        setGuardando(true);
        try {
            const data = {
                third_party_id: Number(form.third_party_id), date: form.date, reference: form.reference.trim(),
                lines: lineas.map((l) => ({ ...l, description: l.description.trim(), quantity_ordered: Number(l.quantity_ordered), unit_price: Number(l.unit_price) })),
            };
            const guardada = esEdicion ? await updateDepartmentOrder(orden.id, data) : await createDepartmentOrder(data);
            setExito(esEdicion ? 'Orden corregida: volvió a Contabilidad.' : `Orden ${guardada.code} enviada a Contabilidad.`);
            setTimeout(() => { onGuardado(); onClose(); }, 1100);
        } catch (err) {
            const errores = err.response?.data?.errors;
            setError(errores ? Object.values(errores).flat().join(' ') : (err.response?.data?.message || 'No se pudo guardar la orden.'));
        } finally {
            setGuardando(false);
        }
    };

    const label = 'block text-sm font-semibold text-gray-700 mb-1.5';
    const input = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primario';
    const celda = 'w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primario';

    return (
        <ModalShell title={esEdicion ? `Corregir ${orden.code}` : 'Nueva orden de compra'} onClose={onClose} onSubmit={handleSubmit}
            esEdicion={esEdicion} guardando={guardando} error={error} toast={exito} size="lg">
            {orden?.approval_status === 'RECHAZADA' && orden.rejection_reason && (
                <p className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2"><strong>Contabilidad la rechazó:</strong> {orden.rejection_reason}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <label className={label}>Proveedor *</label>
                    <SelectBuscable value={form.third_party_id} onChange={(e) => setForm((f) => ({ ...f, third_party_id: e.target.value }))} className={input}>
                        <option value="">SELECCIONAR...</option>
                        {proveedores.map((p) => <option key={p.id} value={String(p.id)}>{p.name}{p.identification ? ` — ${p.identification}` : ''}</option>)}
                    </SelectBuscable>
                    <p className="text-xs text-gray-400 mt-1">¿No está el proveedor? Pídele a Contabilidad que lo cree en Terceros.</p>
                </div>
                <div>
                    <label className={label}>Fecha *</label>
                    <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={input} />
                </div>
                <div className="md:col-span-3">
                    <label className={label}>Concepto *</label>
                    <input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value.toUpperCase() }))} maxLength={500}
                        placeholder="EJ. MANTENIMIENTO DE COMPUTADORAS DE OFICINA" className={input} />
                </div>
            </div>

            <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                    <thead className="bg-primario text-white">
                        <tr>
                            <th className="text-left px-2 py-2">DESCRIPCIÓN</th>
                            <th className="text-right px-2 py-2 w-24">CANTIDAD</th>
                            <th className="text-right px-2 py-2 w-28">PRECIO UNIT.</th>
                            <th className="text-center px-2 py-2 w-20">% IVA</th>
                            <th className="text-center px-2 py-2 w-20">% DESC</th>
                            <th className="text-center px-2 py-2 w-20">% RET IR</th>
                            <th className="text-right px-2 py-2 w-24">SUBTOTAL</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {form.lines.map((l, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                <td className="px-2 py-1.5">
                                    <input value={l.description} onChange={(e) => cambiarLinea(i, 'description', e.target.value.toUpperCase())} maxLength={255}
                                        placeholder="QUÉ SE COMPRA" aria-label={`Descripción de la línea ${i + 1}`} className={celda} />
                                </td>
                                <td className="px-2 py-1.5"><CampoNumero decimales={2} value={l.quantity_ordered} onChange={(e) => cambiarLinea(i, 'quantity_ordered', e.target.value)} aria-label="Cantidad" className={`${celda} text-right`} /></td>
                                <td className="px-2 py-1.5"><CampoNumero decimales={4} value={l.unit_price} onChange={(e) => cambiarLinea(i, 'unit_price', e.target.value)} aria-label="Precio unitario" className={`${celda} text-right`} /></td>
                                <td className="px-2 py-1.5">
                                    <select value={l.tax_rate} onChange={(e) => cambiarLinea(i, 'tax_rate', Number(e.target.value))} aria-label="% IVA" className={celda}>
                                        <option value={15}>15</option><option value={5}>5</option><option value={0}>0</option>
                                    </select>
                                </td>
                                <td className="px-2 py-1.5"><CampoNumero decimales={2} max={100} value={l.discount_percent} onChange={(e) => cambiarLinea(i, 'discount_percent', e.target.value)} aria-label="% descuento" className={`${celda} text-center`} /></td>
                                <td className="px-2 py-1.5"><CampoNumero decimales={2} max={100} value={l.retention_rate} onChange={(e) => cambiarLinea(i, 'retention_rate', e.target.value)} aria-label="% retención IR" className={`${celda} text-center`} /></td>
                                <td className="px-2 py-1.5 text-right">{dinero(calcularLinea(l).subtotal)}</td>
                                <td className="px-2 py-1.5 text-center">
                                    <button type="button" title="Quitar línea" aria-label="Quitar línea" disabled={form.lines.length === 1}
                                        onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}
                                        className="text-red-500 hover:text-red-700 disabled:opacity-30">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex flex-wrap justify-between items-start gap-4">
                <button type="button" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, lineaVacia()] }))}
                    className="flex items-center gap-1 text-sm font-semibold text-primario hover:text-primario-hover">
                    <Plus size={16} /> Agregar línea
                </button>
                <div className="w-full max-w-xs text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{dinero(t.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">IVA</span><span>{dinero(t.iva)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Retención IR</span><span>− {dinero(t.retencion)}</span></div>
                    <div className="flex justify-between border-t pt-1 font-bold text-gray-800"><span>Total a pagar</span><span>$ {dinero(t.total)}</span></div>
                </div>
            </div>
        </ModalShell>
    );
}

export default function DepartmentOrdersPage() {
    const { user } = useAuth();
    const [ordenes, setOrdenes] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [filtro, setFiltro] = useState('TODAS');
    const [modal, setModal] = useState(null);   // null | { orden }
    const [ver, setVer] = useState(null);       // orden en detalle
    const [cancelar, setCancelar] = useState(null); // { orden, motivo }
    const [toast, setToast] = useState(null);

    const pedir = () =>
        getDepartmentOrders()
            .then((d) => setOrdenes(Array.isArray(d) ? d : []))
            .catch(() => setToast({ tipo: 'error', mensaje: 'No se pudieron cargar las órdenes.' }))
            .finally(() => setCargando(false));

    useEffect(() => {
        pedir();
        getThirdParties({ type: 'PROVEEDOR' })
            .then((res) => setProveedores((res.data || []).filter((t) => t.type === 'PROVEEDOR' && t.status)))
            .catch(() => setProveedores([]));
    }, []);

    const confirmarCancelar = async () => {
        if (cancelar.motivo.trim().length < 3) return setToast({ tipo: 'error', mensaje: 'Escribe el motivo.' });
        try {
            await cancelDepartmentOrder(cancelar.orden.id, cancelar.motivo.trim());
            setToast({ tipo: 'exito', mensaje: `Orden ${cancelar.orden.code} cancelada.` });
            setCancelar(null);
            pedir();
        } catch (err) {
            setToast({ tipo: 'error', mensaje: err.response?.data?.message || 'No se pudo cancelar.' });
        }
    };

    const cuenta = (clave) => ordenes.filter(FILTROS.find((f) => f.clave === clave).pasa);
    const suma = (lista) => `$ ${dinero(lista.reduce((s, o) => s + Number(o.total || 0), 0))}`;
    const visibles = ordenes.filter(FILTROS.find((f) => f.clave === filtro).pasa);
    const boton = 'p-1.5 rounded-lg hover:bg-gray-100';

    return (
        <div className="p-6 space-y-6">
            <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />
            <EncabezadoPagina
                titulo="Órdenes de compra"
                subtitulo={`${user?.department || 'Tu departamento'}: lo que pides y si Contabilidad ya lo aprobó y pagó`}
                textoBoton="Nueva orden de compra"
                onNuevo={() => setModal({ orden: null })}
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Resumen titulo="POR APROBAR" valor={cuenta('POR_APROBAR').length} detalle={suma(cuenta('POR_APROBAR'))} clase="text-amber-700" />
                <Resumen titulo="RECHAZADAS" valor={cuenta('RECHAZADA').length} detalle="Corrígelas y vuelven a Contabilidad" clase="text-red-700" />
                <Resumen titulo="APROBADAS" valor={cuenta('APROBADA').length} detalle={`${suma(cuenta('APROBADA'))} por pagar`} clase="text-blue-700" />
                <Resumen titulo="PAGADAS" valor={cuenta('PAGADA').length} detalle={suma(cuenta('PAGADA'))} clase="text-green-700" />
            </div>

            <div className="flex justify-end overflow-x-auto">
                <div className="flex gap-1 bg-white border rounded-lg p-1">
                    {FILTROS.map((f) => (
                        <button key={f.clave} type="button" onClick={() => setFiltro(f.clave)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${filtro === f.clave ? 'bg-primario text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                            {f.etiqueta}
                        </button>
                    ))}
                </div>
            </div>

            <TablaEstandar
                datos={visibles}
                cargando={cargando}
                nombreRegistros="órdenes"
                mostrarPestanas={false}
                placeholderBusqueda="Buscar por código, proveedor o concepto..."
                textosBusqueda={(o) => [o.code, o.third_party?.name, o.reference, o.creator?.name]}
                porPagina={15}
                columnas={[
                    { titulo: 'Código', render: (o) => o.code, className: 'font-medium whitespace-nowrap' },
                    { titulo: 'Fecha', render: (o) => fechaVer(o.date), className: 'whitespace-nowrap' },
                    { titulo: 'Proveedor', render: (o) => o.third_party?.name },
                    { titulo: 'Concepto', render: (o) => <span className="line-clamp-2">{o.reference}</span> },
                    { titulo: 'Total', render: (o) => dinero(o.total), className: 'text-right font-semibold whitespace-nowrap' },
                    {
                        titulo: 'Estado',
                        render: (o) => {
                            const e = estadoOC(o);
                            return (
                                <div className="space-y-1">
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${e.clase}`}>{e.texto}</span>
                                    {e.clave === 'RECHAZADA' && <p className="text-xs text-red-700">{o.rejection_reason}</p>}
                                </div>
                            );
                        },
                    },
                    {
                        titulo: 'Acciones',
                        render: (o) => (
                            <div className="flex gap-1">
                                <button type="button" title="Ver" aria-label="Ver" onClick={() => setVer(o)} className={`${boton} text-gray-600`}><Eye size={16} /></button>
                                {editable(o) && <button type="button" title="Corregir" aria-label="Corregir" onClick={() => setModal({ orden: o })} className={`${boton} text-primario`}><Pencil size={16} /></button>}
                                {cancelable(o) && <button type="button" title="Cancelar orden" aria-label="Cancelar orden" onClick={() => setCancelar({ orden: o, motivo: '' })} className={`${boton} text-red-600`}><XCircle size={16} /></button>}
                            </div>
                        ),
                    },
                ]}
            />

            {modal && <OrdenModal orden={modal.orden} proveedores={proveedores} onClose={() => setModal(null)} onGuardado={pedir} />}

            {ver && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center px-7 py-5 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-primario">Orden de compra {ver.code}</h2>
                            <button type="button" onClick={() => setVer(null)} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
                        </div>
                        <div className="px-7 py-6"><OrdenCompraDetalle orden={ver} /></div>
                    </div>
                </div>
            )}

            {cancelar && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h3 className="font-bold text-gray-800">Cancelar {cancelar.orden.code}</h3>
                        <p className="text-sm text-gray-500">La orden no se borra: queda cancelada con el motivo y Contabilidad ya no la paga.</p>
                        <textarea value={cancelar.motivo} onChange={(e) => setCancelar((c) => ({ ...c, motivo: e.target.value.toUpperCase() }))} rows={3} maxLength={500}
                            placeholder="MOTIVO" aria-label="Motivo de la cancelación"
                            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primario" />
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => setCancelar(null)} className="px-4 py-2 text-sm font-semibold bg-cancelar text-cancelar-texto rounded-lg hover:bg-cancelar-hover">Volver</button>
                            <button type="button" onClick={confirmarCancelar} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Cancelar orden</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
