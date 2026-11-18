// Reemplazo de <select> donde se puede ESCRIBIR para buscar (30/10/2026).
// Se usa igual que un <select>: mismos value, onChange(e) con e.target.name/value, name,
// disabled, required, className, y <option>/<optgroup> como hijos.
// Búsqueda sin tildes ni mayúsculas; flechas ↑↓, Enter elige, Esc cierra.
// La lista se dibuja en document.body (position fixed) para que no la corten modales ni tablas con scroll.
import { Children, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// 18/11/2026 (grilla de compras): búsqueda por palabras en cualquier orden ("MAYRA OBANDO" encuentra
// "OBANDO RIERA MAYRA VANESSA"), sin puntos (S.A., ASOC.). Orden: exacta, empieza igual, todas las palabras, contiene.
const sinPuntos = (t) => normalizar(t).replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
const puntaje = (etiqueta, q, palabras) => {
    const e = sinPuntos(etiqueta);
    if (e === q) return 0;
    if (e.startsWith(q)) return 1;
    const suyas = e.split(' ');
    if (palabras.every((p) => suyas.some((s) => s.startsWith(p)))) return 2;
    if (e.includes(q)) return 3;
    return -1;
};

const textoDe = (nodo) => {
    if (nodo == null || typeof nodo === 'boolean') return '';
    if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
    if (Array.isArray(nodo)) return nodo.map(textoDe).join('');
    if (isValidElement(nodo)) return textoDe(nodo.props.children);
    return '';
};

// Aplana <option>, <optgroup> y fragmentos/arrays en una lista de opciones con su grupo
function leerOpciones(children, grupo = null, salida = []) {
    Children.forEach(children, (hijo) => {
        if (!isValidElement(hijo)) return;
        if (hijo.type === 'option') {
            const etiqueta = textoDe(hijo.props.children);
            salida.push({
                value: String(hijo.props.value ?? etiqueta),
                etiqueta,
                disabled: Boolean(hijo.props.disabled),
                grupo,
            });
        } else if (hijo.type === 'optgroup') {
            leerOpciones(hijo.props.children, hijo.props.label, salida);
        } else {
            leerOpciones(hijo.props.children, grupo, salida);
        }
    });
    return salida;
}

export default function SelectBuscable({
    value,
    onChange,
    name,
    disabled = false,
    required = false,
    className = '',
    title,
    id,
    'aria-label': ariaLabel, // 06/11/2026: nombre para lectores de pantalla cuando no hay <label>
    // 18/11/2026 (grilla de compras), opcionales; por defecto todo sigue igual en el resto del sistema:
    abrirAlEnfocar = true, // false: llegar con Tab no abre la lista (se abre al escribir, con ↓ o con clic)
    tabElige = false,      // true: Tab elige la opción marcada si se escribió algo; sin resultados, Tab no avanza
    inputProps,            // atributos extra para el input (ej. data-copiar de la grilla)
    children,
}) {
    const opciones = useMemo(() => leerOpciones(children), [children]);
    const valor = String(value ?? '');
    const seleccionada = opciones.find((o) => o.value === valor);
    // La opción vacía ("SELECCIONAR...", "—") se muestra como texto guía, no como valor
    const textoGuia = opciones.find((o) => o.value === '')?.etiqueta || 'Seleccionar...';

    const [abierto, setAbierto] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [activo, setActivo] = useState(-1);
    const [pos, setPos] = useState(null);
    const cajaRef = useRef(null);
    const inputRef = useRef(null);
    const listaRef = useRef(null);

    const filtradas = useMemo(() => {
        const q = sinPuntos(busqueda);
        if (!q) return opciones;
        // 18/11/2026: por palabras y ordenadas por parecido (el grupo se respeta: primero el puntaje, luego el orden original)
        const palabras = q.split(' ');
        return opciones
            .map((o, i) => ({ o, i, p: o.value === '' ? -1 : puntaje(o.etiqueta, q, palabras) }))
            .filter((x) => x.p >= 0)
            .sort((a, b) => a.p - b.p || a.i - b.i)
            .map((x) => x.o);
    }, [opciones, busqueda]);

    const ubicar = () => {
        const r = cajaRef.current?.getBoundingClientRect();
        if (!r) return;
        const abajo = window.innerHeight - r.bottom;
        const haciaArriba = abajo < 260 && r.top > abajo;
        setPos({
            left: r.left,
            width: Math.max(r.width, 200),
            top: haciaArriba ? undefined : r.bottom + 4,
            bottom: haciaArriba ? window.innerHeight - r.top + 4 : undefined,
            alto: Math.min(288, (haciaArriba ? r.top : abajo) - 12),
        });
    };

    const abrir = (texto = '') => {
        if (disabled || abierto) return;
        ubicar();
        setBusqueda(texto);
        setActivo(Math.max(0, opciones.findIndex((o) => o.value === valor)));
        setAbierto(true);
    };

    const cerrar = () => {
        setAbierto(false);
        setBusqueda('');
    };

    const elegir = (op) => {
        if (!op || op.disabled) return;
        cerrar();
        if (op.value !== valor) onChange?.({ target: { name, value: op.value }, currentTarget: { name, value: op.value } });
    };

    // Sigue a la caja si la página o el modal hacen scroll; cierra al hacer clic afuera
    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => {
            if (cajaRef.current?.contains(e.target) || listaRef.current?.contains(e.target)) return;
            cerrar();
        };
        const mover = (e) => {
            if (listaRef.current?.contains(e.target)) return;
            ubicar();
        };
        document.addEventListener('mousedown', fuera);
        window.addEventListener('scroll', mover, true);
        window.addEventListener('resize', ubicar);
        return () => {
            document.removeEventListener('mousedown', fuera);
            window.removeEventListener('scroll', mover, true);
            window.removeEventListener('resize', ubicar);
        };
    }, [abierto]);

    // Mantiene visible la opción marcada con el teclado
    useLayoutEffect(() => {
        if (!abierto || activo < 0) return;
        listaRef.current?.querySelector(`[data-i="${activo}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [activo, abierto]);

    const siguienteHabilitada = (desde, paso) => {
        for (let i = desde + paso; i >= 0 && i < filtradas.length; i += paso) {
            if (!filtradas[i].disabled) return i;
        }
        return desde;
    };

    const teclado = (e) => {
        if (disabled) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!abierto) { abrir(); return; }
            setActivo((a) => siguienteHabilitada(a, e.key === 'ArrowDown' ? 1 : -1));
        } else if (e.key === 'Enter') {
            e.preventDefault(); // no enviar el formulario
            if (abierto) elegir(filtradas[activo]);
            else abrir();
        } else if (e.key === 'Escape') {
            if (abierto) { e.stopPropagation(); cerrar(); }
        } else if (e.key === 'Tab') {
            // 18/11/2026: en la grilla, Tab confirma lo escrito (y no avanza si no hay coincidencia)
            if (tabElige && abierto && busqueda.trim()) {
                const op = filtradas[activo] && !filtradas[activo].disabled ? filtradas[activo] : filtradas.find((o) => !o.disabled);
                if (!op) { e.preventDefault(); return; }
                elegir(op);
                return;
            }
            cerrar();
        }
    };

    // Las clases pensadas para <select> (focus:, disabled:) se adaptan a la caja contenedora
    const clasesCaja = className
        .split(/\s+/)
        .filter(Boolean)
        .map((c) => {
            if (c.startsWith('focus:')) return c.replace('focus:', 'focus-within:');
            if (c.startsWith('disabled:')) return disabled ? c.slice('disabled:'.length) : '';
            return c;
        })
        .join(' ');

    return (
        <div
            ref={cajaRef}
            title={title}
            onMouseDown={(e) => {
                if (disabled || e.target === inputRef.current) return;
                e.preventDefault();
                inputRef.current?.focus();
                abrir();
            }}
            className={`relative inline-flex items-center min-w-0 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-text'} ${clasesCaja}`}
        >
            <input
                ref={inputRef}
                id={id}
                type="text"
                autoComplete="off"
                role="combobox"
                aria-label={ariaLabel}
                aria-expanded={abierto}
                disabled={disabled}
                value={abierto ? busqueda : (seleccionada && seleccionada.value !== '' ? seleccionada.etiqueta : '')}
                placeholder={abierto && seleccionada && seleccionada.value !== '' ? seleccionada.etiqueta : textoGuia}
                onChange={(e) => {
                    if (abierto) setBusqueda(e.target.value);
                    else {
                        // 18/11/2026: cerrado, el input muestra la opción elegida; si se escribe al final, se busca solo lo nuevo
                        const actual = seleccionada && seleccionada.value !== '' ? seleccionada.etiqueta : '';
                        const v = e.target.value;
                        abrir(actual && v.startsWith(actual) ? v.slice(actual.length) : v);
                    }
                    setActivo(0);
                }}
                {...inputProps}
                onFocus={() => abrirAlEnfocar && abrir()}
                onClick={() => abrir()}
                onKeyDown={teclado}
                className="w-full min-w-0 bg-transparent outline-none border-0 p-0 pr-5 text-inherit placeholder:text-gray-500 disabled:cursor-not-allowed truncate"
            />
            <ChevronDown size={16} className={`absolute right-2 pointer-events-none text-gray-500 transition-transform ${abierto ? 'rotate-180' : ''}`} />
            {/* Mantiene la validación "required" del formulario */}
            {required && (
                <input
                    tabIndex={-1}
                    aria-hidden="true"
                    required
                    value={valor}
                    onChange={() => {}}
                    onFocus={() => inputRef.current?.focus()}
                    className="absolute inset-x-0 bottom-0 h-px opacity-0 pointer-events-none"
                />
            )}

            {abierto && pos && createPortal(
                <ul
                    ref={listaRef}
                    role="listbox"
                    onMouseDown={(e) => e.preventDefault()}
                    style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.alto }}
                    className="z-[100] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl py-1 text-sm text-gray-800"
                >
                    {filtradas.length === 0 && <li className="px-3 py-2 text-gray-400 italic">Sin resultados</li>}
                    {filtradas.map((o, i) => {
                        // 18/11/2026: al buscar se ordena por parecido y los grupos se mezclan: el grupo va al lado de cada opción
                        const buscando = Boolean(busqueda.trim());
                        const titulo = !buscando && o.grupo && o.grupo !== filtradas[i - 1]?.grupo ? o.grupo : null;
                        return (
                            <li key={`${o.grupo ?? ''}-${o.value}-${i}`}>
                                {titulo && <div className="px-3 pt-2 pb-1 text-[11px] font-bold text-gray-400 uppercase tracking-wide">{titulo}</div>}
                                <div
                                    data-i={i}
                                    role="option"
                                    aria-selected={o.value === valor}
                                    aria-disabled={o.disabled}
                                    onMouseEnter={() => !o.disabled && setActivo(i)}
                                    onClick={() => elegir(o)}
                                    className={`px-3 py-1.5 ${o.grupo ? 'pl-5' : ''} ${o.disabled ? 'text-gray-400 cursor-not-allowed' : 'cursor-pointer'} ${i === activo && !o.disabled ? 'bg-indigo-50 text-indigo-700' : ''} ${o.value === valor ? 'font-semibold' : ''} ${o.value === '' ? 'text-gray-500' : ''}`}
                                >
                                    {o.etiqueta}
                                    {buscando && o.grupo && <span className="ml-2 text-[10px] font-semibold text-gray-400 uppercase">{o.grupo}</span>}
                                </div>
                            </li>
                        );
                    })}
                </ul>,
                document.body
            )}
        </div>
    );
}
