#!/bin/bash
# Выпуск версии пульта «Ядро + Масло».
# Порядок жёсткий, падение на любом шаге останавливает остальные:
#   тесты -> бэкап папки -> сборка однофайлового снимка -> коммит -> пуш -> проверка живой страницы
set -euo pipefail

PROJ="$(cd "$(dirname "$0")" && pwd)"
PARENT="$(dirname "$PROJ")"
BACKUP="$PARENT/_backup_yadro"
STAMP="$(date +%Y-%m-%d_%H%M)"
SNAP="$PARENT/yadro-maslo-pult_${STAMP}.html"
LAST="$PARENT/yadro-maslo-pult_ПОСЛЕДНЯЯ.html"
URL="https://gorbatovroman86-coder.github.io/yadro-maslo-pult"
MSG="${1:-}"

step() { printf '\n=== %s ===\n' "$1"; }

step "1/6 инварианты"
node "$PROJ/tests.js" > /tmp/tests.out || { tail -3 /tmp/tests.out; echo "ТЕСТЫ НЕ ПРОШЛИ — выпуск остановлен"; exit 1; }
tail -1 /tmp/tests.out

step "2/6 бэкап рабочей папки"
mkdir -p "$BACKUP"
DEST="$BACKUP/$STAMP"
rsync -a --exclude '.git' --exclude '__pycache__' --exclude '_backup_yadro' \
      --exclude '*.bak' "$PROJ/" "$DEST/"
echo "скопировано в $DEST:"
ls -1 "$DEST" | sed 's/^/  /'
# храним последние 10
ls -1dt "$BACKUP"/*/ 2>/dev/null | tail -n +11 | while read -r old; do rm -rf "$old"; echo "удалён старый бэкап: $(basename "$old")"; done
echo "версий в бэкапе: $(ls -1d "$BACKUP"/*/ 2>/dev/null | wc -l | tr -d ' ')"

step "3/6 однофайловый снимок"
TMP="$(mktemp /tmp/pult_snap_XXXX.html)"
node "$PROJ/build_single.js" "$TMP"
[ -s "$TMP" ] || { echo "снимок пуст — старые файлы не тронуты"; rm -f "$TMP"; exit 1; }
mv "$TMP" "$SNAP"
cp "$SNAP" "$LAST"
echo "снимок: $SNAP ($(du -h "$SNAP" | cut -f1))"
echo "копия:  $LAST"

step "4/6 коммит"
cd "$PROJ"
if [ -z "$(git status --porcelain)" ]; then
  echo "изменений нет, коммит пропущен"
else
  [ -n "$MSG" ] || { echo "нужен текст коммита: ./release.sh \"текст\""; exit 1; }
  git add -A
  git -c user.name="gorbatovroman86-coder" -c user.email="gorbatovroman86@gmail.com" commit -q -m "$MSG"
  echo "$(git log --oneline -1)"
fi

step "5/6 пуш"
git push -q origin main
echo "запушено"

step "6/6 проверка живой страницы"
V="$(grep -o 'ui\.js?v=[0-9]*' "$PROJ/index.html" | head -1 | sed 's/.*v=//')"
for i in $(seq 1 24); do
  if curl -s "$URL/" | grep -q "v=$V"; then echo "версия v=$V на Pages (попытка $i)"; break; fi
  [ "$i" = 24 ] && { echo "страница не обновилась за 6 минут"; exit 1; }
  sleep 15
done
CODE="$(curl -s -o /dev/null -w '%{http_code}' "$URL/")"
echo "живая страница отвечает: $CODE"
[ "$CODE" = "200" ] || exit 1
echo
echo "ВЫПУСК ЗАВЕРШЁН: $URL"
