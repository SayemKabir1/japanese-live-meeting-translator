import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'extension/manifest.json').read_text(encoding='utf-8'))
assert manifest['version']=='0.9.4'
required=[
'extension/manifest.json',
'extension/src/content.js',
'extension/src/interview-processor.js',
'extension/src/background.js',
'extension/translator-window.js',
'local-server/bridge_server.py',
]
for rel in required:
    assert (root/rel).exists(), rel
print('package validation: PASS')
