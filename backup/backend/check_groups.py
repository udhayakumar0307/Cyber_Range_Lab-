from app.database.manager import db_manager
from app.models.group import Group

db_manager.init_db()
db = db_manager.get_session()

print('GROUP 26:')
g = db.query(Group).filter(Group.id == 26).first()
if g:
    print(' id=', g.id, 'name=', g.name, 'organization_id=', g.organization_id)
else:
    print(' not found')

print('ALL GROUPS:')
for g in db.query(Group).order_by(Group.id.desc()).limit(15).all():
    print(' id=', g.id, 'name=', g.name, 'organization_id=', g.organization_id)
