# SIAE — reglas del proyecto

ERP de exportación bananera de AGAT-ECUAGREEN. Estas reglas valen para la sesión principal y para todos los agentes de `.claude/agents/`.
Respuestas y textos de pantalla en **español de Ecuador** con tú ("Selecciona", "Elige"; nunca "Seleccioná").

## Proyecto
- Backend: `C:\Users\AGAT-ECU-ADM\siae-backend` (Laravel 12, PHP 8.2+, PostgreSQL: 16 en producción y 15 en local, esquema `public`, tablas en inglés).
- Frontend: `C:\Users\AGAT-ECU-ADM\siae-frontend` (React 19 + Vite + Tailwind v4: el tema va en `@theme` dentro de `src/index.css`).
- Bases locales:
  - `SIAE`: desarrollo.
  - `siae_test`: pruebas. Tiene solo la estructura y la usa `phpunit.xml`.
- **`DESARROLLO.md`** guarda las decisiones de negocio y el historial de cambios. Léelo antes de diseñar o programar, y agrega una entrada en la sección 7 con cada cambio.

## Equipo y flujo
| Rol | Quién | Modelo / esfuerzo |
|---|---|---|
| Arquitecto / base de datos | agente `siae-architect` | Opus · medio |
| Desarrollador | sesión principal | Opus · medio |
| Calidad (pruebas + revisión) | agente `siae-qa` | Sonnet · medio |
| Datos (cruces y cargas) | agente `siae-datos` | Sonnet · medio |

```
Cambio grande:  architect diseña → PETER APRUEBA → desarrollador programa → qa prueba y revisa → PETER dice "lo de siempre" → respaldo + producción
Cambio chico:   desarrollador programa → qa prueba y revisa → PETER dice "lo de siempre" → respaldo + producción
Datos:          siae-datos cruza y prepara script → simulación → PETER APRUEBA → respaldo → real
```
- Cambio grande: tablas nuevas, liquidación, contratos, pagos o permisos.
- Los agentes solo se usan cuando Peter lo pide.
- **Antes de hacer cualquier cambio, se le avisa a Peter y se espera su OK.**

## Límites (no negociables)
- **Commit, push y producción solo cuando Peter lo pide en ese momento.** "Lo de siempre" significa commit + respaldo + producción.
- **Siempre se respalda antes de subir:** la base, el `dist` del frontend y los `.env`.
- No se leen, copian ni versionan archivos `.env`. Nunca se escriben contraseñas, tokens ni claves de API en el código o el chat; Peter las escribe directamente.
- No van en los commits:
  - Backend: `.env.example`, `config/services.php`, `app/Console/Commands/ContificoExplorar.php`, `app/Services/ContificoClient.php` (Contífico, en pausa).
  - Frontend: los cambios de espacios de Peter en `src/routes/AppRouter.jsx`, `src/routes/menu.js` y `src/pages/exportaciones/PortsMasterDetailPage.jsx`.
- No se toca CHAUNE, que vive en el mismo servidor.
- Si un permiso o el clasificador bloquea una acción, no se le da la vuelta: se le avisa a Peter.

## Datos sensibles
- RUC, cédulas, cuentas bancarias, sueldos y montos de liquidación no se pegan en el chat ni en el código. Se enmascaran los números de 5 o más dígitos (`#####`).
- Las cuentas bancarias solo las ven Contabilidad y ADMIN, y la hoja CUENTAS BANCARIAS no se lee.
- Los Excel nunca se abren con Excel (COM): se copian a la carpeta temporal y se lee su XML.
- Las copias locales de datos de producción se borran al terminar.
- No se consulta el SRI de forma automática ni se saltan captchas.

## Reglas de código
1. **Mayúsculas exactas** en nombres de archivo e imports: Linux las distingue y Windows no. Verifica con Glob que el archivo existe con ese nombre.
2. **No mezcles archivos de nombre parecido**, como `SupplyModal.jsx` y `SupplyCategoryModal.jsx`. Lee el archivo antes de editarlo.
3. **Cambios puntuales**: edita solo lo necesario, imita el estilo del código vecino y no crees archivos sin necesidad. Cada bloque nuevo lleva un comentario con fecha (`// 11/11/2026: ...`) que explique el porqué.
4. **Todo cambio de esquema va en una migración**, por pequeño que sea. Nunca en pgAdmin, porque lo que no está en una migración no llega a producción. Actualiza también `$fillable` y `$casts`.
5. **Soft-delete**: `deactivate()`/`reactivate()` con la columna `status` y rutas PATCH. Nunca `destroy()` ni DELETE.
6. **Bitácora**: los modelos usan el trait `App\Models\Concerns\Auditable`. Los cambios masivos se hacen modelo por modelo para que queden registrados.
7. **Permisos**:
   - Cada usuario tiene un perfil con un tipo base (`Profile::TIPOS_BASE`), pantallas (`config/pantallas.php`) y excepciones por persona.
   - Las rutas se protegen con el middleware `pantalla:<clave>`, y **el backend valida siempre**; ocultar algo en el frontend no basta.
   - BODEGUERO solo ve su bodega.
8. **Validaciones** con mensajes en MAYÚSCULAS que digan qué corregir.
9. **Cambios de datos en producción**: con un script que exija `CARGA_BD`, tenga simulación (`CARGA_SIMULAR=1`) y use los mismos endpoints de la pantalla. Primero simulación, luego respaldo y luego real.

## Estándar de UI
- Inputs `bg-gray-100 rounded-2xl`. Los datos van en MAYÚSCULAS, convertidos al escribir.
- Botones "+ Nuevo/a" y "Guardar" verdes; "Cancelar" rojo con texto blanco.
- Componentes de `src/components/common/`: `ModalShell`, `DialogoConfirmacion` (nunca `confirm()`), `TablaEstandar`, `SelectBuscable`, `CampoNumero`, `EstadoBadge`, `AccionesFila`, `EncabezadoPagina`.
- Toasts con `src/utils/toastMessages.js`. Formatos y semanas con `src/utils/` (`formato.js`, `fecha.js`, `semana.js`, `modalidades.js`).
- Icono `Ban` para desactivar; `Trash2` solo para quitar una fila de un formulario que todavía no se guarda.
- Rutas de import: desde `src/pages/<modulo>/` → `../../api/...`; desde `src/components/` → `../api/...`.

## Antes de entregar un cambio
1. `npm run build` sin errores, y `php -l` en cada PHP cambiado.
2. Migraciones aplicadas solo en local: `SIAE` y `siae_test`.
3. Entrada en `DESARROLLO.md`.
4. Resumen para Peter: qué cambió, qué migraciones hay y qué debe probar en pantalla.
