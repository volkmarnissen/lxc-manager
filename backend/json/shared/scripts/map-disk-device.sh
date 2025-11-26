used=$(pct config <CTID> | grep '^mp' | cut -d: -f1 | sed 's/mp//')
for i in $(seq 0 9); do
  if ! echo "$used" | grep -qw "$i"; then
    echo "mp$i"
    break
  fi
done
pct set {{ vm_id }} -${used} {{ disk_on_ve }},mp={{ mounted_path }},size={{ disk_size }}G,backup=0