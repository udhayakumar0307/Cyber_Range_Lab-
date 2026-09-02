from app.database.manager import db_manager
from app.models.admin_models import Organization

db_manager.init_db()
db = db_manager.get_session()

o = db.query(Organization).filter(Organization.id == 12).first()
print('ORG 12:', 'name=', o.name, 'status=', o.status, 'institution_type=', o.institution_type)
