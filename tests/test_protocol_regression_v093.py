from pathlib import Path
content = Path(__file__).resolve().parents[1].joinpath('extension/src/content.js').read_text(encoding='utf-8')
background = Path(__file__).resolve().parents[1].joinpath('extension/src/background.js').read_text(encoding='utf-8')
window = Path(__file__).resolve().parents[1].joinpath('extension/translator-window.js').read_text(encoding='utf-8')
assert 'const old=state.queue.shift()' not in content, 'translation queue must not silently drop older questions'
assert 'while(state.queue.length>2)' not in content
assert 'statusType' in content and 'statusType' in background and 'statusType' in window
assert 'SETTINGS_VERSION=12' in background
assert 'stabilityDelayMs:250' in background, 'new fast default must be 250 ms'
assert 'Math.max(150, Math.min(1200' in (Path(__file__).resolve().parents[1].joinpath('extension/src/interview-processor.js').read_text(encoding='utf-8')), 'processor must allow shorter stability delay' 
print('protocol regressions v0.9.4: PASS')
