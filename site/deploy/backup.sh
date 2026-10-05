#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /root/docker/app/halo-butterfly-next
exec 9>operations/backup.lock
flock -n 9
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="backups/$stamp"
mkdir "$backup_dir"
# Quiesce only this app; never stop Caddy, other sites or the database.
trap 'docker compose start halo-butterfly-next >/dev/null' EXIT
docker compose stop -t 60 halo-butterfly-next
docker compose exec -T database pg_dump -U halo -d halo --format=custom > "$backup_dir/database.dump"
tar -czf "$backup_dir/halo-files.tar.gz" --exclude='halo2/logs' halo2
cp .env docker-compose.yml deployment-owner.json "$backup_dir/"
cp operations/credentials.json "$backup_dir/admin.json"
docker compose exec -T database pg_restore --list < "$backup_dir/database.dump" > "$backup_dir/database-contents.txt"
tar -tzf "$backup_dir/halo-files.tar.gz" > "$backup_dir/file-contents.txt"
sha256sum "$backup_dir/database.dump" "$backup_dir/halo-files.tar.gz" > "$backup_dir/SHA256SUMS"
docker compose start halo-butterfly-next
trap - EXIT
printf 'Backup saved on hk: %s\n' "$backup_dir"
