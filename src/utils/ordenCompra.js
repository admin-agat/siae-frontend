// Cálculos y estado de una orden de compra — 05/11/2026 (OC por departamento y Contabilidad).
// Mismo orden de cálculo que el backend (PurchaseOrderLine.php):
//   subtotal = cantidad × precio − descuento · IVA y retención IR sobre el subtotal · total = subtotal + IVA − retención

export function calcularLinea(linea) {
    const cantidad = parseFloat(linea.quantity_ordered) || 0;
    const precio = parseFloat(linea.unit_price) || 0;
    const bruto = cantidad * precio;
    const subtotal = bruto - bruto * ((parseFloat(linea.discount_percent) || 0) / 100);
    const iva = subtotal * ((parseFloat(linea.tax_rate) || 0) / 100);
    const retencion = subtotal * ((parseFloat(linea.retention_rate) || 0) / 100);
    return { subtotal, iva, retencion, total: subtotal + iva - retencion };
}

export function totalesOC(lineas) {
    return lineas.map(calcularLinea).reduce(
        (t, c) => ({ subtotal: t.subtotal + c.subtotal, iva: t.iva + c.iva, retencion: t.retencion + c.retencion, total: t.total + c.total }),
        { subtotal: 0, iva: 0, retencion: 0, total: 0 },
    );
}

// Estado que ve la gente: cancelada > pagada > en el banco > aprobación
export function estadoOC(o) {
    if (o.status === 'CANCELADA') return { clave: 'CANCELADA', texto: 'CANCELADA', clase: 'bg-gray-200 text-gray-700' };
    if (o.payment_status === 'PAGADA') return { clave: 'PAGADA', texto: 'PAGADA', clase: 'bg-green-100 text-green-700' };
    if (o.payment_status === 'EN_BANCO') return { clave: 'EN_BANCO', texto: 'EN EL BANCO', clase: 'bg-indigo-100 text-indigo-700' };
    return {
        POR_APROBAR: { clave: 'POR_APROBAR', texto: 'POR APROBAR', clase: 'bg-amber-100 text-amber-800' },
        APROBADA: { clave: 'APROBADA', texto: 'APROBADA', clase: 'bg-blue-100 text-blue-700' },
        RECHAZADA: { clave: 'RECHAZADA', texto: 'RECHAZADA', clase: 'bg-red-100 text-red-700' },
        ANTERIOR: { clave: 'ANTERIOR', texto: 'ANTERIOR', clase: 'bg-gray-100 text-gray-600' },
    }[o.approval_status] || { clave: o.approval_status, texto: o.approval_status, clase: 'bg-gray-100 text-gray-600' };
}

export const fechaVer = (f) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—');
