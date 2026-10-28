// Badge estándar de ESTADO para TODAS las tablas del SIAE.
// Ubicación: src/components/common/EstadoBadge.jsx  (junto a ModalShell, AccionesFila y EncabezadoPagina)
//
// Estándar (27/10/2026):
//   - ACTIVO   → verde claro (bg-green-100 / text-green-700)
//   - INACTIVO → rojo claro  (bg-red-100 / text-red-700)
//   - Texto en MAYÚSCULAS (política de datos del SIAE)
//   Verde/rojo aquí es semántico (activo = bien, inactivo = apagado), no color de marca.
//
// Uso en cualquier página (dentro del <td> de ESTADO):
//   <EstadoBadge activo={t.status} />
//
// Si una tabla necesita otros textos (ej. VIGENTE / VENCIDO en contratos),
// se pueden pasar: <EstadoBadge activo={vigente} textoActivo="VIGENTE" textoInactivo="VENCIDO" />
// Las clases están escritas COMPLETAS (Tailwind v4 no genera clases armadas con variables).

export default function EstadoBadge({ activo, textoActivo = 'ACTIVO', textoInactivo = 'INACTIVO' }) {
    return (
        <span
            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                activo
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
            }`}
        >
            {activo ? textoActivo : textoInactivo}
        </span>
    );
}