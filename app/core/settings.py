from pydantic import BaseModel
import os

class Settings(BaseModel):
    host: str = os.environ.get("HOST","0.0.0.0")
    port: int = int(os.environ.get("PORT","8000"))
    data_dir: str = os.environ.get("DATA","/opt/minipost-data")
    base_dir: str = os.environ.get("BASE", os.path.dirname(os.path.dirname(__file__)))
    secret_key: str = os.environ.get("SECRET_KEY","minipost-secret-key")
    log_file: str = os.environ.get("LOG_FILE","/var/log/minipost/app.log")

settings = Settings()
