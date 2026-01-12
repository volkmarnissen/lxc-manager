# Vorschlag: skip_if_all_missing für Templates 101-199

## Übersicht

Alle Templates in der Range 101-199 sollen optional werden und `skip_if_all_missing` verwenden, um automatisch übersprungen zu werden, wenn kritische Parameter fehlen.

**Wichtig**: `skip_if_all_missing` bedeutet: Skip nur wenn **ALLE** angegebenen Parameter fehlen. Wenn mindestens einer vorhanden ist, wird das Template ausgeführt.

## Schnellübersicht

| Template | skip_if_all_missing | Besonderheit |
|----------|---------------------|--------------|
| 104-lxc-static-ip-prefix.json | `["ip4_prefix", "ip6_prefix"]` | ✅ Skip wenn beide fehlen |
| 105-set-static-ip-for-lxc.json | `["static_ip", "static_ip6"]` | ✅ Skip wenn beide fehlen |
| 106-update-etc-hosts-on-ve.json | `["hostname"]` | ✅ Standard |
| 110-map-serial.json | - | ✅ Bereits durch `if` gehandhabt |
| 120-mount-disk-on-host.json | `["storage_selection"]` | ✅ Standard |
| 121-mount-zfs-pool-on-host.json | `["storage_selection"]` | ✅ Standard |
| 160-bind-multiple-volumes-to-lxc.json | `["volumes"]` | ✅ Bereits implementiert |
| 170-set-environment-variables-in-lxc.json | `["envs"]` | ✅ Standard |

## Wichtigste Erkenntnis

**Lösung**: `skip_if_all_missing` wurde implementiert mit "skip wenn ALLE fehlen" Logik:
- Ein einzelner Parameter: Skip wenn dieser fehlt
- Mehrere Parameter: Skip nur wenn alle fehlen (mindestens einer muss vorhanden sein)

Das ist perfekt für Templates 104 und 105, die "mindestens einer muss vorhanden sein" benötigen.

## Analyse der Templates

### 104-lxc-static-ip-prefix.json
**Zweck**: Berechnet statische IPv4/IPv6-Adressen aus Prefixen und VMID

**Kritische Parameter**: 
- Mindestens einer von `ip4_prefix` oder `ip6_prefix` muss vorhanden sein
- Wenn beide fehlen, sollte das Template übersprungen werden

**Vorschlag**:
```json
{
  "skip_if_all_missing": ["ip4_prefix", "ip6_prefix"]
}
```
**Logik**: Wenn beide Parameter fehlen → skip. Wenn mindestens einer vorhanden ist → ausführen. ✅ Perfekt für diese Anforderung!

**Hinweis**: Die aktuelle Implementierung prüft, ob Parameter in `resolvedParams` existieren. Da `ip4_prefix` und `ip6_prefix` optional sind und `if: "use_static_ip"` haben, könnte eine alternative Logik nötig sein: Prüfe ob `use_static_ip` true ist, oder prüfe ob mindestens einer der Prefixe vorhanden ist.

**Besserer Ansatz**: Prüfe ob `use_static_ip` Output von einem vorherigen Template vorhanden ist, oder prüfe ob mindestens einer der Prefixe vorhanden ist.

### 105-set-static-ip-for-lxc.json
**Zweck**: Setzt statische IP-Adressen für einen LXC Container

**Kritische Parameter**:
- Mindestens einer von `static_ip` oder `static_ip6` muss vorhanden sein
- Wenn beide fehlen, sollte das Template übersprungen werden

**Vorschlag**:
```json
{
  "skip_if_all_missing": ["static_ip", "static_ip6"]
}
```
**Logik**: Wenn beide Parameter fehlen → skip. Wenn mindestens einer vorhanden ist → ausführen. ✅ Perfekt für diese Anforderung!

**Hinweis**: Ähnlich wie bei 104 - die aktuelle Implementierung prüft nur, ob Parameter in `resolvedParams` existieren. Hier sollten wir prüfen, ob mindestens einer vorhanden ist.

### 106-update-etc-hosts-on-ve.json
**Zweck**: Aktualisiert /etc/hosts auf dem VE-Host mit Hostname und statischen IP-Adressen

**Kritische Parameter**:
- `hostname` ist erforderlich
- Mindestens einer von `static_ip` oder `static_ip6` sollte vorhanden sein (optional, aber sinnvoll)

**Vorschlag**:
```json
{
  "skip_if_all_missing": ["hostname"]
}
```
**Alternative** (wenn IP-Adressen auch erforderlich sein sollen):
```json
{
  "skip_if_missing": ["hostname", "static_ip", "static_ip6"]
}
```
**Empfehlung**: Nur `hostname` prüfen, da IP-Adressen optional sind (laut Beschreibung).

### 110-map-serial.json
**Zweck**: Mappt ein Serial Device zu einem VM

**Kritische Parameter**:
- `usb` (boolean) - wenn false, wird das Command sowieso durch `if: "{{ usb }}"` übersprungen

