#!/usr/bin/env bash
# esutomograf.com: прибрати блок «Офтальмологія» і GTM (вони для ophthalmology-group.online).
# Фото лікарів залишаються на своєму сервері (папка team/).
set -euo pipefail
RAW="https://raw.githubusercontent.com/GreSH1i/my-website/deploy"
OK_SHAS="ea6d602f04507a271ca5bf3b1af83298eac3d752674fa1f58f3a694f46346665 0bdb99157fd11a13f451e7e5981e8050bcdc3c6d06fe53deb1e408c3ce0ab810"
NEW_SHA="a5b69b09b0413cce8e1f778ad356c9c5d1186e1a97fe2016cff7cde40b34c7ec"
norm() { sed 's/[[:space:]]*$//' "$1" | sha256sum | cut -d' ' -f1; }

echo "==> Шукаю папку сайту esutomograf.com у nginx..."
ROOT=$(nginx -T 2>/dev/null | awk '/server_name/ && /esutomograf/ {f=1} f && $1=="root" {gsub(";","",$2); print $2; exit}' || true)
for c in "$ROOT" /var/www/esutomograf.com; do
  if [ -n "$c" ] && [ -f "$c/index.html" ] && [ -d "$c/esu-refresh-64afeeae31ab" ]; then ROOT="$c"; break; else ROOT=""; fi
done
[ -n "$ROOT" ] || { echo "!! Сайт esutomograf.com не знайдено на цьому сервері. Нічого не змінено."; exit 1; }
echo "    Папка сайту: $ROOT"
[ -f "$ROOT/team/toporkov.jpg" ] || { echo "!! Немає папки team/ з фото лікарів. Нічого не змінено."; exit 1; }

CUR=$(norm "$ROOT/index.html")
[ "$CUR" = "$NEW_SHA" ] && { echo "==> Вже зроблено. Нічого міняти не треба."; exit 0; }
if ! echo " $OK_SHAS " | grep -q " $CUR " && [ "${FORCE:-0}" != "1" ]; then
  echo "!! index.html на сервері не той, що очікувався. Нічого не змінено. Надішліть цей вивід розробнику."; exit 2
fi

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$RAW/index.html" -o "$TMP/index.html"
[ "$(norm "$TMP/index.html")" = "$NEW_SHA" ] || { echo "!! Завантажений файл пошкоджений. Нічого не змінено."; exit 3; }
! grep -q "GTM-KD8Q4DQZ\|id=\"ophthalmology\"" "$TMP/index.html"

STAMP=$(date +%Y%m%d-%H%M%S); BK="/root/esutomograf-backup-$STAMP"; mkdir -p "$BK"
cp -a "$ROOT/index.html" "$BK/"
OWN=$(stat -c '%U:%G' "$ROOT/index.html"); MODE=$(stat -c '%a' "$ROOT/index.html")
install -m "$MODE" "$TMP/index.html" "$ROOT/index.html.new" && mv -f "$ROOT/index.html.new" "$ROOT/index.html"
chown "$OWN" "$ROOT/index.html"
[ -d "$ROOT/oph" ] && mv "$ROOT/oph" "$BK/oph" || true
echo "==> Резервна копія: $BK"
echo
echo "ГОТОВО. Блок «Офтальмологія» і GTM прибрано з esutomograf.com, фото лікарів залишились."
echo "Відкат: cp -a $BK/index.html $ROOT/index.html && mv $BK/oph $ROOT/oph"
