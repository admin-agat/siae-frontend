// Teléfono (04/11/2026): solo dígitos y espacios, con + solo al inicio (números del exterior)
export const soloTelefono = (valor) => String(valor ?? '').replace(/[^\d+\s]/g, '').replace(/(?!^)\+/g, '');
