# Test Credentials

## Admin
- **Email**: admin@avarus.ru
- **Password**: admin
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
TEST_ADMIN_PASSWORD=<admin@avarus.ru password>
TEST_CLIENT_PASSWORD=<user@demo.com password>
TEST_CLIENT2_PASSWORD=<0x0errorr@gmail.com password>
TEST_MANAGER_PASSWORD=<manager@avarus.ru password>
```
