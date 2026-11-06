// AccountingOrdersPage.jsx — 05/11/2026: Contabilidad aprueba y paga las OC de todos los departamentos.
//   POR APROBAR  → ver el detalle, aprobar o rechazar con motivo (vuelve al departamento a corregir)
//   POR PAGAR    → marcar las aprobadas y "Generar archivo Pichincha": un lote = un TXT para la carga masiva
//   LOTES        → volver a bajar el TXT, marcar pagado cuando el banco confirma, o anular (vuelven a por pagar)
//   TODAS        → todas, también las de bodega y las anteriores al módulo
// Una OC solo se paga si el proveedor tiene cuenta bancaria y su banco tiene código (Cuentas bancarias).
import { useEffect, useState } from 'react';
import { Eye, Check, X, Download, FileText, CheckCircle2, Ban, RefreshCw } from 'lucide-react';
import { getOrdenesContabilidad, aprobarOC, rechazarOC, getLotes, generarLote, descargarLote, lotePagado, anularLote } from '../../api/accounting';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import ToastFlotante from '../../components/common/ToastFlotante';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import OrdenCompraDetalle from '../../components/OrdenCompraDetalle';
import { dinero } from '../../utils/formato';
import { estadoOC, fechaVer } from '../../utils/ordenCompra';

const PESTANAS = [
    { clave: 'POR_APROBAR', etiqueta: 'POR APROBAR' },
    { clave: 'POR_PAGAR', etiqueta: 'POR PAGAR' },
    { clave: 'LOTES', etiqueta: 'LOTES AL BANCO' },
    { clave: 'TODAS', etiqueta: 'TODAS' },
];
const ESTADO_LOTE = {
    GENERADO: 'bg-indigo-100 text-indigo-700',
    PAGADO: 'bg-green-100 text-green-700',
    ANULADO: 'bg-gray-200 text-gray-700',
};

const porPagar = (o) => estadoOC(o).clave === 'APROBADA';
const suma = (lista, campo = 'valor_pagar') => lista.reduce((s, o) => s + Number(o[campo] || 0), 0);

function Resumen({ titulo, valor, detalle, clase }) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500">{titulo}</p>
            <p className={`text-2xl font-bold ${clase}`}>{valor}</p>
            <p className="text-xs text-gray-500">{detalle}</p>
        </div>
    );
}

function Ventana({ titulo, onCerrar, children, pie }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center px-7 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-primario">{titulo}</h2>
                    <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
                </div>
                <div className="px-7 py-6 space-y-4">{children}</div>
                {pie && <div className="px-7 py-4 border-t border-gray-100 flex flex-wrap justify-end gap-3">{pie}</div>}
            </div>
        </div>
    );
}

// Pide un motivo (rechazar OC / anular lote)
function DialogoMotivo({ titulo, texto, boton, onCancelar, onAceptar, procesando }) {
    const [motivo, setMotivo] = useState('');
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                <h3 className="font-bold text-gray-800">{titulo}</h3>
                <p className="text-sm text-gray-500">{texto}</p>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value.toUpperCase())} rows={3} maxLength={500} placeholder="MOTIVO" aria-label="Motivo"
                    className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primario" />
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onCancelar} disabled={procesando} className="px-4 py-2 text-sm font-semibold bg-cancelar text-cancelar-texto rounded-lg hover:bg-cancelar-hover">Cancelar</button>
                    <button type="button" onClick={() => onAceptar(motivo.trim())} disabled={procesando || motivo.trim().length < 3}
                        className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{boton}</button>
                </div>
            </div>
        </div>
    );
}

