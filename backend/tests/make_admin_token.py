# Helper: writes a signed admin access_token (with auth_version) to /tmp/admin_token.txt for browser tests
import asyncio, os, sys
sys.path.insert(0, '/app/backend')
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from motor.motor_asyncio import AsyncIOMotorClient
import database


async def main():
    db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    admin = await db.users.find_one({"email": "admin@avarus.ru"}, {"_id": 0, "id": 1, "auth_version": 1})
    tok = database.create_token(admin["id"], admin.get("auth_version", 0) or 0)
    open('/tmp/admin_token.txt', 'w').write(tok)
    print("ok", admin["id"][:8])

asyncio.run(main())
