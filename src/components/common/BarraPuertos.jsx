// Barra de botones para elegir el puerto de salida con un clic (16/11/2026, pedido de Peter).
// Ubicación: src/components/common/BarraPuertos.jsx
// Mismo estilo que CONTRATO | SPOT en Compra de fruta y CONVENCIONAL | PACKED en el pedido.
// Los puertos de SALIDA son pocos (GUAYAQUIL, PUERTO BOLÍVAR, PALLET SUR); si algún día pasan de MAX_BOTONES
// vuelve a la lista desplegable para que la celda no crezca sin límite.
// onChange recibe el id como texto (igual que e.target.value de un select).
import SelectBuscable from './SelectBuscable';

const MAX_BOTONES = 4;

export default function BarraPuertos({ puertos, value, onChange, disabled = false, ariaLabel = 'Puerto de salida', className = '' }) {
  if (puertos.length > MAX_BOTONES) {
    return (
      <SelectBuscable value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={className}>
        <option value="">SELECCIONAR...</option>
        {puertos.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
      </SelectBuscable>
    );
  }
  if (puertos.length === 0) return <span className="text-xs text-gray-400">SIN PUERTOS DE SALIDA</span>;
  return (
    <div className="inline-flex rounded-lg border border-primario/30 overflow-hidden text-xs font-semibold" role="group" aria-label={ariaLabel}>
      {puertos.map((p) => {
        const elegido = String(p.id) === String(value);
        return (
          <button key={p.id} type="button" disabled={disabled} onClick={() => !elegido && onChange(String(p.id))}
            aria-pressed={elegido}
            className={`px-2.5 py-2 whitespace-nowrap ${elegido ? 'bg-primario text-white' : 'bg-white text-primario hover:bg-primario-claro'} disabled:opacity-60`}>
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
