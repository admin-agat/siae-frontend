# Blindaje del servidor de producción (17/11/2026)

Servidor: VPS Hostinger `72.62.97.139`, Ubuntu 24.04.4 LTS, kernel 6.8.0-147, encendido hace 31 días.
Aloja **SIAE** (`siae.datalytica.cloud`), **CHAUNE** (`chaune.datalytica.cloud`) y el sitio `datalytica.cloud`.

La revisión se hizo **solo con lectura**, como `peter` y sin `sudo`. No se leyó ningún `.env`, ninguna llave privada ni ninguna configuración de CHAUNE. Lo que pide `sudo` está en la sección 5 y en el paso 0 del script.

Script para Peter: `docs/seguridad/blindaje-servidor.sh`.

---

## 1. Estado actual

### Lo que está bien
| Tema | Estado |
|---|---|
| Login de root por SSH | `PermitRootLogin no` |
| Modo de Laravel | `APP_ENV=production`, **Debug OFF** y sin mantenimiento (`artisan about`) |
| PHP-FPM | `expose_php = Off` y `display_errors = Off` en el `php.ini` de FPM. PHP 8.3.6 |
| `.env` del backend | `peter:www-data 640` |
| Raíz web | El frontend sirve `frontend/dist`; `/api` va a `backend/public` con alias, no a la carpeta del proyecto |
| Archivos ocultos | `/.env`, `/.git/config`, `/api/.env`, `/api/../.env` y `/api../.env` responden **403** (comprobado desde fuera) |
| TLS | Solo TLS 1.2 y 1.3 en SIAE (TLS 1.0/1.1 rechazados) con los cifrados de Certbot; http→https con 301 |
| PostgreSQL desde internet | El puerto 5432 se ve **filtrado** desde fuera |
| Actualizaciones automáticas | `unattended-upgrades` instalado y activo (orígenes `-security` incluidos) |
| Respaldos | Diarios a las 02:00 y correctos (último: 17/11 02:00, 256 KB); `~/respaldos` con permisos 700 y archivos 600 |
| Límites en Laravel | `throttle:login` (5/min por usuario+IP, 30 por IP), `throttle:120,1` en la API, tokens Sanctum de 12 h, CORS limitado al dominio |
| Malware | Hostinger tiene activos `monarx-agent` y la extensión `monarxprotect` de PHP |
| Docker | Instalado y activo, pero sin contenedores corriendo (solo `hello-world` detenido) |

### Lo que falta o está débil
| Tema | Hallazgo |
|---|---|
| **SSH con contraseña** | El `sshd_config` y `60-cloudimg-settings.conf` dicen `PasswordAuthentication no`, pero **`50-cloud-init.conf` se lee antes** y sshd usa el primer valor que encuentra. Ese archivo no se puede leer sin sudo. Pesa **27 bytes**, el tamaño exacto de `PasswordAuthentication yes` + salto de línea. Es muy probable que **hoy se pueda entrar con contraseña**. Verificar con `sudo sshd -T \| grep -i passwordauth`. |
| fail2ban | **No está instalado**: no hay freno a quien prueba contraseñas por SSH ni a los escáneres web |
| PostgreSQL | `listen_addresses = '*'`: escucha en `0.0.0.0` y `[::]`. Lo protege solo el firewall, y `pg_hba.conf` no se pudo leer |
| Reinicio pendiente | `/var/run/reboot-required` por el kernel 6.8.0-149 y `libc6`; hay **41 paquetes** por actualizar. Ninguno es de openssh, nginx, php, postgresql ni libssl |
| nginx | `server_tokens` está comentado y publica `nginx/1.24.0 (Ubuntu)` |
| Cabeceras | **Ninguna** cabecera de seguridad (HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy) |
| Límite de peticiones | No hay `limit_req` en nginx; solo existe el de Laravel |
| `/assets/*.js` faltante | Devuelve `index.html` con **200**. Ya era conocido |
| Escaneos | `/wp-login.php` y cualquier ruta inventada devuelven 200 (index.html): no hay forma de distinguir ni de banear escáneres |
| Logs | SIAE, CHAUNE y datalytica comparten `access.log`/`error.log`: no se puede vigilar solo a SIAE |
| Acceso por IP | `https://72.62.97.139` responde 200 con otro sitio, porque no hay un servidor por defecto que rechace |
| SSH | `X11Forwarding yes`; no hay `MaxAuthTries` ni `LoginGraceTime` explícitos |
| `nginx.conf` global | Declara `ssl_protocols TLSv1 TLSv1.1 ...`. SIAE lo anula con el include de Certbot; no lo tocamos por CHAUNE |
| Copia externa | Los respaldos **solo existen en el mismo servidor** (B2/MEGA pendiente) |
| Usuario peter | Está en los grupos `sudo` y `docker` (docker equivale a root). Es aceptable porque ya tiene sudo, pero conviene sacarlo de `docker` si no se usa |
| `~/bin` | Permisos 775; mejor 750 |

