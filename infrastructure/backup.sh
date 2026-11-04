#!/bin/sh
# Daily database backup (runs inside the "backup" container).
set -eu
f="/backups/rq-$(date +%F).dump"
pg_dump -h db -U rq -Fc rq > "$f"
find /backups -name '*.dump' -mtime +14 -delete

send() {  # $1 = method, rest = curl form fields
  [ -n "${BOT_TOKEN:-}" ] || return 0
  m=$1; shift
  for id in $(echo "${SUPERADMIN_TELEGRAM_IDS:-}" | tr ',' ' '); do
    curl -fsS -m 60 "https://api.telegram.org/bot${BOT_TOKEN}/$m" -F "chat_id=$id" "$@" >/dev/null || true
  done
}

# off-server copy: the dump goes to super-admins in Telegram (bots may send files up to 50 MB)
size=$(wc -c < "$f")
if [ "$size" -lt 49000000 ]; then
  send sendDocument -F "document=@$f" -F "caption=Rusada QuizBot · резервная копия базы $(date +%F)"
else
  send sendMessage -F "text=Резервная копия $(date +%F) больше 50 МБ — скачайте её с сервера: $f"
fi

used=$(df -P /backups | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ "$used" -ge 80 ]; then
  send sendMessage -F "text=⚠️ Диск сервера Rusada QuizBot заполнен на ${used}%. Освободите место или увеличьте диск."
fi
