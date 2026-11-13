#!/usr/bin/env bash
# esutomograf.com: оновлення index.html (блок «Офтальмологія» + GTM + фото лікарів), папки oph/ і team/
set -euo pipefail
RAW="https://raw.githubusercontent.com/GreSH1i/my-website/deploy"
OK_SHAS="0605920918e0f71c08cbb6465866257566d35cec92227d7e9148c2f851063e14 0bdb99157fd11a13f451e7e5981e8050bcdc3c6d06fe53deb1e408c3ce0ab810"   # попередні версії, від яких можна оновлюватись
NEW_SHA="ea6d602f04507a271ca5bf3b1af83298eac3d752674fa1f58f3a694f46346665"    # оновлена версія (+ фото лікарів на своєму сервері)
norm() { sed 's/[[:space:]]*$//' "$1" | sha256sum | cut -d' ' -f1; }

echo "==> Шукаю папку сайту esutomograf.com у nginx..."
ROOT=""
if command -v nginx >/dev/null; then
  ROOT=$(nginx -T 2>/dev/null | awk '/server_name/ && /esutomograf/ {f=1} f && $1=="root" {gsub(";","",$2); print $2; exit}')
fi
for c in "$ROOT" /var/www/esutomograf.com /var/www/esutomograf /var/www/html; do
  if [ -n "$c" ] && [ -f "$c/index.html" ] && [ -d "$c/esu-refresh-64afeeae31ab" ]; then ROOT="$c"; break; else ROOT=""; fi
done
if [ -z "$ROOT" ]; then
  echo "!! На цьому сервері не знайдено сайт esutomograf.com (немає index.html + esu-refresh-64afeeae31ab)."
  echo "!! Нічого не змінено. Схоже, сайт лежить на іншому сервері."
  exit 1
fi
echo "    Папка сайту: $ROOT"

CUR=$(norm "$ROOT/index.html")
if [ "$CUR" = "$NEW_SHA" ]; then echo "==> Сайт вже оновлений. Нічого робити не треба."; exit 0; fi
if ! echo " $OK_SHAS " | grep -q " $CUR " && [ "${FORCE:-0}" != "1" ]; then
  echo "!! index.html на сервері відрізняється від версії, на якій робились правки"
  echo "!! (можливо, хтось змінив сайт). Нічого не змінено. Надішліть цей вивід розробнику."
  exit 2
fi

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
echo "==> Завантажую нові файли..."
curl -fsSL "$RAW/index.html" -o "$TMP/index.html"
mkdir -p "$TMP/oph"
for f in cataract.jpg children.jpg diagnostics.jpg; do curl -fsSL "$RAW/oph/$f" -o "$TMP/oph/$f"; done
[ "$(norm "$TMP/index.html")" = "$NEW_SHA" ] || { echo "!! Завантажений файл пошкоджений. Нічого не змінено."; exit 3; }
echo "==> Завантажую фото лікарів зі старого сайту на свій сервер..."
mkdir -p "$TMP/team"; OLD="${ESU_OLD:-https://www.esu-center.com.ua/wp-content/uploads}"
while read -r url name; do
  curl -fsSL --retry 3 "$OLD/$url" -o "$TMP/team/$name" || { echo "!! Не вдалося завантажити $url. Нічого не змінено."; exit 4; }
  head -c 3 "$TMP/team/$name" | od -An -tx1 | grep -q "ff d8 ff" || { echo "!! $name — не JPEG. Нічого не змінено."; exit 4; }
  echo "    $name OK ($(stat -c %s "$TMP/team/$name") байт)"
done <<'LIST'
2019/12/2.jpg toporkov.jpg
2019/12/3.jpg telychko.jpg
2019/12/IMG_2145-e1531905118978.jpg valenko.jpg
2020/02/skvirskaya.jpg abramova.jpg
LIST
grep -q "GTM-KD8Q4DQZ" "$TMP/index.html" && grep -q 'id="ophthalmology"' "$TMP/index.html"

STAMP=$(date +%Y%m%d-%H%M%S); BK="/root/esutomograf-backup-$STAMP"
echo "==> Резервна копія: $BK"
mkdir -p "$BK"; cp -a "$ROOT/index.html" "$BK/"; [ -d "$ROOT/oph" ] && cp -a "$ROOT/oph" "$BK/" || true; [ -d "$ROOT/team" ] && cp -a "$ROOT/team" "$BK/" || true

OWN=$(stat -c '%U:%G' "$ROOT/index.html"); MODE=$(stat -c '%a' "$ROOT/index.html")
mkdir -p "$ROOT/oph" "$ROOT/team"
install -m 644 "$TMP"/team/*.jpg "$ROOT/team/"; chown -R "$OWN" "$ROOT/team"; chmod 755 "$ROOT/team"
install -m "$MODE" "$TMP/index.html" "$ROOT/index.html.new" && mv -f "$ROOT/index.html.new" "$ROOT/index.html"
install -m 644 "$TMP"/oph/*.jpg "$ROOT/oph/"
chown "$OWN" "$ROOT/index.html"; chown -R "$OWN" "$ROOT/oph"; chmod 755 "$ROOT/oph"

echo "==> Перевірка через nginx..."
code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: esutomograf.com' http://127.0.0.1/team/toporkov.jpg || true)
echo "    team/toporkov.jpg -> HTTP $code"
echo
echo "ГОТОВО. Сайт оновлено. Відкат, якщо знадобиться:"
echo "  cp -a $BK/index.html $ROOT/index.html"
