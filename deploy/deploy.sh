#!/usr/bin/env bash
# deploy/deploy.sh — Triển khai/cập nhật Mây An Nhiên trên VPS Ubuntu/Debian.
#
# Script này KHÔNG tự mua dịch vụ, KHÔNG tự đăng ký domain, KHÔNG chứa secret.
# Bạn cần chuẩn bị trước:
#   1. Một VPS Ubuntu 22.04/24.04 đã có domain A/AAAA trỏ về IP máy.
#   2. Một tài khoản user KHÔNG phải root để chạy ứng dụng (ví dụ: mayan).
#   3. Một kho Git (local hoặc private repo) chứa mã nguồn.
#   4. File biến môi trường tại /etc/mayan/mayan.env (quyền 600) — xem .env.example.
#
# Cách dùng:
#   sudo bash deploy/deploy.sh                 # cài đặt lần đầu
#   sudo bash deploy/deploy.sh --update        # cập nhật phiên bản mới
#
set -euo pipefail

APP_USER="${APP_USER:-mayan}"
APP_DIR="${APP_DIR:-/var/www/mayan}"
DATA_DIR="${DATA_DIR:-/var/lib/mayan}"
ENV_FILE="${ENV_FILE:-/etc/mayan/mayan.env}"
REPO_URL="${REPO_URL:-}"          # để trống nếu deploy từ bản copy cục bộ
BRANCH="${BRANCH:-main}"
NODE_MAJOR="${NODE_MAJOR:-22}"

log()  { echo -e "\n\033[1;34m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
die()  { echo -e "\033[1;31m[x] $*\033[0m"; exit 1; }

MODE="install"
[ "${1:-}" = "--update" ] && MODE="update"

[ "$(id -u)" -eq 0 ] || die "Cần chạy bằng sudo."
[ -f "${ENV_FILE}" ] || die "Chưa có file biến môi trường ${ENV_FILE}. Hãy tạo từ .env.example trước."

# --------------------------------------------------------------- 1. user
if ! id "${APP_USER}" >/dev/null 2>&1; then
  log "Tạo user triển khai không phải root: ${APP_USER}"
  adduser --disabled-password --gecos "" "${APP_USER}"
fi

# ------------------------------------------------------- 2. gói phụ thuộc
log "Cài đặt gói hệ thống"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git nginx ufw sqlite3 rsync logrotate

# --------------------------------------------------------- 3. Node.js
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt "${NODE_MAJOR}" ]; then
  log "Cài Node.js ${NODE_MAJOR}.x (NodeSource)"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi
log "Node: $(node -v)  |  npm: $(npm -v)"

# ------------------------------------------------------------ 4. thư mục
log "Chuẩn bị thư mục ứng dụng"
mkdir -p "${APP_DIR}" "${DATA_DIR}" /etc/mayan /var/log/mayan
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" "${DATA_DIR}" /var/log/mayan
chmod 600 "${ENV_FILE}"
chown root:"${APP_USER}" "${ENV_FILE}"

# ---------------------------------------------------------- 5. mã nguồn
if [ "${MODE}" = "install" ]; then
  log "Lấy mã nguồn"
  if [ -n "${REPO_URL}" ]; then
    sudo -u "${APP_USER}" git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  else
    warn "REPO_URL rỗng — hãy copy mã nguồn vào ${APP_DIR} bằng rsync/scp trước khi chạy lại script."
  fi
else
  log "Cập nhật mã nguồn (git pull)"
  if [ -d "${APP_DIR}/.git" ]; then
    sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
  else
    warn "Không phải git repo — copy thủ công và bỏ qua bước này."
  fi
fi
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# ------------------------------------------------- 6. dependency + build
log "Cài dependency từ lockfile (npm ci)"
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && npm ci --omit=dev"

log "Cài dependency build (vite) + build frontend"
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && npm ci && npm run build"

# -------------------------------------------------------- 7. migrate DB
log "Khởi tạo/migrate database (idempotent, KHÔNG seed lại dữ liệu cũ)"
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && DB_PATH='${DATA_DIR}/mayan.db' node -e \"import('./server/db.js').then(m=>{m.seedCatalogIfEmpty();m.seedRooms();m.db.close();console.log('[migrate] OK')})\""

# ------------------------------------------------------- 8. systemd
log "Cài đặt systemd service"
cp "${APP_DIR}/deploy/mayan-api.service" /etc/systemd/system/mayan-api.service
sed -i "s#^User=.*#User=${APP_USER}#; s#^Group=.*#Group=${APP_USER}#; s#^WorkingDirectory=.*#WorkingDirectory=${APP_DIR}#" /etc/systemd/system/mayan-api.service
sed -i "s#^EnvironmentFile=.*#EnvironmentFile=${ENV_FILE}#" /etc/systemd/system/mayan-api.service
systemctl daemon-reload
systemctl enable mayan-api >/dev/null
systemctl restart mayan-api
sleep 3
systemctl --no-pager --full status mayan-api | head -20 || true

# -------------------------------------------------------- 9. backup
log "Sao lưu database trước khi tiếp tục"
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}' && DB_PATH='${DATA_DIR}/mayan.db' node scripts/backup-db.mjs --out '${DATA_DIR}/backups'"

# --------------------------------------------------------- 10. firewall
log "Thiết lập firewall (UFW)"
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
ufw --force enable || true
ufw status verbose || true

# ---------------------------------------------------- 11. HTTPS (nếu có)
log "Kiểm tra chứng chỉ HTTPS"
if [ -f "/etc/letsencrypt/live" ]; then
  CERT_DIR=$(ls -1 /etc/letsencrypt/live | head -1)
  warn "Đã có chứng chỉ: ${CERT_DIR}. Hãy chạy: certbot --nginx -d <domain> -d <www.domain>"
else
  warn "Chưa có chứng chỉ. Cài certbot và chạy:"
  warn "  apt-get install -y certbot python3-certbot-nginx"
  warn "  certbot --nginx -d <domain-cua-ban> -d <www.domain-cua-ban>"
fi

log "HOÀN TẤT cài đặt/cập nhật. Bước tiếp theo:"
cat <<EOF
  1. Trỏ DNS domain về IP máy chủ (A record), đợi lan truyền.
  2. Chạy: certbot --nginx -d <domain> -d <www.domain>   (bắt buộc HTTPS)
  3. Tạo admin:  cd ${APP_DIR} && npm run seed:admin
  4. Kiểm tra:    curl -s https://<domain>/api/health
  5. Bật backup định kỳ (crontab): xem bao-cao/PRODUCTION_READINESS.md
EOF