---

## 2. Riesgos por severidad

| # | Severidad | Riesgo | Medida (paso del script) |
|---|---|---|---|
| 1 | **ALTA** | SSH probablemente acepta contraseña y no hay fail2ban: se pueden probar contraseñas sin límite. Si adivinan la de `peter`, que tiene sudo, tienen el servidor completo, con SIAE y CHAUNE | fail2ban `sshd` (6), `MaxAuthTries 4` (5); **luego** desactivar la contraseña (5b, opcional, tras confirmar la llave) |
| 2 | **ALTA** | Reinicio y 41 actualizaciones pendientes (kernel y libc6) | Manual, fuera de horario (final del script) |
| 3 | **ALTA** | Una sola copia de los respaldos, dentro del mismo servidor: si atacan el servidor, se pierden la base y los respaldos | Copia externa (B2/rclone); Peter decide. No va en este script |
| 4 | MEDIA | PostgreSQL escucha en todas las interfaces y depende de una sola capa (firewall), con `pg_hba` sin revisar | ufw sin 5432 (1); `listen_addresses='localhost'` (8, opcional, reinicia PG) |
| 5 | MEDIA | Sin límite de peticiones en nginx ni baneo de escáneres: un ataque de fuerza bruta o de volumen pega directo a PHP-FPM, que comparte pool con CHAUNE si este es PHP | `limit_req` (3 y 4), fail2ban nginx (6) |
| 6 | MEDIA | Sin cabeceras de seguridad (clickjacking, MIME sniffing, sin HSTS) | Snippet de cabeceras (3 y 4); la CSP queda comentada |
| 7 | BAJA | La versión de nginx es visible; `/assets` y las rutas de escaneo responden 200 | `server_tokens off`, 404 reales (3 y 4) |
| 8 | BAJA | Acceso por IP directa sirve otro sitio | Servidor por defecto que rechaza (9, opcional) |
| 9 | BAJA | `X11Forwarding yes`, `~/bin` 775 | Pasos 5 y 7 |

---

## 3. Señales de ataque en curso

**No se pudo confirmar sin sudo.** `/var/log/nginx/*.log` es `www-data:adm 640`, `/var/log/auth.log` es `syslog:adm 640` y `peter` no está en `adm`. Tampoco se pueden leer `lastb` ni `journalctl` del sistema.

Indicios indirectos:
- `access.log` va en **~900 KB en 19 h**, igual que el día anterior. Los días previos, comprimidos, pesaban 5 a 67 KB, que serían unos 50 a 700 KB sin comprimir. Hay más tráfico que antes, pero el log es compartido con CHAUNE y datalytica, así que no es concluyente.
- No hay conexiones externas establecidas a PostgreSQL.
- Los últimos ingresos SSH exitosos son todos de `peter`, desde dos redes de Ecuador (`190.63.x.x` y `190.155.x.x`): nada extraño.

Para saberlo, Peter puede correr lo siguiente. Solo son lecturas y muestran conteos.

```bash
# Intentos SSH fallidos en las últimas 24 h y top 10 de IPs
sudo journalctl -u ssh --since "24 hours ago" --no-pager | grep -cE "Failed password|Invalid user"
sudo journalctl -u ssh --since "24 hours ago" --no-pager | grep -oE "from [0-9.]+" | sort | uniq -c | sort -rn | head
# Respuestas 4xx de hoy en nginx (log compartido) y rutas de escaneo
sudo awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head
sudo grep -cE '"(GET|POST) /(\.env|\.git|wp-login|wp-admin|phpmyadmin|xmlrpc)' /var/log/nginx/access.log
sudo awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head
```

---

## 4. Plan (orden recomendado)

