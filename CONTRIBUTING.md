# Contributing

Thanks for helping improve JP Live Meeting Translator.

## Before opening a pull request

1. Keep changes focused and explain the user-visible problem being fixed.
2. Add or update deterministic tests for caption parsing, speaker filtering, deduplication, queues, or protocol changes.
3. Run `tests\run_all_tests.bat` on Windows, and report which checks passed.
4. Do not bundle model weights, private meeting videos, API keys, transcripts, or personal data.
5. If a test fixture needs a speaker, use generic names such as `Interviewee A` and `You`.
6. Document changes to the model profile, local ports, supported browser surfaces, and license requirements.

## Pull request description

Please include the issue being solved, a short implementation summary, tests executed, and any known risks or limitations.
