from pathlib import Path

from dotenv import load_dotenv

# Test account passwords live in tests/.env.test (not committed), see /app/memory/test_credentials.md
load_dotenv(Path(__file__).parent / ".env.test")
load_dotenv(Path(__file__).parents[2] / "frontend" / ".env")
