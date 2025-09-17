# -*- coding: utf-8 -*-
"""
minipost 后端（FastAPI 极简骨架）

- 健康检查：GET /api/v1/health
- 换单占位接口：POST /api/v1/orders/replace
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import uvicorn

app = FastAPI(title="minipost API", version="0.1.0")

class ReplaceRequest(BaseModel):
    original_order_id: str = Field(..., description="原始订单ID")
    target_channel: str = Field(..., description="目标渠道，如 'amazon' / 'aliexpress'")
    note: Optional[str] = Field(None, description="备注")

class ReplaceResponse(BaseModel):
    task_id: str
    status: str = "queued"

@app.get("/api/v1/health")
def health():
    """健康检查"""
    return {"status": "ok"}

@app.post("/api/v1/orders/replace", response_model=ReplaceResponse)
def replace_order(req: ReplaceRequest):
    """
    换单占位接口（示例）：
    - 校验参数
    - 入队（此处简化为返回模拟 task_id）
    - 返回队列状态
    """
    if not req.original_order_id.strip():
        raise HTTPException(status_code=400, detail="original_order_id 不能为空")
    # TODO: 将任务入消息队列/数据库，这里仅返回占位 task_id
    task_id = f"TASK-{req.original_order_id}"
    return {"task_id": task_id, "status": "queued"}

if __name__ == "__main__":
    # 本地调试启动
    uvicorn.run("app.main:app", host="0.0.0.0", port=8080, reload=True)
