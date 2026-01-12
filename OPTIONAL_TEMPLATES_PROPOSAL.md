# Vorschlag: Optionale Templates (101-199)

## Anforderung

Templates in der Range 101-199 sollen "optional" werden. Wenn wichtige Parameter nicht gesetzt sind, sollen sie automatisch übersprungen werden.

Beispiel: `160-bind-multiple-volumes-to-lxc.json` soll übersprungen werden, wenn der `volumes` Parameter nicht gesetzt ist.

## Vorschlag 1: Schema-Erweiterung mit `skip_if_all_missing` (vereinfacht)

### Schema-Änderung

```json
{
  "$id": "template",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "template",
  "type": "object",
  "properties": {
    // ... bestehende Properties ...
    "skip_if_all_missing": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "List of parameter IDs. If ALL of these are missing or empty, the template will be skipped. If at least one parameter is present, the template will be executed. If this property is present (and not empty), the template is considered optional."
    },
    // ... rest of properties ...
  }
}
```

### Beispiel-Template

```json
{
  "name": "Bind Multiple Volumes to LXC",
  "description": "Binds multiple host directories to an LXC container.",
  "execute_on": "ve",
  "skip_if_all_missing": ["volumes"],
  "parameters": [
    {
      "id": "vm_id",
      "name": "ID of the LXC Container",
      "type": "string",
      "required": true,
      "description": "ID of the LXC container to which the volumes will be bound."
    },
    {
      "id": "volumes",
      "name": "Volumes",
      "type": "string",
      "required": true,
      "description": "Volume mappings in key=value format, one per line."
    }
  ],
  "commands": [
    {
      "script": "bind-multiple-volumes-to-lxc.sh"
    }
  ]
}
```

### Verhalten

1. Wenn `skip_if_all_missing` vorhanden und nicht leer ist:
   - Template ist optional
   - Prüfe die angegebenen Parameter
   - Wenn **ALLE** Parameter fehlen oder leer sind → Template wird übersprungen (kein Fehler)
   - Wenn **mindestens einer** vorhanden ist → Template wird ausgeführt

2. Wenn `skip_if_all_missing` nicht vorhanden ist:
   - Normales Verhalten: Fehlende required Parameter führen zu Fehler

**Wichtig**: Die Logik ist "skip wenn ALLE fehlen", nicht "skip wenn einer fehlt". Das bedeutet:
- Ein einzelner Parameter: Skip wenn dieser fehlt
- Mehrere Parameter: Skip nur wenn alle fehlen (mindestens einer muss vorhanden sein)

### Implementierung in TemplateProcessor

In `templateprocessor.mts`, Methode `#processTemplate`:

```typescript
private async #processTemplate(opts: IProcessTemplateOpts): Promise<void> {
  // ... bestehender Code zum Laden des Templates ...
  
  // Prüfe ob Template optional ist und übersprungen werden soll
  if (tmplData.skip_if_all_missing && tmplData.skip_if_all_missing.length > 0) {
    // Check if ALL required parameters are missing
    // Skip only if ALL parameters are missing. If at least one is present, execute the template.
    let allMissing = true;
    for (const paramId of tmplData.skip_if_all_missing) {
      const resolved = opts.resolvedParams.find((p) => p.id === paramId);
      
      // If at least one parameter is resolved, don't skip
      if (resolved) {
        allMissing = false;
        break;
      }
    }
    
    if (allMissing) {
      // Template überspringen - keine Fehler, keine Commands hinzufügen
      this.emit("message", {
        stderr: `Skipping optional template ${opts.templatename} - all required parameters missing`,
        result: null,
        exitCode: 0,
        command: String(opts.templatename || opts.template),
        execute_on: undefined,
        index: 0,
      });
      return;
    }
  }
  
  // ... rest of processing ...
}
```

## Vorschlag 2: Automatische Erkennung basierend auf Dateinamen (verworfen)

### Verhalten

- Templates mit Nummern 101-199 werden automatisch als optional behandelt
- Keine Schema-Änderung nötig
- Prüfung basierend auf Dateinamen-Pattern

**Nachteil**: Weniger explizit, schwerer zu verstehen, nicht flexibel

## Vorschlag 3: Automatische Erkennung basierend auf Dateinamen

### Verhalten

- Templates mit Nummern 101-199 werden automatisch als optional behandelt
- Keine Schema-Änderung nötig
- Prüfung basierend auf Dateinamen-Pattern

### Implementierung

```typescript
private isOptionalTemplate(templateName: string): boolean {
  const match = templateName.match(/^(\d+)-/);
  if (match) {
    const num = parseInt(match[1], 10);
    return num >= 101 && num <= 199;
  }
  return false;
}
```

**Nachteil**: Weniger explizit, schwerer zu verstehen

## Empfehlung: Vorschlag 1 (vereinfacht)

**Vorteile:**
- ✅ Explizit und selbstdokumentierend
- ✅ Flexibel: Kann spezifische Parameter angeben
- ✅ Rückwärtskompatibel (wenn `skip_if_missing` nicht vorhanden → normales Verhalten)
- ✅ Kann auch für Templates außerhalb 101-199 verwendet werden
- ✅ Einfach: Nur ein Property nötig, kein redundantes `optional: true`

**Nachteile:**
- ⚠️ Erfordert Schema-Änderung
- ⚠️ Erfordert Implementierung in TemplateProcessor

## Migration

Für bestehende Templates 101-199:
1. `skip_if_all_missing` hinzufügen mit den kritischen Parametern (z.B. `["volumes"]` für 160-bind-multiple-volumes-to-lxc.json)

## Beispiele für verschiedene Templates

### 160-bind-multiple-volumes-to-lxc.json
```json
{
  "skip_if_all_missing": ["volumes"]
}
```

### 110-map-serial.json
```json
{
  "skip_if_all_missing": ["usb"]
}
```
Oder: Wenn `usb: false`, wird das Template sowieso durch `if: "{{ usb }}"` übersprungen.

### 104-lxc-static-ip-prefix.json
```json
{
  "skip_if_all_missing": ["ip4_prefix", "ip6_prefix"]
}
```
Skip nur wenn beide Prefixe fehlen. Wenn mindestens einer vorhanden ist, wird das Template ausgeführt.

### 170-set-environment-variables-in-lxc.json
```json
{
  "skip_if_all_missing": ["envs"]
}
```

