// BankPaymentsPage.jsx — 19/11/2026 (fase 1b-1, docs/modulos/pagos-liquidaciones.md 5 y 13.A): "Cuentas por pagar".
// Ruta: /contabilidad/pagos-banco (pantalla pagos_banco)
//   ANTICIPOS DE PRODUCTORES → los 80 % que aprobó el jefe de Liquidaciones (y los FALLIDOS que vuelven):
//                              marcar → Revisar → Generar TXT Pichincha (una línea por orden, P20)
//   LOTES AL BANCO           → volver a bajar el TXT, anular un GENERADO, y con confirmar_pagos marcar
//                              PAGADO o PAGADO EN PARTE con las líneas que el banco rechazó (vuelven a por pagar)
// La cuenta va siempre enmascarada (****1234). Solo entra al TXT la cuenta VERIFICADA en Cuentas bancarias.
// Las OC siguen en "Aprobación y pago de OC" hasta la fase 1b-2.
import { useEffect, useState } from 'react';
import { Download, CheckCircle2, Ban, RefreshCw, Search, X } from 'lucide-react';
import {
    getAnticiposPorPagar, revisarAnticipos, generarLoteAnticipos, getLotesAnticipos,
    anularLoteAnticipos, loteAnticiposPagado, descargarLoteAnticipos,
} from '../../api/accounting';
import { useAuth } from '../../context/AuthContext';
import { puede } from '../../routes/menu';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import TablaEstandar from '../../components/common/TablaEstandar';
import ToastFlotante from '../../components/common/ToastFlotante';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import ModalShell from '../../components/common/ModalShell';
import { dinero } from '../../utils/formato';
import { hoyISO } from '../../utils/fecha';

const PESTANAS = [
    { clave: 'ANTICIPOS', etiqueta: 'ANTICIPOS DE PRODUCTORES' },
    { clave: 'LOTES', etiqueta: 'LOTES AL BANCO' },
];
const ESTADO_LOTE = {
    GENERADO: 'bg-indigo-100 text-indigo-700',
    PAGADO: 'bg-green-100 text-green-700',
    PAGADO_PARCIAL: 'bg-amber-100 text-amber-800',
    ANULADO: 'bg-gray-200 text-gray-700',
};
const ESTADO_LINEA = {
    EN_BANCO: 'text-indigo-700',
    PAGADO: 'text-green-700',
    FALLIDO: 'text-red-700',
    ANULADO: 'text-gray-500',
};
const COLOR_CUENTA = { VERIFICADA: 'text-green-700', PENDIENTE: 'text-amber-700', 'SIN CUENTA': 'text-red-700' };
const suma = (lista) => lista.reduce((s, a) => s + Number(a.monto || 0), 0);
const fechaVer = (f) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—');

function Resumen({ titulo, valor, detalle, clase }) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500">{titulo}</p>
            <p className={`text-2xl font-bold ${clase}`}>{valor}</p>
            <p className="text-xs text-gray-500">{detalle}</p>
        </div>
    );
}