**Vorschlag**:
```json
{
  "skip_if_all_missing": ["usb"]
}
```
**Oder besser**: Prüfe ob `usb` true ist. Aber da `usb` einen Default-Wert (`false`) hat, wird es immer in `resolvedParams` sein.

**Alternative**: Kein `skip_if_missing` nötig, da das Command bereits `if: "{{ usb }}"` hat. Das Template könnte trotzdem ausgeführt werden, aber das Command wird übersprungen.

**Empfehlung**: Kein `skip_if_missing` nötig, da bereits durch `if` im Command gehandhabt.

### 120-mount-disk-on-host.json
**Zweck**: Mountet ein Block-Device (per UUID) auf dem Proxmox Host

**Kritische Parameter**:
- `storage_selection` - muss vorhanden sein und sollte `uuid:` sein (nicht `zfs:`)

**Vorschlag**:
```json
{
  "skip_if_missing": ["storage_selection"]
}
```
**Hinweis**: Das Script `mount-disk.sh` prüft bereits, ob `storage_selection` mit `zfs:` beginnt und beendet dann erfolgreich. Das Template könnte trotzdem ausgeführt werden, aber das Script würde nichts tun.

**Alternative**: Kein `skip_if_missing` nötig, da das Script bereits ZFS-Pools erkennt und überspringt.

**Empfehlung**: `skip_if_missing` hinzufügen, um das Template komplett zu überspringen, wenn keine Storage-Auswahl getroffen wurde.

### 121-mount-zfs-pool-on-host.json
**Zweck**: Erstellt ein Unterverzeichnis unter einem ZFS-Pool-Mountpoint

**Kritische Parameter**:
- `storage_selection` - muss vorhanden sein und sollte `zfs:` sein (nicht `uuid:`)

**Vorschlag**:
```json
{
  "skip_if_missing": ["storage_selection"]
}
```
**Hinweis**: Ähnlich wie 120 - das Script sollte prüfen, ob es ein ZFS-Pool ist. Aber für Konsistenz sollten wir `skip_if_missing` hinzufügen.

**Empfehlung**: `skip_if_missing` hinzufügen.

### 160-bind-multiple-volumes-to-lxc.json
**Zweck**: Bindet mehrere Host-Verzeichnisse zu einem LXC Container

**Kritische Parameter**:
- `volumes` - muss vorhanden sein

**Status**: ✅ Bereits implementiert
```json
{
  "skip_if_missing": ["volumes"]
}
```

### 170-set-environment-variables-in-lxc.json
**Zweck**: Setzt Umgebungsvariablen in der LXC Container-Konfiguration

**Kritische Parameter**:
- `envs` - muss vorhanden sein

**Vorschlag**:
```json
{
  "skip_if_all_missing": ["envs"]
}
```

## Zusammenfassung der Vorschläge

| Template | skip_if_missing | Begründung |
|----------|-----------------|------------|
| 104-lxc-static-ip-prefix.json | `["ip4_prefix", "ip6_prefix"]` | Mindestens einer muss vorhanden sein |
| 105-set-static-ip-for-lxc.json | `["static_ip", "static_ip6"]` | Mindestens einer muss vorhanden sein |
| 106-update-etc-hosts-on-ve.json | `["hostname"]` | Hostname ist erforderlich |
| 110-map-serial.json | - | Bereits durch `if: "{{ usb }}"` im Command gehandhabt |
| 120-mount-disk-on-host.json | `["storage_selection"]` | Storage-Auswahl ist erforderlich |
| 121-mount-zfs-pool-on-host.json | `["storage_selection"]` | Storage-Auswahl ist erforderlich |
| 160-bind-multiple-volumes-to-lxc.json | `["volumes"]` | ✅ Bereits implementiert |
| 170-set-environment-variables-in-lxc.json | `["envs"]` | Umgebungsvariablen sind erforderlich |

## Wichtige Überlegungen

### Problem: "Mindestens einer von mehreren"

Die aktuelle Implementierung prüft, ob **alle** Parameter in `skip_if_missing` vorhanden sind. Für Templates wie 104 und 105 benötigen wir aber eine "OR"-Logik: **mindestens einer** muss vorhanden sein.

**Lösungsvorschläge**:

1. **Erweiterte Syntax** (komplexer):
```json
{
  "skip_if_missing": {
    "any": ["ip4_prefix", "ip6_prefix"]  // Mindestens einer muss vorhanden sein
  }
}
```

2. **Separate Property** (einfacher):
```json
{
  "skip_if_missing": ["ip4_prefix", "ip6_prefix"],
  "skip_if_missing_any": true  // Wenn true, prüfe "mindestens einer", sonst "alle"
}
```

3. **Aktuelle Implementierung erweitern** (empfohlen):
   - Wenn alle Parameter in `skip_if_missing` fehlen → skip
   - Wenn mindestens einer vorhanden ist → ausführen
   - Das ist bereits die gewünschte Logik für "OR"!

