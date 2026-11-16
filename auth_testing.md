# Auth testing notes

- Session = httpOnly cookie `access_token` (Secure, SameSite=None, 7 days) set by `POST /api/auth/login` and `POST /api/auth/register`, cleared by `POST /api/auth/logout`.
- The frontend never stores the token (axios `withCredentials`, fetch `credentials: 'include'`). `localStorage.token` must stay empty.
- API clients/tests may still send `Authorization: Bearer <token>` (login response body has `token`); the header wins over the cookie.
- No auth → 403 "Not authenticated"; bad/expired token → 401.
- CSRF guard (`cookie_origin_guard` in server.py): a request that relies on the cookie and carries an `Origin` of another site gets 403.

```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
curl -s -c /tmp/c.txt -X POST $API/api/auth/login -H 'Content-Type: application/json' -d '{"email":"user@demo.com","password":"demo123"}'
curl -s -b /tmp/c.txt $API/api/auth/me                                   # 200
curl -s -b /tmp/c.txt $API/api/auth/me -H 'Origin: https://evil.example' # 403
curl -s -b /tmp/c.txt -c /tmp/c.txt -X POST $API/api/auth/logout         # then /me -> 403
```
Credentials: /app/memory/test_credentials.md
