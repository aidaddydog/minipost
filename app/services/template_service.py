from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.template import Template

def get_template(db: Session, name: str) -> Template | None:
    return db.execute(select(Template).where(Template.name == name)).scalar_one_or_none()

def upsert_template(db: Session, name: str, content: str) -> Template:
    t = get_template(db, name)
    if t:
        t.content = content
    else:
        t = Template(name=name, content=content)
        db.add(t)
    db.commit(); db.refresh(t)
    return t