| Orden | Qué | Quién / cuándo | Afecta a CHAUNE |
|---|---|---|---|
| 1 | Correr las lecturas de la sección 3 y `sudo sshd -T \| grep -i passwordauth` | Peter, ahora | No |
| 2 | Llenar `IGNORAR_IPS` en el script con la IP pública de la oficina (`curl -s https://ifconfig.me` desde la oficina) | Peter | No |
| 3 | `sudo bash ~/bin/blindaje-servidor.sh` con los opcionales en 0: firewall, actualizaciones automáticas, nginx SIAE, SSH, fail2ban y permisos | Peter, ahora (no corta el servicio; nginx y ssh solo se recargan) | Ver tabla de abajo |
| 4 | Probar SIAE (login y 3 pantallas), CHAUNE y entrar por SSH desde **otra** terminal | Peter | Comprobar |
| 5 | Confirmar que entra con llave desde todas sus PCs y luego correr de nuevo con `DESACTIVAR_CLAVE_SSH=1` | Peter | No, salvo que alguien de CHAUNE entre por SSH con contraseña: **preguntar antes** |
| 6 | Fuera de horario: `apt upgrade` + `reboot`, con respaldo antes | Peter | Sí: CHAUNE queda caído 1 a 2 minutos |
| 7 | En la misma ventana: `POSTGRES_SOLO_LOCAL=1` | Peter | Sí, si CHAUNE usa PostgreSQL (unos segundos) |
| 8 | Copia externa de respaldos (B2 o MEGA con rclone, cifrada) | Decisión de Peter | No |
| 9 | CSP: activar la que proponga el otro análisis, primero en modo `Report-Only` | Siguiente fase | No |
| 10 | Pool de PHP-FPM propio para SIAE (usuario aparte, `open_basedir`) para aislarlo de CHAUNE | Fase posterior, cambio grande | Requiere coordinación |

### Efecto de cada medida global sobre CHAUNE
| Medida | Alcance | Efecto en CHAUNE |
|---|---|---|
| ufw: permitir 22/80/443 y denegar el resto | Todo el servidor | Ninguno: CHAUNE solo usa 80/443 vía nginx; los únicos puertos públicos son 22, 80, 443 y 5432. Si CHAUNE necesitara PostgreSQL desde fuera, el script pregunta antes de quitar la regla 5432 |
| `server_tokens off` | Todos los sitios | Solo oculta la versión de nginx |
| Zonas `limit_req` y `map` con nombre `siae_*` | Declaradas en `http{}` | Ninguno: solo las usa el server de SIAE |
| fail2ban | Banea IPs en todo el servidor | Solo cuenta fallos de SSH y de los **logs propios de SIAE** (`siae.access.log`/`siae.error.log`), que el script crea. Una IP baneada por atacar SIAE tampoco llega a CHAUNE, lo cual es deseable |
| HSTS | Solo `siae.datalytica.cloud` | Ninguno: va **sin** `includeSubDomains` |
| SSH (`10-siae-blindaje.conf`) | Todo el servidor | Solo si alguien de CHAUNE entra por SSH con contraseña o usa reenvío X11 o de agente |
| unattended-upgrades | Todo el servidor | Ya estaba activo; se fija explícitamente **sin reinicio automático** |
| Servidor por defecto que rechaza (opcional) | Peticiones sin dominio válido | Solo si CHAUNE se usa por IP directa |

No se edita `nginx.conf`: `server_tokens` va en `conf.d/siae-seguridad.conf`. Tampoco se tocan `php.ini`, `chaune.datalytica.cloud`, `datalytica.cloud` ni `snippets/chaune-security.conf`.

---

## 5. Lo que debe revisar Peter con sudo

1. `sudo sshd -T | grep -Ei 'passwordauth|permitroot|maxauthtries'`: valores efectivos de SSH, incluido `50-cloud-init.conf`.
2. `sudo ufw status verbose`: reglas actuales. ¿Hay alguna que permita 5432 u otro puerto?
3. `sudo grep -Ev '^\s*(#|$)' /etc/postgresql/16/main/pg_hba.conf`: no debería haber líneas `host ... 0.0.0.0/0` ni `trust`.
4. `sudo certbot certificates`: vencimiento del certificado de SIAE. La renovación automática existe (`/etc/cron.d/certbot`).
5. `sudo tail -20 /var/log/unattended-upgrades/unattended-upgrades.log`: que sí esté instalando parches.
6. Las lecturas de ataque de la sección 3.
7. Si Docker no se usa: `sudo gpasswd -d peter docker` y `sudo systemctl disable --now docker docker.socket`. Antes, confirmar que CHAUNE no lo usa.

