# clearPanel setup nameserver fix (Copilot guide)

## Problem summary
During initial setup, the wizard sets `DATA_DIR` to the new per-user path (e.g. `/home/<user>/etc/clearpanel`) and writes `server-settings.json` there. But `ServerSettingsService` caches the first read from the default data dir (`/opt/clearpanel/data`). If the cache is already populated, subsequent reads ignore the new data dir, so the UI shows empty nameservers and missing `primaryDomain`.

## Root cause
`ServerSettingsService` cached settings without tracking the file path. When `DATA_DIR` changes, the cache stays pointed at the old file path.

## Fix (code)
Track the settings path in the cache and invalidate when `DATA_DIR` changes.

Patch location:
- `backend/src/server/server-settings.service.ts`

Change summary:
- Add `cachePath`.
- Only reuse cache when `cachePath === settingsPath`.
- Update `cachePath` after reads and writes.

## Fix (runtime)
After setup completes, restart the service once so it reloads `.env` and re-reads settings:

```
sudo systemctl restart clearpanel
```

## Validation
1. Confirm settings path is the per-user data dir:

```
cat /home/<user>/etc/clearpanel/server-settings.json
```

2. API should show nameservers:

```
curl -s http://localhost:3334/api/server/nameservers | jq
```

Expected:
- `primaryDomain` is set
- `nameservers` list populated
- `nameserverInfo` is non-null

## Symptom checklist
- UI shows: "No VPS nameservers configured"
- `/opt/clearpanel/data/server-settings.json` has empty nameservers
- `/home/<user>/etc/clearpanel/server-settings.json` has correct nameservers

## Optional note
Local tests may be misleading if `/etc/hosts` maps the domain to `127.0.1.1`. Use public DNS (`dig @8.8.8.8`) or remove that mapping during debugging.
