import os, uvicorn

host = os.environ.get("HOST", "0.0.0.0")
port = int(os.environ.get("PORT", "8000"))
reload = os.environ.get("RELOAD", "0") == "1"
workers = int(os.environ.get("WORKERS", "1"))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=host, port=port, reload=reload, workers=workers)
