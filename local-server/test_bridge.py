import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('bridge_server', Path(__file__).with_name('bridge_server.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

assert mod.PORT == 8785
assert mod.origin_is_allowed('') is True
assert mod.origin_is_allowed('chrome-extension://abcdefghijklmnopabcdefghijklmnop') is True
assert mod.origin_is_allowed('https://example.com') is False
assert mod.build_prompt('仕様書について確認させてください。').endswith('<|plamo:op|>output lang=English\n')
assert 'Instruction' not in mod.build_prompt('こんにちは。')
assert mod.clean_translation('<|plamo:op|>output lang=English\nCould you verify the specifications.', '仕様書について確認させてください。').endswith('Could you verify the specifications.')
assert mod.clean_translation('Hello. Instruction: Translate the Japanese sentence...', 'こんにちは。') == 'Hello.'
print('bridge unit tests: 7/7 passed')
