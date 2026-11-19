// Tablero de anticipos y pagos — 19/11/2026 (fase 1b-1, docs/modulos/pagos-liquidaciones.md 4.0 y 13.A)
// Ubicación: src/pages/liquidacion/SettlementPaymentsBoardPage.jsx
// Ruta: /liquidacion/tablero-pagos
//
// Copia el Excel "REPORTE DE ANTICIPOS" de Peter: filas agrupadas por DÍA DE CORTE, con subtotal por día y total.
// Aquí el jefe de Liquidaciones (aprobar_pagos_liquidacion) marca y aprueba, o devuelve con motivo.
//   - pagos: ve el tablero sin casillas. tablero_pagos_lectura (Gerencia/Finanzas): sin cuentas ni botones.
//   - En la 1b-1 solo hay órdenes ANTICIPO 80 % (las pide Comercial con PAGAR en Compra de fruta).
//   - Los indicadores se calculan con las filas que se ven; si no cuadran con los del backend, aviso rojo.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Check, X, RefreshCw, Download, Printer, AlertTriangle } from 'lucide-react';
import { getPaymentsBoard, approvePayables, rejectPayable } from '../../api/settlements';
import EncabezadoPagina from '../../components/common/EncabezadoPagina';
import ToastFlotante from '../../components/common/ToastFlotante';
import DialogoConfirmacion from '../../components/common/DialogoConfirmacion';
import SelectBuscable from '../../components/common/SelectBuscable';
import { dinero } from '../../utils/formato';
import { semanaISO } from '../../utils/semana';

const NEGOCIACIONES = ['SPOT', 'CONTRATO', 'MANUAL', 'TODAS'];
const ESTADOS = [
    { clave: 'POR_APROBAR', etiqueta: 'POR APROBAR' },
    { clave: 'APROBADA', etiqueta: 'APROBADO' },
    { clave: 'EN_BANCO', etiqueta: 'EN LOTE' },
    { clave: 'PAGADA', etiqueta: 'PAGADO' },
    { clave: 'RECHAZADA', etiqueta: 'DEVUELTO' },
    { clave: 'FALLIDA', etiqueta: 'FALLIDO' },
    { clave: 'TODAS', etiqueta: 'TODOS' },
];
const ORDENES = [
    { clave: 'TODAS', etiqueta: 'TODAS' },
    { clave: 'ANTICIPO_80', etiqueta: 'ANTICIPO 80 %' },
    { clave: 'SALDO_SPOT', etiqueta: 'SALDO SPOT' },
    { clave: 'CONTRATO_100', etiqueta: '100 % CONTRATO' },
    { clave: 'MANUAL', etiqueta: 'ANTICIPO O PRÉSTAMO MANUAL' },
];
const COLOR_ESTADO = {
    'POR APROBAR': 'bg-amber-100 text-amber-800',
    APROBADA: 'bg-blue-100 text-blue-700',
    'EN BANCO': 'bg-indigo-100 text-indigo-700',
    PAGADA: 'bg-green-100 text-green-700',
    DEVUELTA: 'bg-red-100 text-red-700',
    FALLIDA: 'bg-red-100 text-red-700',
};
const COLOR_CUENTA = { OK: 'text-green-700', PENDIENTE: 'text-amber-700', 'FALTA CUENTA': 'text-red-700' };

const cajas = (n) => Number(n || 0).toLocaleString('es-EC');
const fechaVer = (f) => (f ? f.split('-').reverse().join('/') : 'SIN FECHA DE CORTE');
const r2 = (n) => Math.round(n * 100) / 100;
const resumen = (fs) => {
    const c = fs.reduce((s, x) => s + x.cajas, 0);
    return {
        ordenes: fs.length,
        cajas: c,
        monto: r2(fs.reduce((s, x) => s + x.monto, 0)),
        precio: c ? fs.reduce((s, x) => s + x.cajas * x.precio, 0) / c : 0, // ponderado por cajas (no el máximo)
    };
};

