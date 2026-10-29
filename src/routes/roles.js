// Roles del sistema y pantalla de inicio de cada uno — src/routes/roles.js
// 29/10/2026: roles EXPORTACIONES y COMERCIAL. El backend (middleware rol:) es la protección
// real; esto solo ordena el menú y las rutas del frontend.
export const ROLES_INVENTARIO = ["ADMIN", "JEFE_BODEGA", "COORDINADOR_INVENTARIO"];
export const ROLES_EXPORTACIONES = ["ADMIN", "JEFE_BODEGA", "COORDINADOR_INVENTARIO", "EXPORTACIONES"];
export const ROLES_COMERCIAL = ["ADMIN", "COMERCIAL"];

// Adónde va cada rol al iniciar sesión (o si entra a una pantalla que no le corresponde)
export const inicioPorRol = (rol) => ({
  BODEGUERO: "/stock",
  EXPORTACIONES: "/exportaciones/pedidos",
  COMERCIAL: "/comercial/compras",
}[rol] || "/dashboard");
