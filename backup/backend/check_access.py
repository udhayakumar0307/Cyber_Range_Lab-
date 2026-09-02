from app.database.manager import db_manager
from app.models.user import User
from app.models.group import Group
from app.core.capabilities import Capability, capabilities_for_role
from app.services.authorization_service import AuthorizationService

db_manager.init_db()
db = db_manager.get_session()

u = db.query(User).filter(User.email == 'cyberrangelabsupport@gmail.com').first()
g = db.query(Group).filter(Group.id == 26).first()

bindings = AuthorizationService.active_bindings(db, u.id)
print('ACTIVE BINDINGS:')
for b in bindings:
    print(' ', b.id, 'role=', repr(b.role), 'scope_type=', repr(b.scope_type), 'org=', b.organization_id)

cap = Capability.ROSTER_MANAGE
print('capabilities_for_role(ADMIN):', capabilities_for_role('ADMIN'))
print('capabilities_for_role(admin):', capabilities_for_role('admin'))

bfc = AuthorizationService.bindings_for_capability(db, u.id, cap)
print('bindings_for_capability(ROSTER_MANAGE):', [(b.id, b.role, b.scope_type) for b in bfc])

gs, org_ids, col_ids = AuthorizationService._scope_sets(bfc)
print('scope_sets -> global_access=', gs, 'org_ids=', org_ids, 'college_ids=', col_ids)

print('group.organization_id=', g.organization_id, type(g.organization_id))
print('can_access_group result:', AuthorizationService.can_access_group(db, u, g, cap))
