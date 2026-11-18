#!/usr/bin/env bash
# =============================================================================
# BLINDAJE DEL SERVIDOR SIAE  (17/11/2026)
# -----------------------------------------------------------------------------
# Lo ejecuta PETER en su terminal, en el servidor 72.62.97.139:
#
#     scp docs/seguridad/blindaje-servidor.sh peter@72.62.97.139:~/bin/
#     ssh peter@72.62.97.139
#     sudo bash ~/bin/blindaje-servidor.sh
#
# Reglas del script:
#   - Antes de tocar un archivo lo respalda como  archivo.bak-AAAAMMDD_HHMM.
#   - Valida antes de recargar (nginx -t, sshd -t). Si la validación falla,
#     restaura los respaldos de esta corrida y NO recarga.
#   - Es idempotente: se puede correr dos veces sin duplicar nada.
#   - NO toca CHAUNE: no edita /etc/nginx/sites-available/chaune.datalytica.cloud,
#     ni datalytica.cloud, ni /var/www/chaune, ni snippets/chaune-security.conf.
#     Las medidas globales (firewall, server_tokens, fail2ban) se explican en
#     cada paso con su efecto sobre CHAUNE.
#   - Los pasos que pueden cortar el acceso piden confirmación (s/N).
#
# IMPORTANTE: deja ABIERTA tu sesión SSH actual mientras corre el script y
# prueba entrar desde OTRA terminal antes de cerrarla.
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# CONFIGURACIÓN (revisa antes de correr)
# ---------------------------------------------------------------------------
# IP(s) pública(s) de la oficina que fail2ban nunca debe bloquear (toda la
# oficina sale por una sola IP: si se banea, se cae SIAE para todos).
# Averíguala desde la oficina con:  curl -s https://ifconfig.me
# Ejemplo: IGNORAR_IPS="190.0.0.10 190.0.0.11"
IGNORAR_IPS=""

# Pasos opcionales (0 = no se hace, 1 = se hace con confirmación)
DESACTIVAR_CLAVE_SSH=0          # Paso 5b: SSH solo con llave
POSTGRES_SOLO_LOCAL=0           # Paso 8 : PostgreSQL escucha solo 127.0.0.1 (reinicia PostgreSQL)
RECHAZAR_ACCESO_POR_IP=0        # Paso 9 : nginx rechaza peticiones a la IP o a dominios desconocidos

# Huella del archivo nginx de SIAE revisado el 17/11/2026. Si alguien lo cambió
# desde entonces, el paso 4 se detiene en vez de pisar el cambio.
SITIO_SHA_ESPERADO="b0aa9e3ee480ee82cb400f680df387980613fe7913a5b13d53cdf31e2feff833"

# ---------------------------------------------------------------------------
FECHA="$(date +%Y%m%d_%H%M)"
SITIO="/etc/nginx/sites-available/siae.datalytica.cloud"
BACKEND="/var/www/siae/backend"
MARCA="SIAE-BLINDAJE-2026-11-17"
RESPALDOS_CORRIDA=()   # archivos respaldados en esta corrida (para restaurar)
NUEVOS_CORRIDA=()      # archivos creados en esta corrida (para quitar si falla)

paso()  { echo; echo "=================================================================="; echo ">> $*"; echo "=================================================================="; }
info()  { echo "   - $*"; }
aviso() { echo "   !! $*"; }

confirmar() {
  local r
  read -r -p "   ?? $1 (s/N): " r
  [[ "$r" == "s" || "$r" == "S" ]]
}

# Respalda un archivo una sola vez por corrida.
respaldar() {
  local f="$1"
  if [[ -f "$f" && ! -f "$f.bak-$FECHA" ]]; then
    cp -a "$f" "$f.bak-$FECHA"
    RESPALDOS_CORRIDA+=("$f")
    info "respaldo: $f.bak-$FECHA"
  fi
}

# Escribe un archivo nuevo o reemplaza uno existente (respaldándolo antes)
# solo si el contenido cambia. Contenido por stdin.
escribir_si_cambia() {
  local destino="$1" tmp
  tmp="$(mktemp)"
  cat > "$tmp"
  if [[ -f "$destino" ]] && cmp -s "$tmp" "$destino"; then
    info "sin cambios: $destino"
    rm -f "$tmp"
    return 0
  fi
  if [[ -f "$destino" ]]; then
    respaldar "$destino"
  else
    NUEVOS_CORRIDA+=("$destino")
  fi
  install -m 644 -o root -g root "$tmp" "$destino"
  rm -f "$tmp"
  info "escrito: $destino"
}

