#!/usr/bin/env bash
# Пакує сайт ophthalmology-group.online в архів для розробника. Сам сайт НЕ змінює.
set -euo pipefail
echo "==> Шукаю ophthalmology-group.online у nginx..."
CONF=$(grep -rl "ophthalmology-group" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | head -1 || true)
ROOT=$(nginx -T 2>/dev/null | awk '/server_name/ && /ophthalmology-group/ {f=1} f && $1=="root" {gsub(";","",$2); print $2; exit}' || true)
if [ -z "$ROOT" ] || [ ! -d "$ROOT" ]; then
  ROOT=""; for c in /var/www/ophthalmology-group.online /var/www/ophthalmology-group /var/www/*ophthalm*; do [ -d "$c" ] && { ROOT="$c"; break; }; done
fi
if [ -z "$ROOT" ]; then
  echo "!! На цьому сервері сайт ophthalmology-group.online не знайдено. Ось що є у /var/www:"
  ls -la /var/www 2>/dev/null || true
  exit 1
fi
echo "    Папка сайту: $ROOT"
echo "    Конфіг nginx: ${CONF:-не знайдено}"
echo "    HTML-сторінок: $(find "$ROOT" -name '*.html' | wc -l)"
OUT=/root/og-site.tar.gz
if [ -n "$CONF" ]; then
  tar czf "$OUT" -C "$ROOT" --transform 's|^\./|site/|' . -C "$(dirname "$CONF")" "$(basename "$CONF")"
else
  tar czf "$OUT" -C "$ROOT" --transform 's|^\./|site/|' .
fi
echo
echo "ГОТОВО. Архів: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Скачайте його командою на КОМП'ЮТЕРІ (не на сервері):"
echo "  scp root@188.116.26.57:$OUT ."
