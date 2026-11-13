#!/usr/bin/env bash
# ophthalmology-group.online: нові тексти (катаракта, дитяча офтальмологія, діагностика),
# GTM на всіх сторінках, виправлення перемикача мов (404). Оновлює і готовий сайт (dist), і вихідники.
set -euo pipefail
RAW="https://raw.githubusercontent.com/GreSH1i/my-website/deploy"
P=/var/www/oftam_center_dnipro_new; D="$P/dist"
EXPECT="55c5427852bd37447a21a6f8816bc868020d1906d77f5aaff11fdb92bc47da97"
[ -d "$D" ] && [ -f "$P/package.json" ] || { echo "!! Не знайдено $D. Нічого не змінено."; exit 1; }

manifest() { python3 - "$1" <<'PY'
import os,sys,hashlib
L=sys.argv[1]; h=hashlib.sha256()
for root,_,files in sorted(os.walk(L)):
    for f in sorted(files):
        p=os.path.join(root,f); r=os.path.relpath(p,L)
        h.update((r+' '+hashlib.sha256(open(p,'rb').read()).hexdigest()+'\n').encode())
print(h.hexdigest())
PY
}
echo "==> Перевіряю, що сайт не змінювався..."
CUR=$(manifest "$D")
if grep -q "GTM-KD8Q4DQZ" "$D/uk/index.html" 2>/dev/null; then echo "==> Схоже, оновлення вже встановлене. Нічого не змінено."; exit 0; fi
if [ "$CUR" != "$EXPECT" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "!! Файли сайту відрізняються від тих, що я отримав. Нічого не змінено. Надішліть цей вивід розробнику."; exit 2
fi

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
echo "==> Завантажую оновлення..."
curl -fsSL "$RAW/og-dist-update.tar.gz" -o "$TMP/dist.tgz"
curl -fsSL "$RAW/og-src-update.tar.gz" -o "$TMP/src.tgz"
tar tzf "$TMP/dist.tgz" >/dev/null && tar tzf "$TMP/src.tgz" >/dev/null

STAMP=$(date +%Y%m%d-%H%M%S); BK="/root/og-backup-$STAMP"; mkdir -p "$BK"
echo "==> Резервна копія: $BK"
cp -a "$D" "$BK/dist"
( cd "$P" && tar czf "$BK/src-before.tar.gz" $(tar tzf "$TMP/src.tgz" | while read -r f; do [ -e "$f" ] && echo "$f"; done) 2>/dev/null || true )

OWN=$(stat -c '%U:%G' "$D/uk/index.html")
echo "==> Оновлюю сайт..."
tar xzf "$TMP/dist.tgz" -C "$D" --no-same-owner
chown -R "$OWN" "$D"
tar xzf "$TMP/src.tgz" -C "$P" --no-same-owner
chown -R "$(stat -c '%U:%G' "$P/package.json")" "$P/src" "$P/public"

echo "==> Перевірка..."
c=$(grep -l "GTM-KD8Q4DQZ" -r "$D" --include=*.html | wc -l); t=$(find "$D" -name '*.html' | wc -l)
echo "    GTM на сторінках: $c з $t"
grep -q 'href="/uk/poslugy/katarakta/"' "$D/ru/uslugi/katarakta/index.html" && echo "    Перемикач мов: OK"
grep -q "Bunny Lens" "$D/uk/poslugy/katarakta/index.html" && echo "    Нові тексти: OK"
echo
echo "ГОТОВО. Відкат, якщо знадобиться:"
echo "  rm -rf $D && cp -a $BK/dist $D"
