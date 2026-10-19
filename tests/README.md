# Test guide

These deterministic tests cover caption text normalization, Meet-style caption extraction, speaker attribution, self-speech exclusion, rolling-caption deduplication, utterance/question boundaries, queue behavior, popup privacy architecture, and the local bridge protocol.

Run the primary suite on Windows from the repository root:

```bat
tests\run_all_tests.bat
```

The suite uses synthetic captions and mock translation responses. It does not require a live meeting or download a model. Live browser behavior and real-model latency must be tested locally.
