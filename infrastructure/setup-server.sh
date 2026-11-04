#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 22.04/24.04 server (run as root):
#   curl -fsSL https://raw.githubusercontent.com/noissyyy/rusada-quizbot/main/infrastructure/setup-server.sh | bash
set -euo pipefail

echo "==> Updates"
apt-get update -y && apt-get upgrade -y

echo "==> Docker"
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
systemctl enable --now docker

echo "==> 2 GB swap (safety net for small servers)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
fi

echo "==> Firewall: only SSH, HTTP, HTTPS"
apt-get install -y ufw git
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
ufw --force enable

echo "==> Code"
if [ ! -d /opt/rusada ]; then git clone https://github.com/noissyyy/rusada-quizbot.git /opt/rusada; fi
cd /opt/rusada && git pull --ff-only
[ -f .env ] || cp .env.example .env

echo
echo "Done. Next:  nano /opt/rusada/.env   then   cd /opt/rusada && docker compose pull && docker compose up -d"
