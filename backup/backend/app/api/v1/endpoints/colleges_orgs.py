import hmac
import hashlib
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText

from app.api.deps import get_db, get_current_user, get_current_system_admin
from app.core.config import settings
from app.models.college import College
from app.models.admin_models import Organization
from app.models.user_affiliation import UserAffiliation
from app.models.user import User

router = APIRouter()


def _sign_org_action(org_id: int, action: str) -> str:
    """HMAC-signs an org_id+action pair so the resulting token can only have been
    issued by this server (used for one-click approve/reject links in email, where
    a full login flow isn't practical)."""
    payload = f"{org_id}:{action}"
    return hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()


def _verify_org_action(org_id: int, action: str, token: str) -> bool:
    expected = _sign_org_action(org_id, action)
    return hmac.compare_digest(expected, token or "")


def _confirmation_page(message: str, success: bool = True) -> str:
    color = "#16A34A" if success else "#DC2626"
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>CyberRange</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background:#f8fafc; margin:0; padding:60px 20px; text-align:center; color:#1e293b;">
    <div style="max-width:420px; margin:0 auto; background:#fff; border-radius:16px; border:1px solid #e2e8f0; padding:36px 28px;">
        <h2 style="color:{color}; margin:0 0 12px 0;">{message}</h2>
        <a href="https://academy.deeptrustxai.com/system?tab=orgs" style="display:inline-block; margin-top:12px; background:#0052CC; color:#fff; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:13px;">Open SysAdmin Dashboard</a>
    </div>
