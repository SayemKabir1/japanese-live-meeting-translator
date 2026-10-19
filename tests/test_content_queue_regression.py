from pathlib import Path

text = Path(__file__).resolve().parents[1].joinpath('extension/src/content.js').read_text(encoding='utf-8')
assert 'state.queue.shift();' not in text, 'pending translations must never be silently discarded'
assert 'Translation queue:' in text
assert 'while(state.queue.length>2)' not in text
print('content queue regression: PASS')
