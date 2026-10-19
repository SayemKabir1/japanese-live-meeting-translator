# JP Live Meeting Translator

**Local Japanese → English live-caption translation for Google Meet and Zoom.**

JP Live Meeting Translator is a Windows-first Chrome extension that reads Japanese captions already rendered by the meeting page, filters for the interviewee's speech, and translates completed questions/utterances using a locally running PLaMo translation model through `llama.cpp`.

> **Status:** Public prototype / active development. Automated tests cover caption parsing, speaker filtering, utterance segmentation, bridge behavior, and package structure. Live Google Meet and Zoom DOM behavior can change and must be verified in your own browser. Translation quality and latency depend on your hardware, caption quality, and chosen model quantization.

## Features

- Japanese-to-English translation using a local PLaMo model; no Gemini API key is required.
- Chrome extension for Google Meet and Zoom Web.
- Interviewee-only capture; visible rows marked `You` are excluded.
- Rolling-caption deduplication and question/utterance stabilization to reduce fragment and duplicate translations.
- Separate translator popup window, so the UI is not embedded in the meeting tab.
- Per-translation copy control, clear, minimize/restore, close/reopen, and moveable window.
- Local bridge and model endpoints bound to `127.0.0.1`.
- A latency benchmark and regression tests.

## Architecture

```text
Google Meet / Zoom rendered captions
                │
                ▼
        Chrome content script
                │ completed interviewee utterance
                ▼
       Local bridge :8785
                │
                ▼
     llama.cpp server :8766
                │
                ▼
       PLaMo translation model
                │
                ▼
      Separate translator window
```

The extension does **not** capture microphone or tab audio. It reads text that the meeting app has already rendered as captions. If Meet's speech recognition misses or misrecognizes a name, the translator cannot reliably recover information that is absent from the source caption.

## Requirements

- Windows 10/11 (the provided launch scripts are Windows batch files).
- Google Chrome or a Chromium-based browser.
- `llama-server.exe` from [llama.cpp](https://github.com/ggml-org/llama.cpp).
- Python 3.10+ for the local bridge and Python tests.
- Node.js 20+ for JavaScript tests.
- Enough SSD space and system/GPU memory for your selected PLaMo GGUF quantization. The default fast profile uses `Q3_K_M`; the optional quality profile uses `Q4_K_S`.

The model is downloaded by llama.cpp from Hugging Face on first startup and is **not bundled in this repository**.

## Quick start (Windows)

### 1. Install llama.cpp

Install a Windows build of llama.cpp that includes `llama-server.exe` and supports the backend you intend to use (for example, Vulkan or CUDA). Make sure `llama-server.exe` is available in `PATH`, or set its full path in `LLAMA_SERVER_EXE`.

Example for Command Prompt:

```bat
set LLAMA_SERVER_EXE=C:\AI\llama-vulkan\llama-server.exe
```

Use the path where you actually installed llama.cpp. Do not assume the example path exists on your machine.

### 2. Start the local model and bridge

Extract the project and open Command Prompt in the project folder:

```bat
cd local-server
start_all.bat
```

The first start downloads the default model and may take several minutes. Wait for the message `ALL LOCAL SERVICES READY` before opening Meet.

Local endpoints:

- PLaMo model server: `http://127.0.0.1:8766`
- Translator bridge: `http://127.0.0.1:8785`

The bridge waits for the model server to become healthy. If another model is already using port 8766, stop that specific process or change the project configuration; do not terminate unrelated model servers.

### 3. Load the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project's `extension` directory.
5. Refresh the Google Meet/Zoom tab.
6. Enable Japanese captions in the meeting app.

### 4. Select the interviewee

Open extension options from Chrome's Extensions page. For one-to-one interviews, automatic first-remote-speaker selection may be sufficient. For panels or meetings with multiple remote speakers, select the interviewee by their exact displayed name. Verify the selected speaker before relying on the translation.

### 5. Benchmark latency

Once the local services are ready, open a second Command Prompt in `local-server` and run:

```bat
benchmark_speed.bat
```

The benchmark reports warm HTTP translation latency. It does not include Google Meet's speech-recognition delay or the caption stabilization interval.

### Stop the services

Run:

```bat
stop_all.bat
```

The stop script targets this app's PLaMo process on port 8766 and bridge process. It is designed not to terminate unrelated `llama-server.exe` instances such as a Qwen server on another port.

## Fast vs. quality model profile

- **Fast (default):** `Q3_K_M`, with maximum available layer offload and CPU KV cache. Lower quantization may reduce translation quality.
- **Quality:** `Q4_K_S`, launched with `local-server\start_server_quality.bat`. Stop the existing PLaMo server on port 8766 before switching profiles.

Model quantization changes speed and quality. The project does not claim 95% accuracy or a fixed latency guarantee; benchmark the sentences and terminology relevant to your meetings.

## Privacy and security

- Caption text is processed by the local bridge and model server bound to loopback (`127.0.0.1`). The extension does not send caption text to Gemini or another hosted translation API.
- The model download requires an internet connection the first time. Translation requests themselves are local after the model is present.
- The bridge only allows browser origins matching a Chrome extension origin; non-browser local clients without an `Origin` header are supported for tests and benchmarking.
- Bridge logs contain timing and character counts, not the full caption or translation text.
- The translator is a separate popup window, not part of the Meet page DOM. Sharing the Meet tab should not include that separate popup, but sharing the full desktop or the translator window can reveal its contents.
- Captions can contain personal or confidential meeting information. Obtain appropriate consent and follow your organization's policies before using or recording translated output.

## Tests

Run from a Windows Command Prompt at the repository root:

```bat
tests\run_all_tests.bat
```

This runs JavaScript syntax checks, Python compilation, deterministic unit tests, caption/utterance regression tests, queue/protocol tests, bridge tests, and package validation. Some optional browser fixtures require Chromium/Playwright and are not run by the basic batch file.

The included test report describes synthetic/unit/integration tests only. It is not a substitute for testing the current Meet DOM, speaker identification, end-to-end latency, or translation quality on your machine.

## License and model terms

The application source code in this repository is licensed under the **MIT License**. That license does not grant rights to third-party models or binaries.

PLaMo 2 Translate and the GGUF conversion used by the launch scripts have a separate **PLaMo Community License**. Read and accept the terms from the model publisher before downloading or using the model: [official PLaMo model card](https://huggingface.co/pfnet/plamo-2-translate) and [GGUF model repository](https://huggingface.co/mmnga/plamo-2-translate-gguf). The model repository notes special conditions for commercial use; this project is not legal advice.

`llama.cpp` is a separate dependency with its own license and distribution terms. It is not bundled here.

## Contributing

Bug reports and pull requests are welcome. Please include browser version, operating system, selected model quantization, and relevant redacted logs. Do not attach private meeting recordings, API keys, transcript data, or personally identifying content unless all participants have consented.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
