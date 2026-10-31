import os
import tempfile
from pathlib import Path

# Keep the suite offline, deterministic, and away from the developer's database,
# regardless of a local .env. These must be set before the app is imported.
_test_dir = Path(tempfile.mkdtemp(prefix="snap-a-store-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_test_dir / 'test.db').as_posix()}"
os.environ["UPLOAD_DIRECTORY"] = str(_test_dir / "uploads")
os.environ["LLM_PROVIDER"] = "none"
os.environ["VISION_PROVIDER"] = "mock"
os.environ["PAYPAL_CLIENT_ID"] = ""
os.environ["PAYPAL_CLIENT_SECRET"] = ""
