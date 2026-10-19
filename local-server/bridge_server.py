import json
import re
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 8785
PLAMO_BASE = "http://127.0.0.1:8766"
PLAMO_URL = PLAMO_BASE + "/completion"
MAX_REQUEST_BYTES = 16_384
CHROME_EXTENSION_ORIGIN = re.compile(r"^chrome-extension://[a-p]{32}$")


def origin_is_allowed(origin: str) -> bool:
    """Allow local CLI clients without Origin and browser extension origins only."""
    return not origin or bool(CHROME_EXTENSION_ORIGIN.fullmatch(origin))

PREFIX = """<|plamo:op|>dataset
translation

<|plamo:op|>input lang=Japanese
"""
SUFFIX = "\n<|plamo:op|>output lang=English\n"


def build_prompt(text: str) -> str:
    clean = str(text or "").strip()
    if not clean:
        raise ValueError("Empty Japanese utterance")
    return PREFIX + clean + SUFFIX


def clean_translation(raw: str, source_text: str = "") -> str:
    text = str(raw or "").replace("\r", "").strip()
    text = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", text)
    markers = ("<|plamo:op|>", "input lang=Japanese", "output lang=English", "dataset", "translation")
    for marker in markers:
        text = text.replace(marker, " ")
    text = re.sub(r"<\|[^>]+\|>", " ", text)
    source = str(source_text or "").strip()
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if source:
        lines = [line for line in lines if line != source]
    text = " ".join(lines)
    # PLaMo should return only the English answer; discard accidental CLI/help text.
    text = re.sub(r"\s*(?:Instruction|System prompt)\s*:.*$", "", text, flags=re.I | re.S).strip()
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def call_plamo(text: str):
    prompt = build_prompt(text)
    payload = {
        "prompt": prompt,
        "n_predict": 40,
        "temperature": 0,
        "top_p": 1.0,
        "cache_prompt": True,
        "stream": False,
        "stop": ["<|plamo:op|>", "\n<|plamo:op|>"],
    }
    req = urllib.request.Request(
        PLAMO_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    elapsed = int((time.perf_counter() - started) * 1000)
    translation = clean_translation(data.get("content") or "", text)
    if not translation:
        raise RuntimeError("PLaMo returned an empty translation")
    return translation, elapsed


def json_response(handler, status, payload):
    body = b"" if status == 204 else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    origin = handler.headers.get("Origin", "")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    if origin and CHROME_EXTENSION_ORIGIN.fullmatch(origin):
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")
        handler.send_header("Access-Control-Allow-Headers", "Content-Type")
        handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    if status != 204:
        handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    server_version = "JP-Live-PLaMo-Bridge/0.9.4"

    def reject_untrusted_origin(self):
        origin = self.headers.get("Origin", "")
        if not origin_is_allowed(origin):
            json_response(self, 403, {"ok": False, "error": "Only local clients and browser extension origins are allowed."})
            return True
        return False

    def do_OPTIONS(self):
        if self.reject_untrusted_origin():
            return
        json_response(self, 204, {})

    def do_GET(self):
        if self.reject_untrusted_origin():
            return
        if self.path == "/health":
            try:
                with urllib.request.urlopen(PLAMO_BASE + "/health", timeout=3) as resp:
                    plamo = json.loads(resp.read().decode("utf-8"))
                json_response(self, 200, {"ok": True, "provider": "plamo-local", "bridge": "0.9.4", "plamo": plamo})
            except Exception as exc:
                json_response(self, 503, {"ok": False, "error": str(exc)})
            return
        if self.path == "/version":
            json_response(self, 200, {"bridge": "0.9.4", "provider": "plamo-local", "port": PORT})
            return
        json_response(self, 404, {"ok": False, "error": "Not found"})

    def do_POST(self):
        if self.reject_untrusted_origin():
            return
        if self.path != "/translate":
            json_response(self, 404, {"ok": False, "error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 0 or length > MAX_REQUEST_BYTES:
                json_response(self, 413, {"ok": False, "error": "Request body is too large."})
                return
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            text = str(payload.get("text") or "").strip()
            if not text:
                json_response(self, 400, {"ok": False, "error": "Empty utterance"})
                return
            translation, latency_ms = call_plamo(text)
            json_response(self, 200, {
                "translation": translation,
                "provider": "plamo-local",
                "model": "plamo-2-translate-local",
                "latency_ms": latency_ms,
                "speaker": str(payload.get("speaker") or ""),
            })
            # Log timing only; never write meeting transcript or translation text to console logs.
            print(f"[{time.strftime('%H:%M:%S')}] translate {latency_ms}ms | {len(text)} source characters", flush=True)
        except Exception as exc:
            print(f"[{time.strftime('%H:%M:%S')}] translate ERROR: {exc}", flush=True)
            json_response(self, 503, {
                "ok": False,
                "detail": {"message": "Local PLaMo translation is unavailable.", "reason": str(exc), "retry_after_ms": 1200},
            })

    def log_message(self, fmt, *args):
        print(f"[{time.strftime('%H:%M:%S')}] {fmt % args}", flush=True)


if __name__ == "__main__":
    print(f"JP Live PLaMo bridge 0.9.4 listening on http://{HOST}:{PORT}")
    print(f"PLaMo backend: {PLAMO_BASE}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
