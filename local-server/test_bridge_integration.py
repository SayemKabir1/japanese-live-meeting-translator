import json
import threading
import time
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parent
TEST_PLAMO_PORT = 18766
TEST_BRIDGE_PORT = 18785

class StubPLaMo(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            body = json.dumps({'status':'ok'}).encode()
            self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body); return
        self.send_response(404); self.end_headers()
    def do_POST(self):
        if self.path != '/completion': self.send_response(404); self.end_headers(); return
        n=int(self.headers.get('Content-Length','0')); payload=json.loads(self.rfile.read(n))
        prompt=payload['prompt']
        text=prompt.split('<|plamo:op|>input lang=Japanese\n',1)[1].split('\n<|plamo:op|>output lang=English',1)[0].strip()
        body=json.dumps({'content':'Could you verify the specifications?' if '仕様書' in text else 'EN:'+text}, ensure_ascii=False).encode()
        self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self,*args): pass

stub=ThreadingHTTPServer(('127.0.0.1',TEST_PLAMO_PORT),StubPLaMo)
threading.Thread(target=stub.serve_forever,daemon=True).start()

spec=importlib.util.spec_from_file_location('bridge', ROOT/'bridge_server.py')
bridge=importlib.util.module_from_spec(spec); spec.loader.exec_module(bridge)
bridge.HOST='127.0.0.1'; bridge.PORT=TEST_BRIDGE_PORT; bridge.PLAMO_BASE=f'http://127.0.0.1:{TEST_PLAMO_PORT}'; bridge.PLAMO_URL=bridge.PLAMO_BASE+'/completion'
server=ThreadingHTTPServer(('127.0.0.1',TEST_BRIDGE_PORT), bridge.Handler)
threading.Thread(target=server.serve_forever,daemon=True).start(); time.sleep(0.2)

try:
    with urllib.request.urlopen(f'http://127.0.0.1:{TEST_BRIDGE_PORT}/health',timeout=3) as r: health=json.loads(r.read())
    assert health['ok'] is True
    req=urllib.request.Request(f'http://127.0.0.1:{TEST_BRIDGE_PORT}/translate',data=json.dumps({'text':'仕様書について確認させてください。','speaker':'Interviewee'}, ensure_ascii=False).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=3) as r: out=json.loads(r.read())
    assert out['translation']=='Could you verify the specifications?'
    # Browser pages from unrelated origins must not trigger local model work.
    evil=urllib.request.Request(f'http://127.0.0.1:{TEST_BRIDGE_PORT}/health',headers={'Origin':'https://example.com'})
    try:
        urllib.request.urlopen(evil,timeout=3)
        raise AssertionError('untrusted web origin was not blocked')
    except urllib.error.HTTPError as exc:
        assert exc.code==403
    extension_origin='chrome-extension://abcdefghijklmnopabcdefghijklmnop'
    extension=urllib.request.Request(f'http://127.0.0.1:{TEST_BRIDGE_PORT}/health',headers={'Origin':extension_origin})
    with urllib.request.urlopen(extension,timeout=3) as r:
        assert r.headers.get('Access-Control-Allow-Origin')==extension_origin
    preflight=urllib.request.Request(f'http://127.0.0.1:{TEST_BRIDGE_PORT}/translate',method='OPTIONS',headers={'Origin':extension_origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'})
    with urllib.request.urlopen(preflight,timeout=3) as r:
        assert r.status==204 and r.headers.get('Access-Control-Allow-Origin')==extension_origin and r.headers.get('Content-Length')=='0'
    print('bridge HTTP integration + origin restriction + preflight: PASS')
finally:
    server.shutdown(); stub.shutdown()
