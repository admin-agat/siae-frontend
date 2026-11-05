// Campo numérico del SIAE (04/11/2026). Reemplaza a <input type="number">, que en Chrome deja escribir
// e, E, + y -, en Firefox cualquier letra, entrega '' cuando el texto no es número (y se guardaba 0 sin
// avisar) y cambia el valor con la rueda del mouse o las flechas.
// Este solo deja dígitos y, si decimales > 0, un separador decimal (la coma se escribe como punto) con
// hasta `decimales` cifras. Sin negativos. Al pegar limpia el texto: "$ 1.234,50" → 1234.50.
// Se usa como un <input>: value, onChange(e) con e.target.name/value, name, disabled, readOnly,
// placeholder, title, className... `max` (opcional): no deja escribir un número mayor.
import { forwardRef } from 'react';

// Texto pegado (puede venir de Excel o de un correo): el último separador es el decimal y los demás son
// de miles ("1.234,50" y "1,234.50" → 1234.50); un solo separador con 3 cifras detrás es de miles
// ("1.200" → 1200) salvo que el campo acepte 3 o más decimales.
const limpiarPegado = (texto, decimales) => {
    const t = String(texto).replace(/[^\d.,]/g, '');
    const separadores = t.replace(/\d/g, '');
    const soloDigitos = t.replace(/[.,]/g, '');
    if (!separadores || decimales === 0) return soloDigitos;
    const ultimo = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));
    const fraccion = t.slice(ultimo + 1);
    const unSoloTipo = new Set(separadores).size === 1;
    // "1.234.567" (el mismo separador varias veces) o "1.200" → miles
    if (unSoloTipo && (separadores.length > 1 || (fraccion.length === 3 && decimales < 3))) return soloDigitos;
    return `${t.slice(0, ultimo).replace(/[.,]/g, '')}.${fraccion}`;
};

const CampoNumero = forwardRef(function CampoNumero(
    { value, onChange, name, decimales = 2, max, className = '', ...resto },
    ref,
) {
    const valido = (v) => {
        const patron = decimales > 0 ? new RegExp(`^\\d*(\\.\\d{0,${decimales}})?$`) : /^\d*$/;
        if (!patron.test(v)) return false;
        return max === undefined || max === null || max === '' || v === '' || Number(v) <= Number(max);
    };

    const emitir = (v) => onChange?.({ target: { name, value: v, type: 'text' }, currentTarget: { name, value: v } });

    const alEscribir = (e) => {
        let v = e.target.value.replace(/,/g, '.').replace(/\s/g, '');
        if (v.startsWith('.')) v = `0${v}`;
        // Borrar siempre se deja (un valor guardado puede traer más decimales, ej. "5.0000")
        const borrando = v.length < String(value ?? '').length && /^\d*\.?\d*$/.test(v);
        if (valido(v) || borrando) emitir(v);
    };

    const alPegar = (e) => {
        e.preventDefault();
        const campo = e.currentTarget;
        const actual = String(value ?? '');
        const inicio = campo.selectionStart ?? actual.length;
        const fin = campo.selectionEnd ?? actual.length;
        let v = actual.slice(0, inicio) + limpiarPegado(e.clipboardData.getData('text'), decimales) + actual.slice(fin);
        if (v.startsWith('.')) v = `0${v}`;
        // Si pega más decimales de los permitidos, se recortan (no se pierde todo lo pegado)
        const punto = v.indexOf('.');
        if (punto >= 0 && decimales > 0) v = v.slice(0, punto + 1 + decimales);
        if (valido(v)) emitir(v);
    };

    return (
        <input
            ref={ref}
            type="text"
            inputMode={decimales > 0 ? 'decimal' : 'numeric'}
            autoComplete="off"
            name={name}
            value={value ?? ''}
            onChange={alEscribir}
            onPaste={alPegar}
            className={className}
            {...resto}
        />
    );
});

export default CampoNumero;
