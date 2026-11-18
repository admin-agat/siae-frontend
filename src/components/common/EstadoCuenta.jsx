// EstadoCuenta.jsx — 18/11/2026 (Peter): estado de una cuenta bancaria de tercero.
// PENDIENTE (ámbar) hasta que Contabilidad la revise; VERIFICADA (verde) después. Si se cambia, vuelve a PENDIENTE.
// Se usa en Contabilidad → Cuentas bancarias, Retención de productores, Liquidar y el detalle de la liquidación.
export default function EstadoCuenta({ verificada }) {
    return verificada ? (
        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap bg-green-100 text-green-700">VERIFICADA</span>
    ) : (
        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap bg-amber-100 text-amber-800">PENDIENTE</span>
    );
}
