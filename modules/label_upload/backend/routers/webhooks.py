from fastapi import APIRouter, Request

router = APIRouter()

@router.post("/webhook")
async def webhook(req: Request):
    # 预留：承运商/平台回调
    body = await req.body()
    return {"ok": True, "received": len(body or b"")}