export default function BankPaymentsPage() {
    const { user } = useAuth();
    const puedeConfirmar = puede(user, 'confirmar_pagos');
    const [anticipos, setAnticipos] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [pestana, setPestana] = useState('ANTICIPOS');
    const [elegidas, setElegidas] = useState([]);
    const [revision, setRevision] = useState(null);     // { anticipos, total } del preview
    const [anular, setAnular] = useState(null);         // lote
    const [motivo, setMotivo] = useState('');
    const [pagado, setPagado] = useState(null);         // { lote, paid_at, bank_reference, fallidas: { itemId: motivo } }
    const [errorModal, setErrorModal] = useState('');
    const [procesando, setProcesando] = useState(false);
    const [toast, setToast] = useState(null);

    const pedir = () =>
        Promise.all([getAnticiposPorPagar(), getLotesAnticipos()])
            .then(([a, l]) => {
                setAnticipos(Array.isArray(a) ? a : []);
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

    const error = (err, texto) => {
        const e = err.response?.data?.errors;
        setToast({ tipo: 'error', mensaje: e ? Object.values(e).flat().join(' ') : (err.response?.data?.message || texto) });
    };

    const revisar = async () => {
        setProcesando(true);
        try {
            setRevision(await revisarAnticipos(elegidas));
        } catch (err) {
            error(err, 'No se pudo revisar.');
        } finally {
            setProcesando(false);
        }
    };

    const generar = async () => {
        setProcesando(true);
        try {
            const lote = await generarLoteAnticipos(elegidas);
            await descargarLoteAnticipos(lote);
            setToast({ tipo: 'exito', mensaje: `Lote ${lote.code} generado: súbelo al banco.` });
            setRevision(null);
            setPestana('LOTES');
            await recargar();
        } catch (err) {
            setRevision(null);
            error(err, 'No se pudo generar el archivo.');
        } finally {
            setProcesando(false);
        }
    };

    const bajar = async (lote) => {
        try {
            await descargarLoteAnticipos(lote);
        } catch (err) {
            error(err, 'No se pudo descargar el archivo.');
        }
    };

    const confirmarAnular = async () => {
        setProcesando(true);
        try {
            await anularLoteAnticipos(anular.id, motivo.trim());
            setToast({ tipo: 'exito', mensaje: `Lote ${anular.code} anulado: sus anticipos vuelven a por pagar.` });
            setAnular(null);
            await recargar();
        } catch (err) {
            setAnular(null);
            error(err, 'No se pudo anular el lote.');
        } finally {
            setProcesando(false);
        }
    };

    const confirmarPagado = async (e) => {
        e.preventDefault();
        const fallidas = Object.entries(pagado.fallidas).map(([itemId, m]) => ({ item_id: Number(itemId), motivo: m.trim() }));
        if (fallidas.some((f) => !f.motivo)) {
            setErrorModal('ESCRIBE POR QUÉ EL BANCO RECHAZÓ CADA LÍNEA FALLIDA.');
            return;
        }
        setProcesando(true);
        setErrorModal('');
        try {
            const lote = await loteAnticiposPagado(pagado.lote.id, { paid_at: pagado.paid_at, bank_reference: pagado.bank_reference || null, fallidas });
            setToast({ tipo: 'exito', mensaje: lote.status === 'PAGADO' ? `Lote ${lote.code} pagado.` : `Lote ${lote.code} pagado en parte: las fallidas vuelven a por pagar.` });
            setPagado(null);
            await recargar();
        } catch (err) {
            const ee = err.response?.data?.errors;
            setErrorModal(ee ? Object.values(ee).flat().join(' ') : (err.response?.data?.message || 'No se pudo registrar el pago.'));
        } finally {
            setProcesando(false);
        }
    };

    const pagables = anticipos.filter((a) => !a.problemas?.length);
    const seleccion = anticipos.filter((a) => elegidas.includes(a.id));
    const generados = lotes.filter((l) => l.status === 'GENERADO');
    const alternar = (id) => setElegidas((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
    const todasMarcadas = pagables.length > 0 && pagables.every((a) => elegidas.includes(a.id));
    const boton = 'text-white p-1.5 rounded-lg shadow-sm transition disabled:opacity-50';
    const input = 'w-full bg-gray-100 border border-gray-200 rounded-2xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primario';

    return (
        <div className="p-6 space-y-6">
            <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />
            <EncabezadoPagina titulo="Cuentas por pagar" subtitulo="Anticipos de productores aprobados por Liquidaciones: arma la carga masiva para Banco Pichincha">
                <button type="button" onClick={() => { setCargando(true); recargar(); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primario text-white hover:bg-primario-hover transition">
                    <RefreshCw size={16} /> Actualizar
                </button>
            </EncabezadoPagina>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Resumen titulo="POR PAGAR" valor={anticipos.length} detalle={`$ ${dinero(suma(anticipos))}`} clase="text-blue-700" />
                <Resumen titulo="SE PUEDEN PAGAR" valor={pagables.length} detalle={`$ ${dinero(suma(pagables))}`} clase="text-green-700" />
                <Resumen titulo="SIN CUENTA VERIFICADA" valor={anticipos.length - pagables.length} detalle="Aprobados que aún no entran al TXT" clase="text-red-700" />
                <Resumen titulo="LOTES EN EL BANCO" valor={generados.length} detalle={`$ ${dinero(generados.reduce((s, l) => s + Number(l.total || 0), 0))}`} clase="text-indigo-700" />
            </div>

            <div className="flex overflow-x-auto">
                <div className="flex gap-1 bg-white border rounded-lg p-1">
                    {PESTANAS.map((p) => (
                        <button key={p.clave} type="button" onClick={() => setPestana(p.clave)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${pestana === p.clave ? 'bg-primario text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                            {p.etiqueta}
                            {p.clave === 'ANTICIPOS' && anticipos.length > 0 && ` (${anticipos.length})`}
                        </button>
                    ))}
                </div>
            </div>

            {pestana === 'ANTICIPOS' && (
                <div className="space-y-4">
                    <p className="bg-amber-50 text-amber-800 text-sm rounded-lg px-4 py-3">
                        <strong>Formato del archivo por confirmar:</strong> se arma con el formato estándar de pagos de Banco Pichincha. Antes de
                        usarlo con dinero real hay que compararlo con un archivo que ya hayas subido al banco.
                    </p>
                    <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={todasMarcadas} disabled={!pagables.length}
                                onChange={() => setElegidas(todasMarcadas ? [] : pagables.map((a) => a.id))} />
                            Marcar todos los que se pueden pagar ({pagables.length})
                        </label>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600"><strong>{seleccion.length}</strong> elegido(s) · <strong>$ {dinero(suma(seleccion))}</strong></span>
                            <button type="button" disabled={!seleccion.length || procesando} onClick={revisar}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50 transition">
                                <Search size={16} /> Revisar
                            </button>
                        </div>
                    </div>
                    <TablaEstandar key="anticipos" datos={anticipos} cargando={cargando} nombreRegistros="anticipos" mostrarPestanas={false} porPagina={25}
                        placeholderBusqueda="Buscar por orden o vendedor..."
                        textosBusqueda={(a) => [a.code, a.vendedor?.name, a.banco]}
                        columnas={[
                            {
                                titulo: '',
                                render: (a) => (
                                    <input type="checkbox" aria-label={`Elegir ${a.code}`} checked={elegidas.includes(a.id)} disabled={a.problemas?.length > 0}
                                        onChange={() => alternar(a.id)} />
                                ),
                            },
                            { titulo: 'N° orden', render: (a) => a.code, className: 'font-medium whitespace-nowrap' },
                            { titulo: 'Orden', render: (a) => <span className="whitespace-nowrap">{a.orden}{a.fallida && <span className="block text-xs font-semibold text-red-700">FALLIDA: REINTENTAR</span>}</span> },
                            { titulo: 'Semana pago', render: (a) => `WK${a.semana_pago} / ${a.anio_pago}`, className: 'whitespace-nowrap' },
                            { titulo: 'Vendedor', render: (a) => a.vendedor?.name },
                            { titulo: 'Banco', render: (a) => a.banco || '—' },
                            { titulo: 'Cuenta', render: (a) => (a.cuenta ? <span className="whitespace-nowrap">{a.tipo_cuenta} {a.cuenta}</span> : '—') },
                            {
                                titulo: 'Estado cuenta',
                                render: (a) => (
                                    <div>
                                        <span className={`text-xs font-semibold whitespace-nowrap ${COLOR_CUENTA[a.estado_cuenta] || ''}`}>{a.estado_cuenta}</span>
                                        {a.problemas?.length > 0 && <span className="block text-xs text-red-700">NO SE PUEDE PAGAR: {a.problemas.join(' ')}</span>}
                                    </div>
                                ),
                            },
                            { titulo: 'Monto', render: (a) => `$ ${dinero(a.monto)}`, className: 'text-right font-semibold whitespace-nowrap' },
                        ]}
                    />
                </div>
            )}

            {pestana === 'LOTES' && (
                <TablaEstandar key="lotes" datos={lotes} cargando={cargando} nombreRegistros="lotes" mostrarPestanas={false} porPagina={15}
                    placeholderBusqueda="Buscar por lote, orden o vendedor..."
                    textosBusqueda={(l) => [l.code, ...(l.items || []).flatMap((i) => [i.code, i.vendedor])]}
                    columnas={[
                        { titulo: 'Lote', render: (l) => l.code, className: 'font-medium whitespace-nowrap' },
                        { titulo: 'Fecha', render: (l) => fechaVer(l.date), className: 'whitespace-nowrap' },
                        {
                            titulo: 'Líneas',
                            render: (l) => (
                                <div className="space-y-0.5 text-xs">
                                    {(l.items || []).map((i) => (
                                        <div key={i.id} className="whitespace-nowrap">
                                            {i.code} · {i.vendedor} · {i.banco} {i.cuenta} · $ {dinero(i.amount)}
                                            <span className={`ml-1 font-semibold ${ESTADO_LINEA[i.status] || ''}`}>{i.status}</span>
                                            {i.failure_reason && <span className="text-red-700"> ({i.failure_reason})</span>}
                                        </div>
                                    ))}
                                </div>
                            ),
                        },
                        { titulo: 'Total', render: (l) => `$ ${dinero(l.total)}`, className: 'text-right font-semibold whitespace-nowrap' },
                        {
                            titulo: 'Estado',
                            render: (l) => (
                                <div className="space-y-1">
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${ESTADO_LOTE[l.status] || ''}`}>{l.status === 'PAGADO_PARCIAL' ? 'PAGADO EN PARTE' : l.status}</span>
                                    {l.cancellation_reason && <p className="text-xs text-gray-500">{l.cancellation_reason}</p>}
                                </div>
                            ),
                        },
                        { titulo: 'Generado por', render: (l) => l.creator?.name || '—' },
                        {
                            titulo: 'Acciones',
                            render: (l) => (
                                <div className="flex gap-1">
                                    <button type="button" title="Descargar TXT" aria-label="Descargar TXT" onClick={() => bajar(l)} className={`${boton} bg-gray-600 hover:bg-gray-700`}><Download size={16} /></button>
                                    {l.status === 'GENERADO' && (
                                        <>
                                            {puedeConfirmar && (
                                                <button type="button" title="Registrar lo que pagó el banco" aria-label="Marcar pagado"
                                                    onClick={() => { setErrorModal(''); setPagado({ lote: l, paid_at: hoyISO(), bank_reference: '', fallidas: {} }); }}
                                                    className={`${boton} bg-green-600 hover:bg-green-700`}><CheckCircle2 size={16} /></button>
                                            )}
                                            <button type="button" title="Anular lote" aria-label="Anular lote" onClick={() => { setMotivo(''); setAnular(l); }} className={`${boton} bg-red-600 hover:bg-red-700`}><Ban size={16} /></button>
                                        </>
                                    )}
                                </div>
                            ),
                        },
                    ]}
                />
            )}

            {revision && (
                <DialogoConfirmacion titulo="Generar archivo Pichincha" peligro={false} textoAceptar={procesando ? 'Generando...' : 'Generar y descargar'} procesando={procesando}
                    onCancelar={() => setRevision(null)} onAceptar={generar}>
                    Se arma un lote con <strong>{revision.anticipos.length}</strong> línea(s), una por orden, por <strong>$ {dinero(revision.total)}</strong>, y se descarga el TXT.
                    Esos anticipos quedan <strong>EN EL BANCO</strong> y no se pueden volver a pagar.
                    {revision.anticipos.filter((a) => a.problemas?.length).map((a) => (
                        <span key={a.id} className="block mt-2 text-xs text-red-700">{a.code}: {a.problemas.join(' ')}</span>
                    ))}
                </DialogoConfirmacion>
            )}

            {anular && (
                <DialogoConfirmacion titulo={`Anular lote ${anular.code}`} textoAceptar={procesando ? 'Anulando...' : 'Anular lote'} procesando={procesando}
                    onCancelar={() => setAnular(null)} onAceptar={confirmarAnular}>
                    Úsalo si el banco rechazó todo el archivo o se generó por error. Sus anticipos vuelven a POR PAGAR.
                    <textarea value={motivo} onChange={(e) => setMotivo(e.target.value.toUpperCase())} rows={3} maxLength={500} placeholder="MOTIVO" aria-label="Motivo"
                        className="mt-3 w-full bg-gray-100 border border-gray-200 rounded-2xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primario" />
                </DialogoConfirmacion>
            )}

            {pagado && (
                <ModalShell title={`Lote ${pagado.lote.code}: lo que pagó el banco`} onClose={() => setPagado(null)} onSubmit={confirmarPagado}
                    guardando={procesando} error={errorModal} size="lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Fecha del pago *</label>
                            <input type="date" value={pagado.paid_at} onChange={(e) => setPagado((p) => ({ ...p, paid_at: e.target.value }))} className={input} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Referencia del banco</label>
                            <input value={pagado.bank_reference} maxLength={60} onChange={(e) => setPagado((p) => ({ ...p, bank_reference: e.target.value.toUpperCase() }))} className={input} />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 mb-2">Marca solo las líneas que el banco <strong>rechazó</strong> y escribe por qué: vuelven a por pagar. Las demás quedan PAGADAS.</p>
                        <table className="w-full text-sm">
                            <thead className="bg-primario text-white">
                                <tr>
                                    <th className="px-3 py-2 text-xs uppercase text-left">Falló</th>
                                    <th className="px-3 py-2 text-xs uppercase text-left">Orden · vendedor</th>
                                    <th className="px-3 py-2 text-xs uppercase text-right">Monto</th>
                                    <th className="px-3 py-2 text-xs uppercase text-left">Motivo del banco</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(pagado.lote.items || []).map((i, k) => {
                                    const fallo = pagado.fallidas[i.id] !== undefined;
                                    return (
                                        <tr key={i.id} className={k % 2 ? 'bg-gray-50' : 'bg-white'}>
                                            <td className="px-3 py-2">
                                                <input type="checkbox" aria-label={`Falló ${i.code}`} checked={fallo}
                                                    onChange={() => setPagado((p) => {
                                                        const f = { ...p.fallidas };
                                                        if (fallo) delete f[i.id]; else f[i.id] = '';
                                                        return { ...p, fallidas: f };
                                                    })} />
                                            </td>
                                            <td className="px-3 py-2">{i.code} · {i.vendedor}</td>
                                            <td className="px-3 py-2 text-right">$ {dinero(i.amount)}</td>
                                            <td className="px-3 py-2">
                                                {fallo && (
                                                    <input value={pagado.fallidas[i.id]} maxLength={255} placeholder="MOTIVO" aria-label={`Motivo ${i.code}`}
                                                        onChange={(e) => setPagado((p) => ({ ...p, fallidas: { ...p.fallidas, [i.id]: e.target.value.toUpperCase() } }))}
                                                        className={input} />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {Object.keys(pagado.fallidas).length > 0 && Object.keys(pagado.fallidas).length === (pagado.lote.items || []).length && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-red-700"><X size={12} /> Si el banco rechazó todo, cierra y anula el lote.</p>
                        )}
                    </div>
                </ModalShell>
            )}
        </div>
    );
}
