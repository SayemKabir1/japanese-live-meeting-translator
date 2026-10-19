# Small helper used only by manual debugging.
import json, time, urllib.request
for i in range(60):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8766/health', timeout=2) as r:
            print(json.loads(r.read()))
            raise SystemExit(0)
    except Exception as exc:
        if i == 59:
            print('PLaMo not ready:', exc)
            raise SystemExit(1)
        time.sleep(1)
