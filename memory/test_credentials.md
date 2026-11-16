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

## Manager (role: manager, created on the admin page /admin/staff)
- **Email**: manager@avarus.ru
- **Password**: manager123
- Cabinet: /manager. Client user@demo.com is bound to this manager (past orders included).

## Passwords for backend autotests
Tests no longer contain passwords. They read them from `/app/backend/tests/.env.test` (loaded by `tests/conftest.py`, the file is NOT committed to git). If the file is missing, recreate it:
```
TEST_CLIENT_PASSWORD=<user@demo.com password>
TEST_CLIENT2_PASSWORD=<0x0errorr@gmail.com password>
TEST_MANAGER_PASSWORD=<manager@avarus.ru password>
```

The admin password for tests is taken from `ADMIN_PASSWORD` automatically by `tests/conftest.py`.

## Manager account — password unknown (June 2026)
`manager@avarus.ru`: the password was changed in the admin panel (Сотрудники) on 16.11 and `manager123` no longer works. The owner said he will set it himself — do NOT reset it.
For manager tests create a temporary manager through the admin API (`POST /api/admin/staff` {name, email, password, commission_percent}), bind a client (`POST /api/admin/staff/{id}/clients` {user_id}) and delete both afterwards — see `backend/tests/test_iter122_manager_showcase.py`.
Old backend tests that log in as manager@avarus.ru fail until the owner's password is put into `backend/tests/.env.test` as `TEST_MANAGER_PASSWORD`.