# Si nginx -t falla: restaura respaldos de esta corrida, quita archivos nuevos y sale.
validar_nginx_o_restaurar() {
  if nginx -t; then
    systemctl reload nginx
    info "nginx recargado"
  else
    aviso "nginx -t FALLÓ. Restaurando lo que cambió esta corrida y saliendo."
    for f in "${RESPALDOS_CORRIDA[@]}"; do
      if [[ "$f" == /etc/nginx/* ]]; then cp -a "$f.bak-$FECHA" "$f"; info "restaurado: $f"; fi
    done
    for f in "${NUEVOS_CORRIDA[@]}"; do
      if [[ "$f" == /etc/nginx/* ]]; then rm -f "$f"; info "quitado: $f"; fi
    done
    if nginx -t; then aviso "nginx quedó como estaba (no se recargó nada)."; fi
    exit 1
  fi
}

# =============================================================================
# PASO 0. Comprobaciones previas (solo lectura)
# =============================================================================
paso "PASO 0. Comprobaciones previas"
[[ $EUID -eq 0 ]] || { echo "Ejecuta con sudo: sudo bash $0"; exit 1; }
for f in "$SITIO" /etc/nginx/nginx.conf /etc/ssh/sshd_config "$BACKEND/.env"; do
  [[ -e "$f" ]] || { echo "No existe $f. Me detengo."; exit 1; }
done
info "Ubuntu: $(lsb_release -ds 2>/dev/null)"
info "Configuración SSH efectiva (lo que realmente aplica sshd):"
sshd -T 2>/dev/null | grep -Ei '^(port|permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|maxauthtries|x11forwarding|allowusers) ' | sed 's/^/       /' || true
info "Firewall actual:"
ufw status verbose | sed 's/^/       /'
info "PostgreSQL pg_hba.conf (líneas activas):"
grep -Ev '^\s*(#|$)' /etc/postgresql/16/main/pg_hba.conf | sed 's/^/       /' || true
info "Llaves autorizadas de peter (solo huellas):"
ssh-keygen -lf /home/peter/.ssh/authorized_keys 2>/dev/null | sed 's/^/       /' || aviso "peter no tiene authorized_keys"
echo
confirmar "¿Revisaste lo de arriba y sigo con el blindaje?" || exit 0

# =============================================================================
# PASO 1. Firewall (ufw)
# -----------------------------------------------------------------------------
# Puertos públicos que hoy escuchan: 22 (SSH), 80/443 (nginx: SIAE y CHAUNE),
# 5432 (PostgreSQL en 0.0.0.0, pero desde internet ya se ve filtrado).
# CHAUNE solo usa 80/443 a través de nginx, así que no le afecta.
# ADVERTENCIA: lo primero es permitir SSH; si no, al aplicar "deny" perderías
# el acceso. No se hace "ufw reset": se respetan las reglas que ya existan.
# =============================================================================
paso "PASO 1. Firewall"
ufw allow 22/tcp comment 'SSH'           >/dev/null && info "SSH (22) permitido"
ufw allow 80/tcp comment 'HTTP nginx'    >/dev/null && info "HTTP (80) permitido"
ufw allow 443/tcp comment 'HTTPS nginx'  >/dev/null && info "HTTPS (443) permitido"
ufw default deny incoming  >/dev/null && info "entrada: denegar por defecto"
ufw default allow outgoing >/dev/null && info "salida: permitir por defecto"
if ufw status | grep -Eq '^5432.*ALLOW'; then
  aviso "Hay una regla que PERMITE 5432 (PostgreSQL) desde internet:"
  ufw status numbered | grep 5432 | sed 's/^/       /'
  aviso "Si alguien (pgAdmin remoto, CHAUNE desde otro servidor) se conecta así, quitarla lo corta."
  if confirmar "¿Quito las reglas ALLOW de 5432?"; then
    while n=$(ufw status numbered | grep -E '5432.*ALLOW' | head -1 | sed -E 's/^\[ *([0-9]+)\].*/\1/'); [[ -n "$n" ]]; do
      ufw --force delete "$n" >/dev/null
    done
    info "reglas 5432 quitadas"
  fi
fi
if ufw status | grep -q 'Status: inactive'; then
  aviso "ufw está INACTIVO. Se activará con SSH ya permitido."
  confirmar "¿Activo ufw ahora?" && ufw --force enable
fi
ufw status verbose | sed 's/^/       /'

# =============================================================================
# PASO 2. Actualizaciones automáticas de seguridad
# -----------------------------------------------------------------------------
# unattended-upgrades ya está activo. Solo se deja explícito que NUNCA reinicie
# solo (un reinicio también tumba CHAUNE) y que limpie kernels viejos.
# El reinicio pendiente (kernel 6.8.0-149 y libc6) se hace a mano, fuera de
# horario: ver el final del script.
# =============================================================================
paso "PASO 2. Actualizaciones automáticas de seguridad"
apt-get install -y unattended-upgrades >/dev/null
escribir_si_cambia /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
escribir_si_cambia /etc/apt/apt.conf.d/52siae-unattended <<'EOF'
// 17/11/2026 (SIAE): parches de seguridad automáticos, sin reinicio automático
// porque el servidor también aloja CHAUNE; el reinicio lo programa Peter.
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
info "unattended-upgrades: $(systemctl is-active unattended-upgrades)"

# =============================================================================
# PASO 3. nginx global: ocultar versión y zonas de límite de SIAE
# -----------------------------------------------------------------------------
# server_tokens off: deja de mostrar "nginx/1.24.0 (Ubuntu)". Aplica también a
# CHAUNE, pero solo oculta la versión: no cambia su comportamiento.
# Las zonas limit_req y el map se declaran en http{} pero con nombre siae_*;
# solo actúan donde el sitio de SIAE las use. CHAUNE no se ve afectado.
# =============================================================================
paso "PASO 3. nginx global"
escribir_si_cambia /etc/nginx/conf.d/siae-seguridad.conf <<'EOF'
# 17/11/2026 (SIAE): no publicar la versión de nginx (aplica a todos los sitios).
server_tokens off;

# 17/11/2026 (SIAE): límites de peticiones por IP, solo los usa el sitio de SIAE.
# Login: hasta 30 por minuto por IP (Laravel ya limita 5/min por usuario+IP);
# la oficina sale por una sola IP, por eso no es más estricto.
map $request_uri $siae_login_key {
    "~^/api/login(\?|$)"  $binary_remote_addr;
    default             "";
}
limit_req_zone $siae_login_key     zone=siae_login:10m rate=30r/m;
# API general: 30 por segundo por IP con ráfaga de 100 (la pantalla pide varias cosas a la vez).
limit_req_zone $binary_remote_addr zone=siae_api:10m   rate=30r/s;
EOF

# Cabeceras de seguridad de SIAE en un snippet: se incluyen en el server y se
# repiten en cada location que tenga su propio add_header (nginx no las hereda).
escribir_si_cambia /etc/nginx/snippets/siae-cabeceras.conf <<'EOF'
# 17/11/2026 (SIAE): cabeceras de seguridad. HSTS SIN includeSubDomains para no
# obligar HTTPS en otros subdominios de datalytica.cloud (CHAUNE).
add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
# CSP: la propone otro análisis. Activarla solo cuando esté probada:
# add_header Content-Security-Policy "default-src 'self'; ..." always;
EOF

# =============================================================================
# PASO 4. Sitio nginx de SIAE (solo siae.datalytica.cloud)
# -----------------------------------------------------------------------------
# Cambios:
#   - logs propios (siae.access.log / siae.error.log) para que fail2ban vigile
#     solo a SIAE y no banee por tráfico de CHAUNE;
#   - cabeceras de seguridad (también en /index.html);
#   - limit_req en /api (login y general), respuesta 429;
#   - /assets/* que no existe -> 404 real (antes devolvía index.html con 200);
#   - rutas de escaneo (wp-login, phpmyadmin, .php fuera de /api, .sql, .bak...) -> 404;
#   - se conserva el bloqueo de archivos ocultos y todo lo de Certbot.
# =============================================================================
paso "PASO 4. Sitio nginx de SIAE"
if grep -q "$MARCA" "$SITIO"; then
  info "el sitio ya tiene el blindaje ($MARCA). No se toca."
else
  ACTUAL_SHA="$(sha256sum "$SITIO" | cut -d' ' -f1)"
  if [[ "$ACTUAL_SHA" != "$SITIO_SHA_ESPERADO" ]]; then
    aviso "El archivo $SITIO cambió desde la revisión del 17/11/2026."
    aviso "No lo piso. Pásale el archivo actual al arquitecto para ajustar este paso."
  else
    escribir_si_cambia "$SITIO" <<'EOF'
# SIAE-BLINDAJE-2026-11-17: versión blindada. Respaldo de la anterior junto a este archivo (.bak-FECHA).
server {
    server_name siae.datalytica.cloud;

    # 17/11/2026: logs propios de SIAE (fail2ban vigila solo estos)
    access_log /var/log/nginx/siae.access.log;
    error_log  /var/log/nginx/siae.error.log;

    # 17/11/2026: cabeceras de seguridad y respuesta 429 al pasar los límites
    include /etc/nginx/snippets/siae-cabeceras.conf;
    limit_req_status 429;

    # ----- FRONTEND (React compilado con Vite) -----
    root /var/www/siae/frontend/dist;
    index index.html;

    # Sirve archivos estáticos del frontend; si no existe la ruta,
    # cae en index.html para que React Router maneje el ruteo del lado cliente
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 15/11/2026: index.html sin caché (siempre la versión nueva al recargar)
    # 17/11/2026: se repiten las cabeceras porque un add_header propio anula las del server
    location = /index.html {
        include /etc/nginx/snippets/siae-cabeceras.conf;
        add_header Cache-Control "no-cache" always;
    }

    # 17/11/2026: un .js/.css que no existe da 404 real (antes index.html con 200,
    # que el navegador intentaba ejecutar como JavaScript)
    location /assets/ {
        try_files $uri =404;
    }

    # ----- BACKEND (API Laravel) -----
    # Todo lo que llegue a /api se resuelve dentro de backend/public,
    # usando alias para que /api/lo-que-sea -> backend/public/lo-que-sea
    location /api {
        # 17/11/2026: límites por IP (zonas en conf.d/siae-seguridad.conf).
        # siae_login solo cuenta /api/login; siae_api cuenta todo /api.
        limit_req zone=siae_login burst=20 nodelay;
        limit_req zone=siae_api   burst=100 nodelay;

        alias /var/www/siae/backend/public;
        index index.php;
        try_files $uri $uri/ @laravel_api;

        location ~ \.php$ {
            fastcgi_split_path_info ^(.+\.php)(/.+)$;
            fastcgi_pass unix:/run/php/php8.3-fpm.sock;
            fastcgi_index index.php;
            include fastcgi_params;
            # SCRIPT_FILENAME apunta siempre al front controller de Laravel
            fastcgi_param SCRIPT_FILENAME $document_root/index.php;
            fastcgi_param SCRIPT_NAME /index.php;
        }
    }

    # Reescribe cualquier ruta de API que no matchee un archivo real
    # hacia el index.php de Laravel (así funciona el router de Laravel)
    location @laravel_api {
        rewrite ^/api/(.*)$ /api/index.php?/$1 last;
    }

    # Seguridad básica: bloquea acceso directo a archivos ocultos (.env, .git, etc.)
    location ~ /\.(?!well-known).* {
        deny all;
    }

    # 17/11/2026: rutas típicas de escaneo -> 404 (y fail2ban las cuenta)
    location ~* ^/(wp-admin|wp-login\.php|wp-content|wp-includes|xmlrpc\.php|wordpress|phpmyadmin|pma|myadmin|cgi-bin|boaform|HNAP1|actuator|server-status|vendor/phpunit) {
        return 404;
    }

    # 17/11/2026: scripts y archivos de respaldo fuera de /api -> 404
    location ~* ^/(?!api/).*\.(php\d?|phtml|asp|aspx|jsp|cgi|sql|bak|old|orig|swp|ini|log|env|ya?ml)$ {
        return 404;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/siae.datalytica.cloud/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/siae.datalytica.cloud/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}
server {
    if ($host = siae.datalytica.cloud) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name siae.datalytica.cloud;
    return 404; # managed by Certbot


}
EOF
    # Guarda el respaldo también en ~/respaldos de peter (fuera de /etc)
    if [[ -f "$SITIO.bak-$FECHA" ]]; then
      install -m 600 -o peter -g peter "$SITIO.bak-$FECHA" "/home/peter/respaldos/nginx_siae_${FECHA}_antes_blindaje.conf"
    fi
  fi
fi
validar_nginx_o_restaurar
touch /var/log/nginx/siae.access.log /var/log/nginx/siae.error.log
chown www-data:adm /var/log/nginx/siae.access.log /var/log/nginx/siae.error.log
chmod 640 /var/log/nginx/siae.access.log /var/log/nginx/siae.error.log

# =============================================================================
# PASO 5. SSH
# -----------------------------------------------------------------------------
# Se agrega /etc/ssh/sshd_config.d/10-siae-blindaje.conf. sshd usa el PRIMER
# valor que encuentra; 10-* se lee antes que 50-cloud-init.conf.
# ADVERTENCIA: no cierres tu sesión actual. Después de recargar, abre OTRA
# terminal y verifica que entras con  ssh peter@72.62.97.139 . Recargar sshd
# no corta las sesiones abiertas.
# =============================================================================
paso "PASO 5. SSH"
SSHD_DROPIN=/etc/ssh/sshd_config.d/10-siae-blindaje.conf
CLAVE_LINEA="# PasswordAuthentication no   (paso 5b, opcional)"
if [[ "$DESACTIVAR_CLAVE_SSH" == "1" ]]; then
  echo
  aviso "PASO 5b: vas a desactivar el ingreso SSH con CONTRASEÑA."
  aviso "Si tu llave no funciona desde TODAS las PCs que usas, te quedas fuera"
  aviso "y solo podrás entrar por la consola web de Hostinger."
  aviso "Comprueba ANTES desde otra terminal:  ssh -o PasswordAuthentication=no peter@72.62.97.139"
  if confirmar "¿Confirmas que entras con llave y desactivo la contraseña?"; then
    CLAVE_LINEA="PasswordAuthentication no
KbdInteractiveAuthentication no"
  fi
fi
cp_ssh_tmp="$(mktemp)"
cat > "$cp_ssh_tmp" <<EOF
# 17/11/2026 (SIAE): endurecimiento de SSH. Ver docs/seguridad/blindaje-servidor-2026-11-17.md
PermitRootLogin no
PubkeyAuthentication yes
MaxAuthTries 4
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
$CLAVE_LINEA
# Opcional (solo si nadie más entra por SSH, ni CHAUNE para desplegar):
# AllowUsers peter
EOF
escribir_si_cambia "$SSHD_DROPIN" < "$cp_ssh_tmp"
rm -f "$cp_ssh_tmp"
chmod 644 "$SSHD_DROPIN"
if sshd -t; then
  systemctl reload ssh || systemctl restart ssh
  info "sshd recargado. Valores efectivos:"
  sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication|maxauthtries|x11forwarding|logingracetime) ' | sed 's/^/       /'
  aviso "AHORA abre otra terminal y prueba entrar antes de cerrar esta."
else
  aviso "sshd -t FALLÓ: quito $SSHD_DROPIN y no recargo."
  if [[ -f "$SSHD_DROPIN.bak-$FECHA" ]]; then cp -a "$SSHD_DROPIN.bak-$FECHA" "$SSHD_DROPIN"; else rm -f "$SSHD_DROPIN"; fi
  sshd -t && info "SSH quedó como estaba."
fi

# =============================================================================
# PASO 6. fail2ban (SSH y nginx de SIAE)
# -----------------------------------------------------------------------------
# Banea por IP en todo el servidor (también para CHAUNE), pero solo cuenta
# fallos de SSH y de los logs PROPIOS de SIAE. La IP de la oficina va en
# IGNORAR_IPS para que nunca quede bloqueada.
# =============================================================================
paso "PASO 6. fail2ban"
if [[ -z "$IGNORAR_IPS" ]]; then aviso "IGNORAR_IPS está vacío: la IP de la oficina podría banearse si alguien se equivoca muchas veces."; fi
apt-get install -y fail2ban >/dev/null
escribir_si_cambia /etc/fail2ban/filter.d/siae-escaneo.conf <<'EOF'
# 17/11/2026 (SIAE): quien pide archivos secretos (.env, .git, llaves, respaldos) es un escáner.
[Definition]
failregex = ^<HOST> \S+ \S+ \[[^\]]*\] "(?:GET|POST|HEAD|PUT) [^"]*(?:/\.env|/\.git|/\.aws|/\.ssh|/\.htpasswd|wp-config|phpinfo|/vendor/phpunit|\.sql|\.bak)[^"]*" (?:403|404)
ignoreregex =
EOF
escribir_si_cambia /etc/fail2ban/jail.d/siae.local <<EOF
# 17/11/2026 (SIAE): cárceles de fail2ban. Ver docs/seguridad/blindaje-servidor-2026-11-17.md
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1 $IGNORAR_IPS
bantime = 1h
bantime.increment = true
bantime.maxtime = 1w
findtime = 10m
maxretry = 5

[sshd]
enabled = true

[nginx-limit-req]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/siae.error.log
findtime = 2m
maxretry = 20
bantime  = 30m

[nginx-botsearch]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/siae.access.log
maxretry = 3

[siae-escaneo]
enabled  = true
port     = http,https
filter   = siae-escaneo
logpath  = /var/log/nginx/siae.access.log
maxretry = 2
bantime  = 24h
EOF
if fail2ban-client -t >/dev/null 2>&1; then
  systemctl enable fail2ban >/dev/null 2>&1
  systemctl restart fail2ban
  sleep 2
  fail2ban-client status | sed 's/^/       /'
else
  aviso "La configuración de fail2ban tiene un error:"
  fail2ban-client -t || true
  aviso "fail2ban NO se reinició. Corrige y corre de nuevo."
fi

# =============================================================================
# PASO 7. Permisos de SIAE (sin romper lo que lee php-fpm)
# -----------------------------------------------------------------------------
# OJO (incidente 09/11/2026): php-fpm corre como www-data y lee archivos de
# peter por "otros". Por eso NO se quita la lectura a "otros" en masa; solo
# se asegura .env, los respaldos y la carpeta de scripts de peter.
# =============================================================================
paso "PASO 7. Permisos"
chown peter:www-data "$BACKEND/.env" && chmod 640 "$BACKEND/.env"
info ".env: $(stat -c '%A %U:%G' "$BACKEND/.env")"
chmod 700 /home/peter/respaldos
find /home/peter/respaldos -maxdepth 1 -type f ! -perm 600 -exec chmod 600 {} +
info "respaldos: $(stat -c '%A' /home/peter/respaldos), archivos 600"
chmod 750 /home/peter/bin
info "~/bin: $(stat -c '%A' /home/peter/bin)"
info "Archivos con escritura para todos en SIAE (debería salir vacío):"
find /var/www/siae -path '*/node_modules' -prune -o -path '*/vendor' -prune -o -perm -o=w -print 2>/dev/null | sed 's/^/       /'

# =============================================================================
# PASO 8 (opcional). PostgreSQL solo en localhost
# -----------------------------------------------------------------------------
# Hoy escucha en 0.0.0.0:5432 (todas las interfaces). Desde internet aparece
# filtrado, pero si el firewall falla queda expuesto. SIAE se conecta por
# 127.0.0.1. ADVERTENCIA: requiere REINICIAR PostgreSQL (unos segundos sin
# base para SIAE y para CHAUNE si la usa) y corta cualquier conexión remota.
# Hacerlo fuera de horario.
# =============================================================================
paso "PASO 8 (opcional). PostgreSQL solo en localhost"
PGCONF=/etc/postgresql/16/main/postgresql.conf
if [[ "$POSTGRES_SOLO_LOCAL" == "1" ]]; then
  if grep -Eq "^\s*listen_addresses\s*=\s*'localhost'" "$PGCONF"; then
    info "ya escucha solo en localhost"
  else
    info "Conexiones actuales a 5432 desde fuera (deberían ser 0):"
    ss -tnH state established '( sport = :5432 )' | awk '{print $4}' | grep -v '^127\.' | sed 's/^/       /' || true
    if confirmar "¿Cambio listen_addresses a 'localhost' y REINICIO PostgreSQL ahora?"; then
      respaldar "$PGCONF"
      sed -i -E "s/^\s*listen_addresses\s*=.*/listen_addresses = 'localhost'\t# 17\/11\/2026 SIAE: solo local/" "$PGCONF"
      systemctl restart postgresql
      sleep 2
      ss -tlnH | grep 5432 | sed 's/^/       /'
      curl -s -o /dev/null -w "   - API SIAE responde: %{http_code}\n" https://siae.datalytica.cloud/api/login -X POST || true
    fi
  fi
else
  info "omitido (POSTGRES_SOLO_LOCAL=0). El firewall ya bloquea 5432."
fi

# =============================================================================
# PASO 9 (opcional). Rechazar peticiones por IP o dominio desconocido
# -----------------------------------------------------------------------------
# Hoy https://72.62.97.139 responde con el primer sitio (no es SIAE). Un
# servidor "por defecto" que rechaza todo evita que los escáneres que barren
# IPs lleguen a una aplicación. ADVERTENCIA: si CHAUNE o alguien entra por la
# IP directa (sin dominio), dejará de funcionar. Confírmalo con CHAUNE.
# =============================================================================
paso "PASO 9 (opcional). Servidor por defecto que rechaza"
if [[ "$RECHAZAR_ACCESO_POR_IP" == "1" ]]; then
  if grep -rqs default_server /etc/nginx/sites-enabled/ /etc/nginx/conf.d/; then
    info "ya existe un default_server habilitado; no se agrega otro."
  elif confirmar "¿Agrego el servidor por defecto que rechaza peticiones sin dominio válido?"; then
    escribir_si_cambia /etc/nginx/conf.d/zz-siae-default-rechazo.conf <<'EOF'
# 17/11/2026 (SIAE): peticiones a la IP o a dominios que no existen en este servidor se cierran sin respuesta.
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
    return 444;
}
EOF
    validar_nginx_o_restaurar
  fi
else
  info "omitido (RECHAZAR_ACCESO_POR_IP=0)."
fi

# =============================================================================
# PASO 10. Comprobación final
# =============================================================================
paso "PASO 10. Comprobación final"
U=https://siae.datalytica.cloud
echo "   Cabeceras de SIAE:"
curl -sI "$U/" | grep -Ei '^(HTTP|server|strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy|cache-control)' | sed 's/^/       /'
for p in / /.env /.git/config /assets/noexiste.js /wp-login.php /api/login; do
  printf "       %-22s -> %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$U$p")"
