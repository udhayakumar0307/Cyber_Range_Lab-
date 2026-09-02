from app.database.manager import db_manager
from app.models.user import User
from app.models.rbac import UserRoleBinding
from app.models.admin_models import AdminProfile
from app.models.user_affiliation import UserAffiliation

db_manager.init_db()
db = db_manager.get_session()
u = db.query(User).filter(User.email == 'cyberrangelabsupport@gmail.com').first()
print('USER:', u.id, u.email, u.role, 'college_id=', u.college_id)

print('BINDINGS:')
for b in db.query(UserRoleBinding).filter(UserRoleBinding.user_id == u.id).all():
    print(' ', b.id, b.role, b.scope_type, 'org=', b.organization_id, 'college=', b.college_id, 'active=', b.is_active)

p = db.query(AdminProfile).filter(AdminProfile.user_id == u.id).first()
print('ADMIN_PROFILE org_id:', p.organization_id if p else 'NONE')

print('AFFILIATIONS:')
for a in db.query(UserAffiliation).filter(UserAffiliation.user_id == u.id).all():
    print(' ', a.id, a.affiliation_type, 'org=', a.organization_id, 'college=', a.college_id, 'primary=', a.is_primary)
