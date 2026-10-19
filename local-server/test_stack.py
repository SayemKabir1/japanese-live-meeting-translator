import json
import sys
from urllib.request import Request, urlopen

BRIDGE = "http://127.0.0.1:8765"
PLAMO = "http://127.0.0.1:8766"


def get(url):
    with urlopen(url, timeout=5) as response:
        return response.status, json.loads(response.read().decode('utf-8'))


def post(url, payload):
    request = Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
    with urlopen(request, timeout=15) as response:
        return response.status, json.loads(response.read().decode('utf-8'))


def main():
    try:
        s, plamo = get(PLAMO + '/health')
        print('PLaMo health:', s, json.dumps(plamo, ensure_ascii=False))
    except Exception as exc:
        print('PLaMo health: FAILED:', exc)
        return 1

    try:
        s, bridge = get(BRIDGE + '/health')
        print('Bridge health:', s, json.dumps(bridge, ensure_ascii=False))
    except Exception as exc:
        print('Bridge health: FAILED:', exc)
        return 1

    try:
        s, result = post(BRIDGE + '/translate', {
            'text': '仕様書について確認させてください。',
            'platform': 'google_meet'
        })
        print('Translation test:', s, json.dumps(result, ensure_ascii=False))
        if s != 200 or not result.get('translation'):
            print('Translation test: FAILED')
            return 1
    except Exception as exc:
        print('Translation test: FAILED:', exc)
        return 1

    print('ALL LOCAL STACK CHECKS PASSED')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
