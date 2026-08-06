import urllib.request, json
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/v1/auth/login',
    data=json.dumps({'email': 'admin@cyberrange.in', 'password': 'admin'}).encode(),
    headers={'Content-Type': 'application/json'}
)
try:
    res = urllib.request.urlopen(req)
    print(res.read())
except Exception as e:
    print(e)
