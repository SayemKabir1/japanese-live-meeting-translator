from pathlib import Path
import json,re
root=Path(__file__).parents[1]
manifest=json.loads((root/'extension/manifest.json').read_text(encoding='utf-8'))
content=(root/'extension/src/content.js').read_text(encoding='utf-8')
background=(root/'extension/src/background.js').read_text(encoding='utf-8')
translator=(root/'extension/translator-window.js').read_text(encoding='utf-8')
assert 'windows' in manifest['permissions']
assert 'chrome.windows.create' in background
assert 'type:' in background and "'popup'" in background
assert 'TranslationOverlay' not in content
assert 'jp-live-translator-host' not in content
assert 'chrome.runtime.getURL(\'translator.html\')' in background
assert 'This translator window is outside the Meet tab' in translator
print('privacy/window architecture: 6/6 checks passed')
