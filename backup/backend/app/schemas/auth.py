from pydantic import BaseModel, EmailStr
from typing import Optional

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    name: Optional[str] = None
    email: str
    role: Optional[str] = None
    account_type: Optional[str] = None
    college_id: Optional[int] = None
    department: Optional[str] = None
    year: Optional[int] = None
    roll_number: Optional[str] = None
    total_score: Optional[int] = None

    class Config:
        from_attributes = True

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    account_type: Optional[str] = "INDIVIDUAL" # STUDENT or INDIVIDUAL
    college_id: Optional[int] = None
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