export default function AccountingOrdersPage() {
    const [ordenes, setOrdenes] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [pestana, setPestana] = useState('POR_APROBAR');
    const [ver, setVer] = useState(null);
    const [rechazar, setRechazar] = useState(null);     // orden
    const [elegidas, setElegidas] = useState([]);       // ids para el lote
    const [confirmarLote, setConfirmarLote] = useState(false);
    const [accionLote, setAccionLote] = useState(null); // { lote, accion: 'pagado' | 'anular' }
    const [procesando, setProcesando] = useState(false);
    const [toast, setToast] = useState(null);

    const pedir = () =>
        Promise.all([getOrdenesContabilidad(), getLotes()])
            .then(([o, l]) => {
                setOrdenes(Array.isArray(o) ? o : []);
                setLotes(Array.isArray(l) ? l : []);
            })
            .catch(() => setToast({ tipo: 'error', mensaje: 'No se pudo cargar la información.' }))
            .finally(() => setCargando(false));

    const recargar = () => {
        setElegidas([]);
        return pedir();
    };

    useEffect(() => {
        pedir();
    }, []);

    const error = (err, texto) => setToast({ tipo: 'error', mensaje: err.response?.data?.message || texto });

    const aprobar = async (o) => {
        setProcesando(true);
        try {
            await aprobarOC(o.id);
            setToast({ tipo: 'exito', mensaje: `${o.code} aprobada.` });
            setVer(null);
            await recargar();
        } catch (err) {
            error(err, 'No se pudo aprobar.');
        } finally {
            setProcesando(false);
        }
    };

    const confirmarRechazo = async (motivo) => {
        setProcesando(true);
        try {
            await rechazarOC(rechazar.id, motivo);
            setToast({ tipo: 'exito', mensaje: `${rechazar.code} rechazada: vuelve al departamento.` });
            setRechazar(null);
            setVer(null);
            await recargar();
        } catch (err) {
            error(err, 'No se pudo rechazar.');
        } finally {
            setProcesando(false);
        }
    };

    const generar = async () => {
        setProcesando(true);
        try {
            const lote = await generarLote(elegidas);
            await descargarLote(lote);
            setToast({ tipo: 'exito', mensaje: `Lote ${lote.code} generado: súbelo al banco.` });
            setConfirmarLote(false);
            setPestana('LOTES');
            await recargar();
        } catch (err) {
            error(err, 'No se pudo generar el archivo.');
        } finally {
            setProcesando(false);
        }
    };

    const ejecutarAccionLote = async (motivo) => {
        const { lote, accion } = accionLote;
        setProcesando(true);
        try {
            if (accion === 'pagado') await lotePagado(lote.id);
            else await anularLote(lote.id, motivo);
            setToast({ tipo: 'exito', mensaje: accion === 'pagado' ? `Lote ${lote.code} pagado.` : `Lote ${lote.code} anulado: sus órdenes vuelven a por pagar.` });
            setAccionLote(null);
            await recargar();
        } catch (err) {
            error(err, 'No se pudo cambiar el lote.');
        } finally {
            setProcesando(false);
        }
    };

    const bajar = async (lote) => {
        try {
            await descargarLote(lote);
        } catch (err) {
            error(err, 'No se pudo descargar el archivo.');
        }
    };

    const porAprobar = ordenes.filter((o) => estadoOC(o).clave === 'POR_APROBAR');
    const listasParaPagar = ordenes.filter(porPagar);
    const pagables = listasParaPagar.filter((o) => !o.problemas_pago?.length);
    const enBanco = ordenes.filter((o) => o.payment_status === 'EN_BANCO');
    const seleccion = ordenes.filter((o) => elegidas.includes(o.id));
    const alternar = (id) => setElegidas((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
    const todasMarcadas = pagables.length > 0 && pagables.every((o) => elegidas.includes(o.id));

    const boton = 'p-1.5 rounded-lg hover:bg-gray-100';
    const badge = (o) => {
        const e = estadoOC(o);
        return <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${e.clase}`}>{e.texto}</span>;
    };
    const colBase = [
        { titulo: 'Código', render: (o) => o.code, className: 'font-medium whitespace-nowrap' },
        { titulo: 'Fecha', render: (o) => fechaVer(o.date), className: 'whitespace-nowrap' },
        { titulo: 'Departamento', render: (o) => <span className="text-xs font-semibold bg-primario-claro text-primario px-2 py-1 rounded-full whitespace-nowrap">{o.department || '—'}</span> },
        { titulo: 'Proveedor', render: (o) => o.third_party?.name },
        { titulo: 'Concepto', render: (o) => <span className="line-clamp-2">{o.reference || (o.warehouse ? `INSUMOS PARA ${o.warehouse.name}` : '')}</span> },
        { titulo: 'Valor a pagar', render: (o) => dinero(o.valor_pagar), className: 'text-right font-semibold whitespace-nowrap' },
    ];
    const busqueda = {
        placeholderBusqueda: 'Buscar por código, departamento, proveedor o concepto...',
        textosBusqueda: (o) => [o.code, o.department, o.third_party?.name, o.reference, o.creator?.name],
    };

    return (
        <div className="p-6 space-y-6">
            <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />
            <EncabezadoPagina titulo="Aprobación y pago de OC" subtitulo="Órdenes de compra de todos los departamentos: apruébalas y arma la carga masiva para Banco Pichincha">
                <button type="button" onClick={() => { setCargando(true); recargar(); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primario text-white hover:bg-primario-hover transition">
                    <RefreshCw size={16} /> Actualizar
                </button>
            </EncabezadoPagina>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Resumen titulo="POR APROBAR" valor={porAprobar.length} detalle={`$ ${dinero(suma(porAprobar))}`} clase="text-amber-700" />
                <Resumen titulo="POR PAGAR" valor={listasParaPagar.length} detalle={`$ ${dinero(suma(listasParaPagar))}`} clase="text-blue-700" />
                <Resumen titulo="EN EL BANCO" valor={enBanco.length} detalle={`$ ${dinero(suma(enBanco))}`} clase="text-indigo-700" />
                <Resumen titulo="SIN CUENTA O CÓDIGO" valor={listasParaPagar.length - pagables.length} detalle="Aprobadas que aún no se pueden pagar" clase="text-red-700" />
            </div>

            <div className="flex overflow-x-auto">
                <div className="flex gap-1 bg-white border rounded-lg p-1">
                    {PESTANAS.map((p) => (
                        <button key={p.clave} type="button" onClick={() => setPestana(p.clave)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${pestana === p.clave ? 'bg-primario text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                            {p.etiqueta}
                            {p.clave === 'POR_APROBAR' && porAprobar.length > 0 && ` (${porAprobar.length})`}
                            {p.clave === 'POR_PAGAR' && listasParaPagar.length > 0 && ` (${listasParaPagar.length})`}
                        </button>
                    ))}
                </div>
            </div>

            {pestana === 'POR_APROBAR' && (
                <TablaEstandar key="aprobar" datos={porAprobar} cargando={cargando} nombreRegistros="órdenes" mostrarPestanas={false} porPagina={15} {...busqueda}
                    columnas={[...colBase, {
                        titulo: 'Acciones',
                        render: (o) => (
                            <div className="flex gap-1">
                                <button type="button" title="Ver" aria-label="Ver" onClick={() => setVer(o)} className={`${boton} text-gray-600`}><Eye size={16} /></button>
                                <button type="button" title="Aprobar" aria-label="Aprobar" disabled={procesando} onClick={() => aprobar(o)} className={`${boton} text-green-700`}><Check size={16} /></button>
                                <button type="button" title="Rechazar" aria-label="Rechazar" onClick={() => setRechazar(o)} className={`${boton} text-red-600`}><X size={16} /></button>
                            </div>
                        ),
                    }]}
                />
            )}

            {pestana === 'POR_PAGAR' && (
                <div className="space-y-4">
                    <p className="bg-amber-50 text-amber-800 text-sm rounded-lg px-4 py-3">
                        <strong>Formato del archivo por confirmar:</strong> se arma con el formato estándar de pagos de Banco Pichincha. Antes de
                        usarlo con dinero real hay que compararlo con un archivo que ya hayas subido al banco.
                    </p>
                    <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={todasMarcadas} disabled={!pagables.length}
                                onChange={() => setElegidas(todasMarcadas ? [] : pagables.map((o) => o.id))} />
                            Marcar todas las que se pueden pagar ({pagables.length})
                        </label>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600"><strong>{seleccion.length}</strong> elegida(s) · <strong>$ {dinero(suma(seleccion))}</strong></span>
                            <button type="button" disabled={!seleccion.length} onClick={() => setConfirmarLote(true)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50 transition">
                                <FileText size={16} /> Generar archivo Pichincha
                            </button>
                        </div>
                    </div>
                    <TablaEstandar key="pagar" datos={listasParaPagar} cargando={cargando} nombreRegistros="órdenes" mostrarPestanas={false} porPagina={25} {...busqueda}
                        columnas={[
                            {
                                titulo: '',
                                render: (o) => (
                                    <input type="checkbox" aria-label={`Elegir ${o.code}`} checked={elegidas.includes(o.id)} disabled={o.problemas_pago?.length > 0}
                                        onChange={() => alternar(o.id)} />
                                ),
                            },
                            ...colBase,
                            {
                                titulo: 'Cuenta',
                                render: (o) => (o.problemas_pago?.length
                                    ? <span className="text-xs text-red-700">{o.problemas_pago.join(' ')}</span>
                                    : <span className="text-xs text-gray-600 whitespace-nowrap">{o.cuenta_resumen}</span>),
                            },
                            { titulo: '', render: (o) => <button type="button" title="Ver" aria-label="Ver" onClick={() => setVer(o)} className={`${boton} text-gray-600`}><Eye size={16} /></button> },
                        ]}
                    />
                </div>
            )}

            {pestana === 'LOTES' && (
                <TablaEstandar key="lotes" datos={lotes} cargando={cargando} nombreRegistros="lotes" mostrarPestanas={false} porPagina={15}
                    placeholderBusqueda="Buscar por lote u orden..."
                    textosBusqueda={(l) => [l.code, ...(l.purchase_orders || []).map((o) => o.code)]}
                    columnas={[
                        { titulo: 'Lote', render: (l) => l.code, className: 'font-medium whitespace-nowrap' },
                        { titulo: 'Fecha', render: (l) => fechaVer(l.date), className: 'whitespace-nowrap' },
                        { titulo: 'Órdenes', render: (l) => <span className="text-xs">{(l.purchase_orders || []).map((o) => o.code).join(', ') || `${l.payments_count} pago(s)`}</span> },
                        { titulo: 'Total', render: (l) => dinero(l.total), className: 'text-right font-semibold whitespace-nowrap' },
                        {
                            titulo: 'Estado',
                            render: (l) => (
                                <div className="space-y-1">
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${ESTADO_LOTE[l.status]}`}>{l.status}</span>
                                    {l.cancellation_reason && <p className="text-xs text-gray-500">{l.cancellation_reason}</p>}
                                </div>
                            ),
                        },
                        { titulo: 'Generado por', render: (l) => l.creator?.name || '—' },
                        {
                            titulo: 'Acciones',
                            render: (l) => (
                                <div className="flex gap-1">
                                    <button type="button" title="Descargar TXT" aria-label="Descargar TXT" onClick={() => bajar(l)} className={`${boton} text-primario`}><Download size={16} /></button>
                                    {l.status === 'GENERADO' && (
                                        <>
                                            <button type="button" title="Marcar pagado" aria-label="Marcar pagado" onClick={() => setAccionLote({ lote: l, accion: 'pagado' })} className={`${boton} text-green-700`}><CheckCircle2 size={16} /></button>
                                            <button type="button" title="Anular lote" aria-label="Anular lote" onClick={() => setAccionLote({ lote: l, accion: 'anular' })} className={`${boton} text-red-600`}><Ban size={16} /></button>
                                        </>
                                    )}
                                </div>
                            ),
                        },
                    ]}
                />
            )}

            {pestana === 'TODAS' && (
                <TablaEstandar key="todas" datos={ordenes} cargando={cargando} nombreRegistros="órdenes" mostrarPestanas={false} porPagina={15} {...busqueda}
                    columnas={[...colBase,
                        { titulo: 'Estado', render: badge },
                        { titulo: '', render: (o) => <button type="button" title="Ver" aria-label="Ver" onClick={() => setVer(o)} className={`${boton} text-gray-600`}><Eye size={16} /></button> },
                    ]}
                />
            )}

            {ver && (
                <Ventana titulo={`Orden de compra ${ver.code}`} onCerrar={() => setVer(null)}
                    pie={estadoOC(ver).clave === 'POR_APROBAR' || estadoOC(ver).clave === 'APROBADA' ? (
                        <>
                            <button type="button" onClick={() => setRechazar(ver)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700">
                                <X size={16} /> Rechazar
                            </button>
                            {estadoOC(ver).clave === 'POR_APROBAR' && (
                                <button type="button" disabled={procesando} onClick={() => aprobar(ver)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50">
                                    <Check size={16} /> Aprobar
                                </button>
                            )}
                        </>
                    ) : null}>
                    <OrdenCompraDetalle orden={ver} />
                    {ver.approval_status === 'APROBADA' && !ver.payment_status && (
                        <p className={`text-sm rounded-lg px-4 py-2 ${ver.problemas_pago?.length ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {ver.problemas_pago?.length ? `No se puede pagar todavía: ${ver.problemas_pago.join(' ')}` : `Se paga a: ${ver.cuenta_resumen}`}
                        </p>
                    )}
                </Ventana>
            )}

            {rechazar && (
                <DialogoMotivo titulo={`Rechazar ${rechazar.code}`} texto="Vuelve al departamento con este motivo para que la corrija." boton="Rechazar"
                    procesando={procesando} onCancelar={() => setRechazar(null)} onAceptar={confirmarRechazo} />
            )}

            {confirmarLote && (
                <DialogoConfirmacion titulo="Generar archivo Pichincha" peligro={false} textoAceptar="Generar y descargar" procesando={procesando}
                    onCancelar={() => setConfirmarLote(false)} onAceptar={generar}>
                    Se arma un lote con <strong>{seleccion.length}</strong> pago(s) por <strong>$ {dinero(suma(seleccion))}</strong> y se descarga el TXT.
                    Esas órdenes quedan <strong>EN EL BANCO</strong> y no se pueden volver a pagar.
                </DialogoConfirmacion>
            )}

            {accionLote?.accion === 'pagado' && (
                <DialogoConfirmacion titulo={`Lote ${accionLote.lote.code} pagado`} peligro={false} procesando={procesando}
                    onCancelar={() => setAccionLote(null)} onAceptar={() => ejecutarAccionLote()}>
                    ¿El banco ya confirmó los <strong>{accionLote.lote.payments_count}</strong> pago(s) por <strong>$ {dinero(accionLote.lote.total)}</strong>? Las órdenes quedan PAGADAS.
                </DialogoConfirmacion>
            )}
            {accionLote?.accion === 'anular' && (
                <DialogoMotivo titulo={`Anular lote ${accionLote.lote.code}`} texto="Úsalo si el banco rechazó el archivo o se generó por error. Sus órdenes vuelven a POR PAGAR."
                    boton="Anular lote" procesando={procesando} onCancelar={() => setAccionLote(null)} onAceptar={ejecutarAccionLote} />
            )}
        </div>
    );
}
