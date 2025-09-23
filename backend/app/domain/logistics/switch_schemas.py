from pydantic import BaseModel
from typing import Any, Optional, Literal, List
class ConditionExpr(BaseModel):
    field: str
    op: Literal["eq","neq","in","nin","contains","prefix","exists","not_exists"]
    value: Optional[Any] = None
class ActionDef(BaseModel):
    set_prefix: Optional[str] = None
class SwitchRuleIn(BaseModel):
    name: str; status: Literal["enabled","disabled"]="enabled"; priority:int=100
    condition: List[ConditionExpr]; action: ActionDef
class SwitchRuleOut(SwitchRuleIn):
    id: str
