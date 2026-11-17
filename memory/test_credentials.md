# Test Credentials

## Admin
- **Email**: admin@avarus.ru
- **Password**: value of the secret `ADMIN_PASSWORD` (env var, read it with `os.environ["ADMIN_PASSWORD"]`; never print it). The old password `admin` no longer works.
- **Role**: admin

## Client (with completed orders, has bonus points, used for return tests)
- **Email**: 0x0errorr@gmail.com
- **Password**: admin123

## Client (secondary, no completed orders)
- **Email**: user@demo.com
- **Password**: demo123

## Passwords for backend autotests
Tests no longer contain passwords. They read them from `/app/backend/tests/.env.test` (loaded by `tests/conftest.py`, the file is NOT committed to git). If the file is missing, recreate it:
```
TEST_CLIENT_PASSWORD=<user@demo.com password>
TEST_CLIENT2_PASSWORD=<0x0errorr@gmail.com password>
TEST_MANAGER_EMAIL=test.manager@avarus.ru
TEST_MANAGER_PASSWORD=<test manager password>
```

The admin password for tests is taken from `ADMIN_PASSWORD` automatically by `tests/conftest.py`.

## Test manager (use this one for all manager UI / API tests)
- **Email**: test.manager@avarus.ru
- **Password**: Tm-O56Zj6qYd0X3
- Role: manager, commission 10%. Cabinet: /manager, showcase: /manager/showcase.
- Bound client: test.client@avarus.ru / TestClient_Pw_9x (role user). Selections sent by the manager appear in this client's /account.
- Backend tests read it from `backend/tests/.env.test` (`TEST_MANAGER_EMAIL`, `TEST_MANAGER_PASSWORD`).

## Owner's manager account manager@avarus.ru — password unknown, do NOT reset it
The owner sets this password himself. Tests that need this very account (its bound client user@demo.com) use a signed token
`TEST_DEMO_MANAGER_TOKEN` made in `backend/tests/conftest.py`; they never log in with a password.

## Notes after the audit fixes (June 2026)
- Login is limited: 10 wrong passwords per e-mail+IP in 15 minutes -> HTTP 429. Never brute-force real accounts in tests; use a non-existing e-mail to test the limit.
- Admin password is only in the environment (`ADMIN_PASSWORD`), never in files. For browser tests without the password: sign a JWT `{user_id: <admin id>, exp}` with `JWT_SECRET` (HS256) and set it as cookie `access_token` (see backend/tests/conftest.py for the same trick).
- Balance top-up never credits by itself: an admin must confirm the request in admin -> payments -> «Предоплата».