</body>
</html>"""


def send_admin_verification_email(org_id: int, org_name: str, admin_email: str, base_url: str):
    subject = f"Verify New Organization Request: {org_name}"
    approve_token = _sign_org_action(org_id, "approve")
    reject_token = _sign_org_action(org_id, "reject")
    approve_url = f"https://academy.deeptrustxai.com/api/v1/organizations/{org_id}/approve-link?token={approve_token}"
    reject_url = f"https://academy.deeptrustxai.com/api/v1/organizations/{org_id}/reject-link?token={reject_token}"

    body = (
        f"A new organization has requested verification on CyberRange.<br><br>"
        f"<strong>Organization Name:</strong> {org_name}<br>"
        f"<strong>Requested by Admin Email:</strong> {admin_email}<br><br>"
        f"You can approve or reject this request directly from this email, or review it in the dashboard.<br><br>"
        f"<div style=\"text-align:center; margin-top:10px;\">"
        f"<a href=\"{approve_url}\" style=\"display:inline-block; background:#16A34A; color:#fff; padding:10px 22px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:13px; margin:0 6px;\">Approve</a>"
        f"<a href=\"{reject_url}\" style=\"display:inline-block; background:#DC2626; color:#fff; padding:10px 22px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:13px; margin:0 6px;\">Reject</a>"
        f"</div>"
    )

    try:
        from app.services.notification_service import NotificationService
        ns = NotificationService()
        ns.send_ses_email(
            to_email="cyberrangelabsupport@gmail.com",
            title=subject,
            message=body,
            action_url="/system?tab=orgs",
            priority="MEDIUM",
            action_label="Review in Dashboard"
        )
    except Exception as e:
        print(f"Failed to send verification email via SES: {e}")

class CollegeSearchResponse(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None

    class Config:
        from_attributes = True

class OrgSearchResponse(BaseModel):
    id: int
    name: str
    status: str

    class Config:
        from_attributes = True

class AffiliationResponse(BaseModel):
    id: int
    user_id: int
    affiliation_type: str
    college_id: Optional[int] = None
    organization_id: Optional[int] = None
    is_primary: bool
    college_name: Optional[str] = None
    college_code: Optional[str] = None
    organization_name: Optional[str] = None
    status: Optional[str] = None

    class Config:
        from_attributes = True

class AffiliationCreateRequest(BaseModel):
    affiliation_type: str  # 'college' or 'organization'
    college_id: Optional[int] = None
    organization_name: Optional[str] = None  # manual text if new org
    is_primary: Optional[bool] = False

class CollegeDetailResponse(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    status: str

    class Config:
        from_attributes = True

@router.get("/colleges/search", response_model=List[CollegeSearchResponse])
def search_colleges(
    q: Optional[str] = "",
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    if page < 1:
        page = 1
    if limit < 1 or limit > 100:
        limit = 20
    offset = (page - 1) * limit

    query = db.query(College).filter(College.status == "ACTIVE")
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            (College.name.ilike(search_term)) |
            (College.code.ilike(search_term)) |
            (College.address.ilike(search_term)) |
            (College.city.ilike(search_term)) |
            (College.district.ilike(search_term)) |
            (College.state.ilike(search_term))
        )
    return query.offset(offset).limit(limit).all()

@router.get("/colleges/{college_id}", response_model=CollegeDetailResponse)
def get_college_details(college_id: int, db: Session = Depends(get_db)):
    college = db.query(College).filter(College.id == college_id).first()
    if not college:
        raise HTTPException(status_code=404, detail="College not found")
    return college

@router.get("/organizations/search", response_model=List[OrgSearchResponse])
def search_organizations(q: Optional[str] = "", db: Session = Depends(get_db)):
    # Keep it simple, return all for selection, but filter by status if desired
    if not q:
        return db.query(Organization).limit(20).all()
    search_term = f"%{q}%"
    return db.query(Organization).filter(
        Organization.name.ilike(search_term)
    ).limit(20).all()

@router.post("/organizations/{org_id}/approve")
def approve_organization(org_id: int, db: Session = Depends(get_db), _admin: User = Depends(get_current_system_admin)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.status = "APPROVED"
    db.commit()
    return {"status": "success", "message": f"Organization '{org.name}' has been APPROVED successfully!"}

@router.post("/organizations/{org_id}/reject")
def reject_organization(org_id: int, db: Session = Depends(get_db), _admin: User = Depends(get_current_system_admin)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.status = "REJECTED"
    db.commit()
    return {"status": "success", "message": f"Organization '{org.name}' has been REJECTED."}


@router.get("/organizations/{org_id}/approve-link", response_class=HTMLResponse)
def approve_organization_via_link(org_id: int, token: str, db: Session = Depends(get_db)):
    """One-click approve from the verification email. Not user-authenticated - protected
    instead by an HMAC token that only this server could have generated for this org_id."""
    if not _verify_org_action(org_id, "approve", token):
        return HTMLResponse(_confirmation_page("Invalid or expired link.", success=False), status_code=403)
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        return HTMLResponse(_confirmation_page("Organization not found.", success=False), status_code=404)
    org.status = "APPROVED"
    db.commit()
    return HTMLResponse(_confirmation_page(f"Organization '{org.name}' has been approved."))


@router.get("/organizations/{org_id}/reject-link", response_class=HTMLResponse)
def reject_organization_via_link(org_id: int, token: str, db: Session = Depends(get_db)):
    """One-click reject from the verification email. Not user-authenticated - protected
    instead by an HMAC token that only this server could have generated for this org_id."""
    if not _verify_org_action(org_id, "reject", token):
        return HTMLResponse(_confirmation_page("Invalid or expired link.", success=False), status_code=403)
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        return HTMLResponse(_confirmation_page("Organization not found.", success=False), status_code=404)
    org.status = "REJECTED"
    db.commit()
    return HTMLResponse(_confirmation_page(f"Organization '{org.name}' has been rejected.", success=False))


@router.get("/me/affiliations", response_model=List[AffiliationResponse])
def get_my_affiliations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    affs = db.query(UserAffiliation).filter(UserAffiliation.user_id == current_user.id).all()
    res = []
    for aff in affs:
        c_name = aff.college.name if aff.college else None
        c_code = aff.college.code if aff.college else None
        o_name = aff.organization.name if aff.organization else None
        o_status = aff.organization.status if aff.organization else "VERIFIED"
        res.append(AffiliationResponse(
            id=aff.id,
            user_id=aff.user_id,
            affiliation_type=aff.affiliation_type,
            college_id=aff.college_id,
            organization_id=aff.organization_id,
            is_primary=aff.is_primary,
            college_name=c_name,
            college_code=c_code,
            organization_name=o_name,
            status=o_status
        ))
    return res

@router.post("/me/affiliations", response_model=AffiliationResponse)
def add_my_affiliation(request: Request, data: AffiliationCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.affiliation_type not in ("college", "organization"):
        raise HTTPException(status_code=400, detail="Invalid affiliation type")

    # Limit Check: Maximum 10 of each type
    existing_count = db.query(UserAffiliation).filter(
        UserAffiliation.user_id == current_user.id,
        UserAffiliation.affiliation_type == data.affiliation_type
    ).count()
    if existing_count >= 10:
        raise HTTPException(status_code=400, detail=f"Maximum limit of 10 {data.affiliation_type} affiliations reached.")

    if data.is_primary:
        db.query(UserAffiliation).filter(UserAffiliation.user_id == current_user.id).update({UserAffiliation.is_primary: False})

    new_aff = UserAffiliation(
        user_id=current_user.id,
        affiliation_type=data.affiliation_type,
        is_primary=data.is_primary
    )

    is_new_org = False
    if data.affiliation_type == "college":
        if not data.college_id:
            raise HTTPException(status_code=400, detail="college_id is required")
        college = db.query(College).filter(College.id == data.college_id).first()
        if not college:
            raise HTTPException(status_code=404, detail="College not found")
        new_aff.college_id = data.college_id
        dup = db.query(UserAffiliation).filter(UserAffiliation.user_id == current_user.id, UserAffiliation.college_id == data.college_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="College affiliation already exists")
    else:
        if not data.organization_name or not data.organization_name.strip():
            raise HTTPException(status_code=400, detail="organization_name is required")
        org_name = data.organization_name.strip()
        org = db.query(Organization).filter(Organization.name.ilike(org_name)).first()
        if not org:
            org = Organization(name=org_name, institution_type="Company", status="PENDING")
            db.add(org)
            db.flush()
            is_new_org = True
        new_aff.organization_id = org.id
        dup = db.query(UserAffiliation).filter(UserAffiliation.user_id == current_user.id, UserAffiliation.organization_id == org.id).first()
        if dup:
            raise HTTPException(status_code=400, detail="Organization affiliation already exists")

    db.add(new_aff)
    db.commit()
    db.refresh(new_aff)

    if is_new_org:
        base_url = str(request.base_url).rstrip("/")
        send_admin_verification_email(new_aff.organization_id, org_name, current_user.email, base_url)

    c_name = new_aff.college.name if new_aff.college else None
    c_code = new_aff.college.code if new_aff.college else None
    o_name = new_aff.organization.name if new_aff.organization else None
    o_status = new_aff.organization.status if new_aff.organization else "VERIFIED"

    return AffiliationResponse(
        id=new_aff.id,
        user_id=new_aff.user_id,
        affiliation_type=new_aff.affiliation_type,
        college_id=new_aff.college_id,
        organization_id=new_aff.organization_id,
        is_primary=new_aff.is_primary,
        college_name=c_name,
        college_code=c_code,
        organization_name=o_name,
        status=o_status
    )
@router.post("/me/affiliations/{aff_id}/primary", response_model=AffiliationResponse)
def set_primary_affiliation(aff_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    aff = db.query(UserAffiliation).filter(UserAffiliation.id == aff_id, UserAffiliation.user_id == current_user.id).first()
    if not aff:
        raise HTTPException(status_code=404, detail="Affiliation not found")
    
    db.query(UserAffiliation).filter(UserAffiliation.user_id == current_user.id).update({UserAffiliation.is_primary: False})
    
    aff.is_primary = True
    db.commit()
    db.refresh(aff)

    c_name = aff.college.name if aff.college else None
    c_code = aff.college.code if aff.college else None
    o_name = aff.organization.name if aff.organization else None
    o_status = aff.organization.status if aff.organization else "VERIFIED"

    return AffiliationResponse(
        id=aff.id,
        user_id=aff.user_id,
        affiliation_type=aff.affiliation_type,
        college_id=aff.college_id,
        organization_id=aff.organization_id,
        is_primary=aff.is_primary,
        college_name=c_name,
        college_code=c_code,
        organization_name=o_name,
        status=o_status
    )
@router.delete("/me/affiliations/{aff_id}")
def remove_my_affiliation(aff_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    aff = db.query(UserAffiliation).filter(UserAffiliation.id == aff_id, UserAffiliation.user_id == current_user.id).first()
    if not aff:
        raise HTTPException(status_code=404, detail="Affiliation not found")
    if aff.is_primary:
        raise HTTPException(status_code=400, detail="Cannot delete primary affiliation. Set another affiliation as primary first.")
    db.delete(aff)
    db.commit()
    return {"status": "success", "message": "Affiliation removed successfully"}