function Indicador({ titulo, valor, clase }) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500">{titulo}</p>
            <p className={`text-2xl font-bold ${clase}`}>{valor}</p>
        </div>
    );
}

export default function SettlementPaymentsBoardPage() {
    const actual = semanaISO();
    const [filtros, setFiltros] = useState({ anio: String(actual.anio), semana: String(actual.semana), negociacion: 'SPOT', dia: '', estado: 'POR_APROBAR', orden: 'TODAS', vendedor: '' });
    const [datos, setDatos] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [vendedores, setVendedores] = useState({}); // { id: nombre } de lo que se ha visto (para el filtro)
    const [elegidas, setElegidas] = useState([]);     // ids
    const [aprobar, setAprobar] = useState(false);
    const [devolver, setDevolver] = useState(null);   // fila
    const [motivo, setMotivo] = useState('');
    const [procesando, setProcesando] = useState(false);
    const [toast, setToast] = useState(null);
    const [error, setError] = useState('');

    // "cargando" lo prende quien cambia los filtros o pulsa Actualizar (no se cambia estado dentro del efecto)
    const pedir = () => {
        const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== ''));
        return getPaymentsBoard(params)
            .then((res) => {
                setError('');
                setDatos(res.data);
                setElegidas([]);
                setVendedores((prev) => ({ ...prev, ...Object.fromEntries(res.data.filas.filter((f) => f.vendedor).map((f) => [f.vendedor.id, f.vendedor.name])) }));
            })
            .catch((err) => setError(err.response?.data?.message || 'NO SE PUDO CARGAR EL TABLERO.'))
            .finally(() => setCargando(false));
    };

    useEffect(() => {
        pedir();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtros]);

    const filas = useMemo(() => datos?.filas || [], [datos]);
    const grupos = useMemo(() => {
        const mapa = new Map();
        filas.forEach((f) => {
            const k = f.dia_corte || '';
            if (!mapa.has(k)) mapa.set(k, []);
            mapa.get(k).push(f);
        });
        return [...mapa.entries()].map(([dia, fs]) => ({ dia, filas: fs, ...resumen(fs) }));
    }, [filas]);
    const total = resumen(filas);
    // Los totales del backend salen con los mismos filtros: si no cuadran con lo que se ve, algo está mal
    const descuadre = datos && (datos.totales.ordenes !== total.ordenes || datos.totales.cajas !== total.cajas || Math.abs(datos.totales.monto - total.monto) > 0.004);

    const verCuenta = Boolean(datos?.ver_cuenta);
    const puedeAprobar = Boolean(datos?.puede_aprobar);
    const aprobables = filas.filter((f) => f.puede_aprobar);
    const seleccion = filas.filter((f) => elegidas.includes(f.id));
    const alternar = (id) => setElegidas((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
    const alternarDia = (g) => {
        const ids = g.filas.filter((f) => f.puede_aprobar).map((f) => f.id);
        const todas = ids.every((id) => elegidas.includes(id));
        setElegidas((e) => (todas ? e.filter((x) => !ids.includes(x)) : [...new Set([...e, ...ids])]));
    };
    const cambiar = (campo) => (e) => {
        setCargando(true);
        setFiltros((f) => ({ ...f, [campo]: e.target.value }));
    };

    const confirmarAprobar = async () => {
        setProcesando(true);
        try {
            const res = await approvePayables(seleccion.map((f) => ({ tipo: f.tipo, id: f.id })));
            setAprobar(false);
            setToast({ tipo: 'exito', mensaje: `${res.data.aprobadas} orden(es) aprobada(s): pasan a Contabilidad` });
            await pedir();
        } catch (err) {
            setAprobar(false);
            setError(err.response?.data?.message || 'NO SE PUDO APROBAR.');
        } finally {
            setProcesando(false);
        }
    };

    const confirmarDevolver = async () => {
        setProcesando(true);
        try {
            await rejectPayable(devolver.tipo, devolver.id, motivo.trim());
            setToast({ tipo: 'exito', mensaje: `${devolver.code} devuelta a Comercial` });
            setDevolver(null);
            await pedir();
        } catch (err) {
            setDevolver(null);
            const e = err.response?.data?.errors;
            setError(e ? Object.values(e).flat().join(' ') : (err.response?.data?.message || 'NO SE PUDO DEVOLVER.'));
        } finally {
            setProcesando(false);
        }
    };

    // Exportar: CSV con ; (lo abre Excel con tildes por el BOM), las filas que se ven con subtotales y total
    const exportar = () => {
        const cab = ['DIA DE CORTE', 'COMERCIALIZA', 'N° ORDEN', 'ORDEN', 'SEMANA COMPRA', 'CAJAS', 'RECIBIDAS', 'PRECIO PACT.', 'A PAGAR', 'SEMANA PAGO', ...(verCuenta ? ['CUENTA'] : []), 'ESTADO', 'MOTIVO'];
        const num = (v, d = 2) => Number(v || 0).toFixed(d).replace('.', ',');
        const lineas = [cab];
        grupos.forEach((g) => {
            g.filas.forEach((f) => lineas.push([fechaVer(f.dia_corte), f.vendedor?.name, f.code, f.orden, `WK${f.semana_compra}`, f.cajas, f.recibidas, num(f.precio, 4), num(f.monto),
                f.semana_pago ? `WK${f.semana_pago}` : '', ...(verCuenta ? [f.cuenta] : []), f.estado, f.motivo || '']));
            lineas.push([`SUBTOTAL ${fechaVer(g.dia)}`, `${g.ordenes} ORDEN(ES)`, '', '', '', g.cajas, '', num(g.precio, 4), num(g.monto)]);
        });
        lineas.push(['TOTAL', `${total.ordenes} ORDEN(ES)`, '', '', '', total.cajas, '', num(total.precio, 4), num(total.monto)]);
        const csv = lineas.map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
        const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `TABLERO_PAGOS_${filtros.anio}_WK${filtros.semana || 'TODAS'}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const th = 'px-3 py-2 text-xs font-semibold uppercase whitespace-nowrap';
    const td = 'px-3 py-2 text-sm';
    const input = 'w-full bg-gray-100 border border-gray-200 rounded-2xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primario';
    const etiqueta = 'block text-xs font-semibold text-gray-600 uppercase mb-1';
    const columnas = 10 + (verCuenta ? 1 : 0) + (puedeAprobar ? 2 : 0);
    const textoFiltros = `${filtros.anio}${filtros.semana ? ` WK${filtros.semana}` : ''} · ${filtros.negociacion} · ${ESTADOS.find((e) => e.clave === filtros.estado)?.etiqueta}`
        + `${filtros.orden !== 'TODAS' ? ` · ${ORDENES.find((o) => o.clave === filtros.orden)?.etiqueta}` : ''}${filtros.dia ? ` · CORTE ${fechaVer(filtros.dia)}` : ''}${filtros.vendedor ? ` · ${vendedores[filtros.vendedor] || ''}` : ''}`;

    return (
        <div className="p-6 space-y-6">
            <ToastFlotante toast={toast} onCerrar={() => setToast(null)} />
            <EncabezadoPagina titulo="Tablero de anticipos y pagos" subtitulo="Órdenes de pago de Liquidaciones por día de corte: el jefe de Liquidaciones las aprueba aquí">
                <button type="button" onClick={() => { setCargando(true); pedir(); }} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primario text-white hover:bg-primario-hover transition">
                    <RefreshCw size={16} /> Actualizar
                </button>
                <button type="button" onClick={exportar} disabled={!filas.length} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 transition">
                    <Download size={16} /> Exportar Excel
                </button>
                <button type="button" onClick={() => window.print()} disabled={!filas.length} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 transition">
                    <Printer size={16} /> Imprimir
                </button>
            </EncabezadoPagina>

            <div className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <div>
                    <label className={etiqueta}>Año</label>
                    <input type="number" value={filtros.anio} onChange={cambiar('anio')} className={input} />
                </div>
                <div>
                    <label className={etiqueta}>Semana</label>
                    <input type="number" min={1} max={53} value={filtros.semana} onChange={cambiar('semana')} placeholder="TODAS" className={input} />
                </div>
                <div>
                    <label className={etiqueta}>Negociación</label>
                    <select value={filtros.negociacion} onChange={cambiar('negociacion')} className={input}>
                        {NEGOCIACIONES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                </div>
                <div>
                    <label className={etiqueta}>Día de corte</label>
                    <input type="date" value={filtros.dia} onChange={cambiar('dia')} className={input} />
                </div>
                <div>
                    <label className={etiqueta}>Estado</label>
                    <select value={filtros.estado} onChange={cambiar('estado')} className={input}>
                        {ESTADOS.map((x) => <option key={x.clave} value={x.clave}>{x.etiqueta}</option>)}
                    </select>
                </div>
                <div>
                    <label className={etiqueta}>Orden</label>
                    <select value={filtros.orden} onChange={cambiar('orden')} className={input}>
                        {ORDENES.map((x) => <option key={x.clave} value={x.clave}>{x.etiqueta}</option>)}
                    </select>
                </div>
                <div>
                    <label className={etiqueta}>Vendedor</label>
                    <SelectBuscable value={filtros.vendedor} onChange={cambiar('vendedor')} className={input}>
                        <option value="">TODOS</option>
                        {Object.entries(vendedores).sort((a, b) => a[1].localeCompare(b[1])).map(([idV, nombre]) => <option key={idV} value={idV}>{nombre}</option>)}
                    </SelectBuscable>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Indicador titulo="CAJAS" valor={cajas(total.cajas)} clase="text-gray-800" />
                <Indicador titulo="TOTAL A PAGAR" valor={`$ ${dinero(total.monto)}`} clase="text-green-700" />
                <Indicador titulo="N° DE ÓRDENES" valor={total.ordenes} clase="text-primario" />
            </div>

            {descuadre && (
                <p className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    <AlertTriangle size={16} /> LOS TOTALES DEL SISTEMA (${dinero(datos.totales.monto)}, {datos.totales.ordenes} ÓRDENES) NO CUADRAN CON LAS FILAS QUE SE VEN: AVISA A SISTEMAS.
                </p>
            )}
            {error && <p className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</p>}

            {puedeAprobar && (
                <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={aprobables.length > 0 && aprobables.every((f) => elegidas.includes(f.id))} disabled={!aprobables.length}
                            onChange={() => setElegidas(aprobables.every((f) => elegidas.includes(f.id)) ? [] : aprobables.map((f) => f.id))} />
                        Marcar todas las que puedes aprobar ({aprobables.length})
                    </label>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600"><strong>{seleccion.length}</strong> elegida(s) · <strong>$ {dinero(resumen(seleccion).monto)}</strong></span>
                        <button type="button" disabled={!seleccion.length} onClick={() => setAprobar(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-guardar text-guardar-texto hover:bg-guardar-hover disabled:opacity-50 transition">
                            <Check size={16} /> Aprobar seleccionados
                        </button>
                    </div>
                </div>
            )}

            <div id="area-impresion" className="bg-white rounded-xl shadow overflow-x-auto">
                <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>
                <h2 className="hidden print:block text-sm font-bold px-3 py-2">TABLERO DE ANTICIPOS Y PAGOS · {textoFiltros}</h2>
                <table className="w-full border-collapse min-w-[1100px] print:min-w-0 print:text-[9px]">
                    <thead className="bg-primario text-white">
                        <tr>
                            {puedeAprobar && <th className={`${th} w-8 print:hidden`}></th>}
                            <th className={`${th} text-left`}>Comercializa</th>
                            <th className={`${th} text-left`}>N° orden</th>
                            <th className={`${th} text-left`}>Orden</th>
                            <th className={`${th} text-left`}>Sem. compra</th>
                            <th className={`${th} text-right`}>Cajas</th>
                            <th className={`${th} text-right`}>Recibidas</th>
                            <th className={`${th} text-right`}>Precio pact.</th>
                            <th className={`${th} text-right`}>A pagar</th>
                            <th className={`${th} text-left`}>Sem. pago</th>
                            {verCuenta && <th className={`${th} text-left`}>Cuenta</th>}
                            <th className={`${th} text-left`}>Estado</th>
                            {puedeAprobar && <th className={`${th} print:hidden`}></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {cargando ? (
                            <tr><td colSpan={columnas} className="px-4 py-6 text-center text-sm text-gray-400">Cargando...</td></tr>
                        ) : !filas.length ? (
                            <tr><td colSpan={columnas} className="px-4 py-6 text-center text-sm text-gray-400">No hay órdenes con estos filtros.</td></tr>
                        ) : grupos.map((g) => (
                            <Fragment key={g.dia || 'sin'}>
                                <tr className="bg-primario-claro">
                                    {puedeAprobar && (
                                        <td className={`${td} print:hidden`}>
                                            <input type="checkbox" aria-label={`Marcar el día ${fechaVer(g.dia)}`} disabled={!g.filas.some((f) => f.puede_aprobar)}
                                                checked={g.filas.some((f) => f.puede_aprobar) && g.filas.filter((f) => f.puede_aprobar).every((f) => elegidas.includes(f.id))}
                                                onChange={() => alternarDia(g)} />
                                        </td>
                                    )}
                                    <td colSpan={columnas - (puedeAprobar ? 1 : 0)} className={`${td} font-bold text-primario`}>
                                        DÍA DE CORTE: {fechaVer(g.dia)}
                                        {!g.dia && <span className="ml-2 text-xs font-semibold text-amber-700">LAS COMPRAS NO TIENEN FECHA DE CORTE: REVISA ANTES DE APROBAR</span>}
                                    </td>
                                </tr>
                                {g.filas.map((f, i) => (
                                    <tr key={`${f.tipo}-${f.id}`} className={`border-t align-top ${i % 2 ? 'bg-gray-50' : 'bg-white'}`}>
                                        {puedeAprobar && (
                                            <td className={`${td} print:hidden`}>
                                                <input type="checkbox" aria-label={`Elegir ${f.code}`} checked={elegidas.includes(f.id)} disabled={!f.puede_aprobar}
                                                    title={!f.puede_aprobar && f.estado === 'POR APROBAR' ? 'No puedes aprobar una orden que tú pediste' : undefined}
                                                    onChange={() => alternar(f.id)} />
                                            </td>
                                        )}
                                        <td className={`${td} font-medium`}>{f.vendedor?.name}{f.pedido_por && <span className="block text-xs text-gray-400 print:hidden">PIDIÓ {f.pedido_por}</span>}</td>
                                        <td className={`${td} whitespace-nowrap`}>{f.code}</td>
                                        <td className={`${td} whitespace-nowrap`}>{f.orden}</td>
                                        <td className={td}>WK{f.semana_compra}</td>
                                        <td className={`${td} text-right`}>{cajas(f.cajas)}</td>
                                        <td className={`${td} text-right`}>{f.tarja_total ? cajas(f.recibidas) : <span className="text-xs text-gray-400">SIN TARJA</span>}</td>
                                        <td className={`${td} text-right`}>$ {dinero(f.precio)}</td>
                                        <td className={`${td} text-right font-semibold`}>$ {dinero(f.monto)}</td>
                                        <td className={td}>{f.semana_pago ? `WK${f.semana_pago}` : '—'}</td>
                                        {verCuenta && <td className={`${td} text-xs font-semibold whitespace-nowrap ${COLOR_CUENTA[f.cuenta] || ''}`}>{f.cuenta}</td>}
                                        <td className={td}>
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${COLOR_ESTADO[f.estado] || 'bg-gray-100 text-gray-700'}`}>{f.estado}</span>
                                            {f.motivo && <span className="block text-xs text-red-700">{f.motivo}</span>}
                                            {f.avisos?.map((a) => <span key={a} className="block text-xs font-semibold text-amber-700">{a}</span>)}
                                        </td>
                                        {puedeAprobar && (
                                            <td className={`${td} print:hidden`}>
                                                {f.puede_devolver && (
                                                    <button type="button" title="Devolver a Comercial con motivo" aria-label={`Devolver ${f.code}`} onClick={() => { setMotivo(''); setDevolver(f); }}
                                                        className="text-white p-1.5 rounded-lg shadow-sm bg-red-600 hover:bg-red-700 transition"><X size={16} /></button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                <tr className="border-t bg-gray-100 font-semibold text-sm">
                                    {puedeAprobar && <td className="print:hidden"></td>}
                                    <td className={td} colSpan={4}>SUBTOTAL {fechaVer(g.dia)} · {g.ordenes} ORDEN(ES)</td>
                                    <td className={`${td} text-right`}>{cajas(g.cajas)}</td>
                                    <td></td>
                                    <td className={`${td} text-right`}>$ {dinero(g.precio)}</td>
                                    <td className={`${td} text-right`}>$ {dinero(g.monto)}</td>
                                    <td colSpan={2 + (verCuenta ? 1 : 0) + (puedeAprobar ? 1 : 0)}></td>
                                </tr>
                            </Fragment>
                        ))}
                    </tbody>
                    {filas.length > 0 && !cargando && (
                        <tfoot>
                            <tr className="border-t-2 border-primario bg-white font-bold text-sm text-green-700">
                                {puedeAprobar && <td className="print:hidden"></td>}
                                <td className={td} colSpan={4}>TOTAL · {total.ordenes} ORDEN(ES)</td>
                                <td className={`${td} text-right`}>{cajas(total.cajas)}</td>
                                <td></td>
                                <td className={`${td} text-right`}>$ {dinero(total.precio)}</td>
                                <td className={`${td} text-right`}>$ {dinero(total.monto)}</td>
                                <td colSpan={2 + (verCuenta ? 1 : 0) + (puedeAprobar ? 1 : 0)}></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {aprobar && (
                <DialogoConfirmacion titulo="Aprobar órdenes de pago" peligro={false} textoAceptar={procesando ? 'Aprobando...' : 'Sí, aprobar'} procesando={procesando}
                    onCancelar={() => setAprobar(false)} onAceptar={confirmarAprobar}>
                    VAS A APROBAR <strong>{seleccion.length}</strong> ÓRDEN(ES) POR <strong>$ {dinero(resumen(seleccion).monto)}</strong>. Pasan a Contabilidad para pagarlas por el banco.
                    {seleccion.some((f) => !f.dia_corte) && <span className="block mt-2 text-xs text-amber-700">Hay órdenes SIN FECHA DE CORTE.</span>}
                    {seleccion.some((f) => f.cuenta && f.cuenta !== 'OK') && <span className="block mt-2 text-xs text-amber-700">SIN CUENTA BANCARIA VERIFICADA: CONTABILIDAD NO PODRÁ PAGAR POR EL BANCO HASTA QUE SE VERIFIQUE.</span>}
                </DialogoConfirmacion>
            )}

            {devolver && (
                <DialogoConfirmacion titulo={`Devolver ${devolver.code}`} textoAceptar={procesando ? 'Devolviendo...' : 'Devolver'} procesando={procesando}
                    onCancelar={() => setDevolver(null)} onAceptar={confirmarDevolver}>
                    Vuelve a Comercial ({devolver.pedido_por || 'quien la pidió'}) con este motivo; puede pedirla de nuevo.
                    <textarea value={motivo} onChange={(e) => setMotivo(e.target.value.toUpperCase())} rows={3} maxLength={500} placeholder="MOTIVO" aria-label="Motivo"
                        className="mt-3 w-full bg-gray-100 border border-gray-200 rounded-2xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primario" />
                </DialogoConfirmacion>
            )}
        </div>
    );
}
