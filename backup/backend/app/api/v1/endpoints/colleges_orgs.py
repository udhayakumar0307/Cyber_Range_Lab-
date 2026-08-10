from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText

from app.api.deps import get_db, get_current_user
from app.models.college import College
from app.models.admin_models import Organization
from app.models.user_affiliation import UserAffiliation
from app.models.user import User

router = APIRouter()

def send_admin_verification_email(org_id: int, org_name: str, admin_email: str):
    from app.core.config import settings
    subject = f"Verify New Organization Request: {org_name}"
    approve_url = f"{settings.FRONTEND_URL}/api/v1/organizations/{org_id}/approve"
    reject_url = f"{settings.FRONTEND_URL}/api/v1/organizations/{org_id}/reject"
    
    body = (
        f"Hello SysAdmin,\n\n"
        f"A new organization has been requested for verification on CyberRange:\n"
        f"Organization Name: {org_name}\n"
        f"Requested by Admin Email: {admin_email}\n\n"
        f"Please click one of the links below to approve or reject this request:\n\n"
        f"APPROVE: {approve_url}\n"
        f"REJECT: {reject_url}\n\n"
        f"Regards,\nCyberRange Team"
    )
    
    try:
        from app.services.notification_service import NotificationService
        ns = NotificationService()
        ns.send_ses_email(
            to_email="cyberrangelabsupport@gmail.com",
            title=subject,
            message=body
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

@router.get("/organizations/{org_id}/approve")
def approve_organization(org_id: int, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.status = "APPROVED"
    db.commit()
    return {"status": "success", "message": f"Organization '{org.name}' has been APPROVED successfully!"}

@router.get("/organizations/{org_id}/reject")
def reject_organization(org_id: int, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.status = "REJECTED"
    db.commit()
    return {"status": "success", "message": f"Organization '{org.name}' has been REJECTED."}

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
def add_my_affiliation(data: AffiliationCreateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
        send_admin_verification_email(new_aff.organization_id, org_name, current_user.email)

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
