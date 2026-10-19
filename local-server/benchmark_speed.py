import json, statistics, time, urllib.request, urllib.error
URL = "http://127.0.0.1:8785/translate"
SAMPLES = [
    "何歳ですか？",
    "今はどこに住んでいますか？",
    "どのくらい日本語を勉強していますか？",
    "これまでどのような仕事をしてきましたか？",
    "この会社に応募した理由を教えてください。",
]
def translate(text):
    payload = json.dumps({"text": text, "speaker": "Benchmark"}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(URL, data=payload, headers={"Content-Type":"application/json"}, method="POST")
    t0=time.perf_counter()
    with urllib.request.urlopen(req, timeout=30) as r:
        data=json.loads(r.read().decode("utf-8"))
    wall=(time.perf_counter()-t0)*1000
    return data, wall
print("Warm PLaMo latency benchmark (the first request may include cache warm-up)")
try:
    with urllib.request.urlopen("http://127.0.0.1:8785/health", timeout=3) as r:
        print("Bridge health:", r.status)
except Exception as e:
    raise SystemExit(f"Bridge is unavailable: {e}\nStart local-server\\start_all.bat first.")
wall_times=[]; model_times=[]
for i,text in enumerate(SAMPLES,1):
    try:
        data, wall=translate(text)
        model=float(data.get("latency_ms", wall))
        wall_times.append(wall); model_times.append(model)
        print(f"[{i}/{len(SAMPLES)}] wall={wall:.0f} ms | model={model:.0f} ms")
        print(" JA:",text)
        print(" EN:",data.get("translation",""))
    except Exception as e:
        print(f"[{i}/{len(SAMPLES)}] ERROR: {e}")
if wall_times:
    measured=wall_times[1:] if len(wall_times)>1 else wall_times
    print("\nWarm request summary (excluding first request):")
    print(f"Average wall latency: {statistics.mean(measured):.0f} ms")
    print(f"Median wall latency:  {statistics.median(measured):.0f} ms")
    print(f"Average model latency:{statistics.mean(model_times[1:] or model_times):.0f} ms")
    print("Note: caption wait/debounce time is separate and not included in these HTTP timings.")