---

## 6. Qué hace el script (`blindaje-servidor.sh`)

Todo va por pasos comentados. Cada archivo se respalda como `archivo.bak-AAAAMMDD_HHMM` antes de tocarlo. Si `nginx -t` falla, el script restaura lo que cambió y no recarga; con `sshd -t` hace lo mismo. Se puede correr dos veces sin duplicar nada.

| Paso | Acción |
|---|---|
| 0 | Muestra la configuración SSH efectiva, el ufw, el `pg_hba` y las huellas de las llaves de peter, y pide confirmación |
| 1 | ufw: **primero permite 22**, después 80 y 443; deniega la entrada por defecto. Pregunta antes de quitar un ALLOW de 5432. No hace `ufw reset` |
| 2 | unattended-upgrades de seguridad, sin reinicio automático |
| 3 | `conf.d/siae-seguridad.conf` (`server_tokens off` y las zonas `siae_login` 30/min y `siae_api` 30/s) y `snippets/siae-cabeceras.conf` |
| 4 | Sitio SIAE: logs propios, cabeceras (repetidas en `/index.html`), `limit_req` en `/api` con respuesta 429, `/assets/` faltante → 404, rutas de escaneo y `.php/.sql/.bak` fuera de `/api` → 404. Solo escribe si la huella del archivo es la del 17/11; si alguien lo cambió, se detiene |
| 5 | `sshd_config.d/10-siae-blindaje.conf`: `MaxAuthTries 4`, `LoginGraceTime 30`, sin X11 ni reenvío de agente, keepalive. La contraseña **solo** se desactiva con `DESACTIVAR_CLAVE_SSH=1` y una confirmación |
| 6 | fail2ban: `sshd`, `nginx-limit-req`, `nginx-botsearch` y el filtro propio `siae-escaneo` (pedir `.env`, `.git`, etc. → 24 h). Ignora `IGNORAR_IPS` |
| 7 | `.env` 640, respaldos 700/600, `~/bin` 750. **No** quita la lectura a "otros" en `storage/`, para no repetir el incidente del 09/11 (php-fpm sin poder leer → API 500) |
| 8 | Opcional: PostgreSQL solo en localhost (reinicia PG) |
| 9 | Opcional: servidor por defecto con `return 444` y `ssl_reject_handshake` |
| 10 | Comprobación: cabeceras y códigos esperados (`/` 200, `/.env` 403, `/assets/noexiste.js` 404, `/wp-login.php` 404, `GET /api/login` 405) |

Al final del script hay instrucciones para deshacer cada paso.

### Advertencias
- **No cierres la sesión SSH** mientras corre el script. Al terminar, entra desde otra terminal para comprobar.
- El paso 5b (sin contraseña) puede dejarte fuera si la llave no funciona. Si pasa, el único camino es la consola web de Hostinger.
- `limit_req` está calibrado para una oficina que sale por una sola IP: login 30/min con ráfaga de 20, API 30/s con ráfaga de 100. Si alguien ve "429", hay que subir los valores en `conf.d/siae-seguridad.conf`.
- Después del paso 4, un usuario con una pestaña muy vieja abierta puede ver un error al cargar un `.js` que ya no existe, en lugar de una pantalla en blanco. El arreglo de "recarga si falta un archivo nuevo" ya existe en el frontend.

---

## 7. Preguntas abiertas para Peter
1. ¿Alguien entra por SSH con contraseña, por ejemplo para desplegar CHAUNE? Define si se puede hacer el paso 5b y poner `AllowUsers peter`.
2. ¿CHAUNE usa PostgreSQL de este servidor? ¿Alguien se conecta a la base desde fuera, con pgAdmin remoto? Define el paso 8.
3. ¿CHAUNE o algún sistema entra por la IP directa en lugar del dominio? Define el paso 9.
4. ¿Cuál es la IP pública fija de la oficina, si tiene una, para `IGNORAR_IPS`?
5. ¿Cuándo hay una ventana fuera de horario para el `apt upgrade` y el reinicio (CHAUNE se cae 1 a 2 minutos)?
6. Copia externa de respaldos: ¿B2 o MEGA? Hoy los respaldos solo viven en el mismo servidor.
