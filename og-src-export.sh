#!/usr/bin/env bash
# Пакує ВИХІДНИКИ сайту ophthalmology-group.online (без node_modules і dist). Сайт НЕ змінює.
set -uo pipefail
P=/var/www/oftam_center_dnipro_new
[ -d "$P" ] || { echo "!! Немає папки $P"; exit 1; }
echo "==> Вміст $P:"; ls -la "$P"
echo; echo "==> package.json:"; cat "$P/package.json" 2>/dev/null | head -40
echo; echo "==> Як віддається сайт:"
nginx -T 2>/dev/null | grep -n -i "oftam\|ophthalm" | head -20
systemctl list-units --type=service --no-pager 2>/dev/null | grep -i -E "cloudflared|caddy|pm2|node|apache|oftam" | head
command -v pm2 >/dev/null && pm2 ls 2>/dev/null | head -20
OUT=/root/og-src.tar.gz
tar czf "$OUT" -C "$(dirname "$P")" --exclude='node_modules' --exclude='*/dist' --exclude='.astro' --exclude='*/.cache' "$(basename "$P")"
echo; echo "ГОТОВО. Архів: $OUT ($(du -h "$OUT" | cut -f1))"
echo "На КОМП'ЮТЕРІ:  scp root@188.116.26.57:$OUT ."
