from pydantic import BaseModel, EmailStr
from typing import Optional

class UserLogin(BaseModel):
    email: str
    password: str
    remember_me: Optional[bool] = False
    portal: Optional[str] = "student"
    otp_code: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    name: Optional[str] = None
    email: str
    role: Optional[str] = None
    account_type: Optional[str] = None
    account_status: Optional[str] = "active"
    email_verified: Optional[bool] = True
    tenant_id: Optional[str] = "default"
    is_internal: Optional[bool] = False
    college_id: Optional[int] = None
    department: Optional[str] = None
    year: Optional[int] = None
    roll_number: Optional[str] = None
    total_score: Optional[int] = None
    auth_type: Optional[str] = None

    class Config:
        from_attributes = True

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    account_type: Optional[str] = "INDIVIDUAL" # STUDENT or INDIVIDUAL
    primary_affiliation_type: Optional[str] = "college"  # 'college' or 'organization'
    college_id: Optional[int] = None
    organization_name: Optional[str] = None
    department: Optional[str] = None
    year: Optional[int] = None
    roll_number: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp_code: str

class RefreshTokenRequest(BaseModel):
    refresh_token: Optional[str] = None

class OAuthCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None
    role: Optional[str] = "student"

class GoogleAuthRequest(BaseModel):
    credential: str
    portal: Optional[str] = "student"