**Aktuelle Logik prüft**: "Wenn ein Parameter fehlt → skip"
**Gewünschte Logik für 104/105**: "Wenn alle Parameter fehlen → skip"

**Lösung**: Die aktuelle Implementierung muss angepasst werden:
```typescript
// Aktuell: skip wenn EINER fehlt
if (!resolved) {
  shouldSkip = true;
  break;
}

// Gewünscht für 104/105: skip wenn ALLE fehlen
let allMissing = true;
for (const paramId of tmplData.skip_if_missing) {
  const resolved = opts.resolvedParams.find((p) => p.id === paramId);
  if (resolved) {
    allMissing = false;
    break;
  }
}
if (allMissing) {
  shouldSkip = true;
}
```

**Empfehlung**: Neue Property `skip_if_all_missing` hinzufügen:
- `skip_if_missing`: Skip wenn **einer** fehlt (Standard, "AND"-Logik)
- `skip_if_all_missing`: Skip wenn **alle** fehlen ("OR"-Logik)

## Empfohlene Implementierung

### Option A: Zwei Properties (flexibel)

```json
{
  "skip_if_missing": ["ip4_prefix", "ip6_prefix"],
  "skip_if_all_missing": true  // Skip nur wenn ALLE fehlen
}
```

### Option B: Erweiterte Syntax (einfacher für Benutzer)

```json
{
  "skip_if_missing": {
    "any": ["ip4_prefix", "ip6_prefix"]  // Mindestens einer muss vorhanden sein
  }
}
// oder
{
  "skip_if_missing": ["volumes"]  // Standard: alle müssen vorhanden sein
}
```

### Option C: Aktuelle Logik beibehalten, aber Dokumentation anpassen

Für Templates 104 und 105: Wenn beide Parameter fehlen, wird das Template übersprungen. Das ist bereits die gewünschte Logik!

**Aber**: Die aktuelle Implementierung prüft "wenn einer fehlt → skip", nicht "wenn alle fehlen → skip".

## Finale Empfehlung

### Einfache Lösung (ohne Schema-Änderung)

Für Templates, die "mindestens einer muss vorhanden sein" benötigen (104, 105), können wir die aktuelle Logik nutzen, indem wir **kein** `skip_if_missing` setzen und stattdessen die Templates so gestalten, dass sie mit fehlenden Parametern umgehen können.

**Aber**: Das ist nicht ideal, da wir explizit machen wollen, dass Templates optional sind.

### Empfohlene Lösung: Neue Property `skip_if_all_missing`

Erweitere das Schema um eine zusätzliche Property:

```json
{
  "skip_if_missing": ["ip4_prefix", "ip6_prefix"],
  "skip_if_all_missing": true  // Skip nur wenn ALLE Parameter fehlen
}
```

**Verhalten**:
- Wenn `skip_if_all_missing: true`: Skip wenn **alle** Parameter in `skip_if_missing` fehlen
- Wenn `skip_if_all_missing` nicht gesetzt oder `false`: Skip wenn **einer** der Parameter fehlt (Standard)

### Konkrete Vorschläge für alle Templates

| Template | skip_if_all_missing | Begründung |
|----------|---------------------|------------|
| 104-lxc-static-ip-prefix.json | `["ip4_prefix", "ip6_prefix"]` | Skip nur wenn beide fehlen |
| 105-set-static-ip-for-lxc.json | `["static_ip", "static_ip6"]` | Skip nur wenn beide fehlen |
| 106-update-etc-hosts-on-ve.json | `["hostname"]` | Hostname ist erforderlich |
| 110-map-serial.json | - | Bereits durch `if: "{{ usb }}"` gehandhabt |
| 120-mount-disk-on-host.json | `["storage_selection"]` | Storage-Auswahl ist erforderlich |
| 121-mount-zfs-pool-on-host.json | `["storage_selection"]` | Storage-Auswahl ist erforderlich |
| 160-bind-multiple-volumes-to-lxc.json | `["volumes"]` | ✅ Bereits implementiert |
| 170-set-environment-variables-in-lxc.json | `["envs"]` | Umgebungsvariablen sind erforderlich |

### Alternative: Einfacher Ansatz ohne Schema-Erweiterung

Wenn wir keine neue Property hinzufügen wollen, können wir für Templates 104 und 105 einfach **kein** `skip_if_missing` setzen und stattdessen die Templates so gestalten, dass sie mit fehlenden Parametern umgehen (z.B. durch Default-Werte oder durch Prüfung im Script).

**Aber**: Das widerspricht dem Ziel, Templates explizit als optional zu markieren.

### Empfehlung

**Option 1 (Bevorzugt)**: Neue Property `skip_if_all_missing` hinzufügen
- Explizit und klar
- Flexibel für beide Fälle
- Rückwärtskompatibel

**Option 2 (Einfacher)**: Für Templates 104 und 105 kein `skip_if_missing` setzen
- Keine Schema-Änderung nötig
- Templates müssen selbst mit fehlenden Parametern umgehen
- Weniger explizit