done
echo "   Esperado: / 200, /.env 403, /.git/config 403, /assets/noexiste.js 404, /wp-login.php 404, /api/login 405 (GET no permitido)"
echo
echo "   Abre SIAE en el navegador, inicia sesión y abre 2-3 pantallas."
echo "   Revisa también que CHAUNE abra normal."

# =============================================================================
# PENDIENTE MANUAL (fuera de horario, afecta también a CHAUNE):
#   sudo apt-get update && sudo apt-get upgrade      # 41 paquetes pendientes
#   sudo reboot                                      # kernel 6.8.0-149 y libc6 lo piden
# Antes: respaldo de la base (~/bin/respaldo_siae.sh) y avisar a usuarios de SIAE y CHAUNE.
#
# CÓMO DESHACER un paso:
#   nginx : sudo cp -a /etc/nginx/sites-available/siae.datalytica.cloud.bak-FECHA /etc/nginx/sites-available/siae.datalytica.cloud
#           sudo rm /etc/nginx/conf.d/siae-seguridad.conf ; sudo nginx -t && sudo systemctl reload nginx
#   ssh   : sudo rm /etc/ssh/sshd_config.d/10-siae-blindaje.conf ; sudo sshd -t && sudo systemctl reload ssh
#   f2b   : sudo fail2ban-client unban <IP>   |  sudo rm /etc/fail2ban/jail.d/siae.local && sudo systemctl restart fail2ban
#   ufw   : sudo ufw status numbered ; sudo ufw delete <n>
# =============================================================================
echo
echo "Listo. Respaldos de esta corrida con sufijo .bak-$FECHA"
