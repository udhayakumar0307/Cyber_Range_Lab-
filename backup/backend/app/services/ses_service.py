import logging
import boto3
from botocore.exceptions import ClientError, NoCredentialsError, EndpointConnectionError, BotoCoreError
from app.core.config import settings

logger = logging.getLogger(__name__)

class SESService:
    def __init__(self):
        self.client = None
        self.is_enabled = False
        self.initialize_client()

    def initialize_client(self):
        required_vars = [
            "AWS_REGION",
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "SES_FROM_EMAIL"
        ]
        
        missing_vars = []
        for var in required_vars:
            val = getattr(settings, var, None)
            if not val:
                missing_vars.append(var)
        
        if missing_vars:
            logger.warning(
                f"SES Service is disabled: Missing environment variables: {', '.join(missing_vars)}. "
                "Email verification features will be unavailable."
            )
            self.is_enabled = False
            self.client = None
            return

        try:
            self.client = boto3.client(
                "ses",
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
            )
            self.is_enabled = True
            logger.info("SES Service successfully initialized.")
        except Exception as e:
            logger.warning(f"Failed to initialize SES client: {e}. Disabling email service.")
            self.is_enabled = False
            self.client = None

    def send_otp_email(self, email: str, otp: str):
        """
        Sends verification OTP email using Amazon SES.
        """
        if not self.is_enabled or not self.client:
            logger.error("SES error: SES email service is disabled or unconfigured.")
            raise RuntimeError("Email service is currently disabled or unconfigured.")

        logger.info("OTP email sending started")

        # HTML body with a professional template
        html_body = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CyberRange Email Verification</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f6f8;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }}
        .container {{
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid #e1e8ed;
        }}
        .header {{
            background: linear-gradient(135deg, #0052cc, #6f42c1);
            color: #ffffff;
            text-align: center;
            padding: 30px 20px;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }}
        .content {{
            padding: 40px 30px;
            color: #2d3436;
            line-height: 1.6;
        }}
        .content p {{
            margin: 0 0 20px 0;
            font-size: 16px;
        }}
        .otp-container {{
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 8px;
            border: 1px dashed #0052cc;
        }}
        .otp-code {{
            font-size: 32px;
            font-weight: 800;
            letter-spacing: 6px;
            color: #0052cc;
            margin: 0;
        }}
        .footer {{
            background-color: #f8f9fa;
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #a0aec0;
            border-top: 1px solid #edf2f7;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CyberRange Verification</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Your verification code is:</p>
            <div class="otp-container">
                <h2 class="otp-code">{otp}</h2>
            </div>
            <p>This OTP expires in <strong>5 minutes</strong>.</p>
            <p style="color: #e53e3e; font-weight: 600;">Do not share this code.</p>
            <p>Best regards,<br><strong>CyberRange Team</strong></p>
        </div>
        <div class="footer">
            &copy; 2026 CyberRange Platform. All rights reserved.
        </div>
    </div>
</body>
</html>
"""

        # Plain text fallback
        text_body = (
            f"Hello,\n\n"
            f"Your verification code is:\n\n"
            f"{otp}\n\n"
            f"This OTP expires in 5 minutes.\n\n"
            f"Do not share this code.\n\n"
            f"CyberRange Team"
        )

        try:
            self.client.send_email(
                Source=settings.SES_FROM_EMAIL,
                Destination={
                    "ToAddresses": [email]
                },
                Message={
                    "Subject": {
                        "Data": "CyberRange Email Verification",
                        "Charset": "UTF-8"
                    },
                    "Body": {
                        "Html": {
                            "Data": html_body,
                            "Charset": "UTF-8"
                        },
                        "Text": {
                            "Data": text_body,
                            "Charset": "UTF-8"
                        }
                    }
                }
            )
            logger.info("OTP sent successfully")
        except NoCredentialsError as e:
            logger.error(f"SES error: {e}")
            raise RuntimeError("AWS credentials not found. Please contact administration.")
        except EndpointConnectionError as e:
            logger.error(f"SES error: {e}")
            raise RuntimeError("Could not connect to the email verification service. Please check your network connection.")
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            error_msg = e.response.get("Error", {}).get("Message", "")
            logger.error(f"SES error: {error_code} - {error_msg}")
            
            if error_code == "MessageRejected":
                if "not verified" in error_msg.lower():
                    if settings.ENV == "development":
                        logger.warning(f"[SES Sandbox Mode] Email {email} is not verified. Bypassing error since ENV=development. OTP code is: {otp}")
                        return
                    raise RuntimeError(
                        "The recipient email address is not verified in the AWS SES sandbox. "
                        "Please use a verified test email address."
                    )
                else:
                    raise RuntimeError(f"Email message was rejected by Amazon SES: {error_msg}")
            elif error_code == "InvalidParameterValue":
                raise RuntimeError("Invalid email address format or parameter provided.")
            else:
                raise RuntimeError(f"Amazon SES failed to send email: {error_msg}")
        except BotoCoreError as e:
            logger.error(f"SES error: {e}")
            raise RuntimeError("A network timeout or error occurred while connecting to Amazon SES. Please try again.")
        except Exception as e:
            logger.error(f"SES error: Unexpected error sending email: {e}")
            raise RuntimeError(f"An unexpected error occurred while sending email: {str(e)}")

    def send_reset_email(self, email: str, reset_url: str) -> str:
        """
        Sends password reset email containing a reset link using Amazon SES.
        Returns the MessageId of the sent email.
        """
        if not self.is_enabled or not self.client:
            logger.error("SES error: SES email service is disabled or unconfigured.")
            raise RuntimeError("Email service is currently disabled or unconfigured.")

        logger.info("Calling SES")

        # HTML body
        html_body = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CyberRange Password Recovery</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f6f8;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }}
        .container {{
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid #e1e8ed;
        }}
        .header {{
            background: linear-gradient(135deg, #0052cc, #6f42c1);
            color: #ffffff;
            text-align: center;
            padding: 30px 20px;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }}
        .content {{
            padding: 40px 30px;
            color: #2d3436;
            line-height: 1.6;
        }}
        .content p {{
            margin: 0 0 20px 0;
            font-size: 16px;
        }}
        .btn-container {{
            text-align: center;
            margin: 30px 0;
        }}
        .btn {{
            display: inline-block;
            background-color: #0052cc;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 700;
            box-shadow: 0 4px 6px rgba(0, 82, 204, 0.15);
        }}
        .btn:hover {{
            background-color: #0040a3;
        }}
        .link-text {{
            word-break: break-all;
            font-size: 13px;
            color: #718096;
            background-color: #f7fafc;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #edf2f7;
            margin-top: 20px;
        }}
        .footer {{
            background-color: #f8f9fa;
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #a0aec0;
            border-top: 1px solid #edf2f7;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CyberRange Password Recovery</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>You requested to reset your CyberRange platform password. Click the button below to secure a new passcode credentials key:</p>
            <div class="btn-container">
                <a href="{reset_url}" class="btn" target="_blank">Reset Password</a>
            </div>
            <p>This password reset link expires automatically in <strong>15 minutes</strong>.</p>
            <p style="color: #718096;">If you did not request this change, you can safely ignore this email.</p>
            <p>Or copy and paste the following URL into your browser:</p>
            <div class="link-text">{reset_url}</div>
            <p style="margin-top: 30px;">Best regards,<br><strong>CyberRange Team</strong></p>
        </div>
        <div class="footer">
            &copy; 2026 CyberRange Platform. All rights reserved.
        </div>
    </div>
</body>
</html>
"""

        # Plain text body fallback
        text_body = (
            f"Hello,\n\n"
            f"You requested to reset your CyberRange platform password. Click the link below to set a new password:\n\n"
            f"{reset_url}\n\n"
            f"This link will expire in 15 minutes.\n\n"
            f"If you did not request a password reset, please ignore this email.\n\n"
            f"CyberRange Team"
        )

        try:
            response = self.client.send_email(
                Source=settings.SES_FROM_EMAIL,
                Destination={
                    "ToAddresses": [email]
                },
                Message={
                    "Subject": {
                        "Data": "CyberRange Password Reset Request",
                        "Charset": "UTF-8"
                    },
                    "Body": {
                        "Html": {
                            "Data": html_body,
                            "Charset": "UTF-8"
                        },
                        "Text": {
                            "Data": text_body,
                            "Charset": "UTF-8"
                        }
                    }
                }
            )
            
            logger.info(f"SES response: {response}")
            message_id = response.get("MessageId")
            if not message_id:
                raise RuntimeError("Amazon SES did not return a MessageId.")
                
            logger.info(f"SES MessageId: {message_id}")
            logger.info("Email successfully sent")
            return message_id

        except NoCredentialsError as e:
            logger.error(f"SES error: {e}")
            raise RuntimeError("AWS credentials not found. Please contact administration.")
        except EndpointConnectionError as e:
            logger.error(f"SES error: {e}")
            raise RuntimeError("Could not connect to the email verification service. Please check your network connection.")
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            error_msg = e.response.get("Error", {}).get("Message", "")
            logger.error(f"SES error: {error_code} - {error_msg}")
            
            if error_code == "MessageRejected":
                if "not verified" in error_msg.lower():
                    if settings.ENV == "development":
                        logger.warning(f"[SES Sandbox Mode] Email {email} is not verified. Bypassing error since ENV=development. Reset URL is: {reset_url}")
                        return "mock-message-id-sandbox"
                    raise RuntimeError(
                        "The recipient email address is not verified in the AWS SES sandbox. "
                        "Please use a verified test email address."
                    )
                else:
                    raise RuntimeError(f"Email message was rejected by Amazon SES: {error_msg}")
            elif error_code == "AccessDenied":
                raise RuntimeError("Amazon SES Access Denied. Check IAM policy permissions.")
            elif error_code == "InvalidParameterValue":
                raise RuntimeError("Invalid email address format or parameter provided.")
            else:
                raise RuntimeError(f"Amazon SES failed to send email: {error_msg}")
        except BotoCoreError as e:
            logger.error(f"SES error: {e}")
            raise RuntimeError("A network timeout or error occurred while connecting to Amazon SES. Please try again.")
        except Exception as e:
            logger.error(f"SES error: Unexpected error sending email: {e}")
            raise RuntimeError(f"An unexpected error occurred while sending email: {str(e)}")

    def send_welcome_email(self, email: str, temp_password: str, professor_name: str):
        """
        Sends welcome email with temporary password.
        """
        html_body = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to CyberRange</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; color: #333;">
    <h2>Welcome to CyberRange!</h2>
    <p>You have been added to the CyberRange platform by Professor <strong>{professor_name}</strong>.</p>
    <p>To log into your student dashboard, please use the following temporary password:</p>
    <div style="background: #f4f6f8; border: 1px dashed #0052cc; padding: 15px; font-size: 20px; font-weight: bold; text-align: center; color: #0052cc; margin: 20px 0;">
        {temp_password}
    </div>
    <p>Please log in and update your password immediately from your profile settings.</p>
    <p>Best regards,<br><strong>CyberRange Team</strong></p>
</body>
</html>
"""
        text_body = f"Welcome to CyberRange!\nYou have been added by Professor {professor_name}.\nTemporary password: {temp_password}\nLog in and update your password immediately."
        try:
            if not self.is_enabled or not self.client:
                logger.warning(f"[SES Sandbox Mode Bypass] Welcome email bypass to {email}. Password: {temp_password}")
                return
            self.client.send_email(
                Source=settings.SES_FROM_EMAIL,
                Destination={"ToAddresses": [email]},
                Message={
                    "Subject": {"Data": f"You have been added to CyberRange by Professor {professor_name}", "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": html_body, "Charset": "UTF-8"},
                        "Text": {"Data": text_body, "Charset": "UTF-8"}
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to send welcome email: {e}")

    def send_lab_assigned_email(self, email: str, lab_name: str, date: str, time: str, duration: str):
        """
        Sends lab assigned email.
        """
        html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; color: #333;">
    <h2>New Lab Assigned: {lab_name}</h2>
    <p>A new lab assessment has been assigned to you.</p>
    <ul>
        <li><strong>Lab:</strong> {lab_name}</li>
        <li><strong>Date:</strong> {date}</li>
        <li><strong>Time:</strong> {time}</li>
        <li><strong>Duration:</strong> {duration}</li>
    </ul>
    <p>Please log in to your student portal dashboard to complete the assessment.</p>
</body>
</html>
"""
        text_body = f"New Lab Assigned: {lab_name}\nDate: {date}\nTime: {time}\nDuration: {duration}"
        try:
            if not self.is_enabled or not self.client:
                logger.warning(f"[SES Sandbox Mode Bypass] Lab Assigned email bypass to {email}.")
                return
            self.client.send_email(
                Source=settings.SES_FROM_EMAIL,
                Destination={"ToAddresses": [email]},
                Message={
                    "Subject": {"Data": f"CyberRange Lab Assigned: {lab_name}", "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": html_body, "Charset": "UTF-8"},
                        "Text": {"Data": text_body, "Charset": "UTF-8"}
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to send lab assigned email: {e}")

    def send_lab_reminder_email(self, email: str, lab_name: str, date: str, time: str, duration: str):
        """
        Sends 15-minute start reminder email.
        """
        html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; color: #333;">
    <h2>Reminder: Assigned Lab Starting Soon</h2>
    <p>This is a reminder that your assigned lab assessment <strong>{lab_name}</strong> will start in 15 minutes.</p>
    <ul>
        <li><strong>Lab:</strong> {lab_name}</li>
        <li><strong>Date:</strong> {date}</li>
        <li><strong>Time:</strong> {time}</li>
        <li><strong>Duration:</strong> {duration}</li>
    </ul>
    <p>Please prepare your environment and log in to start on time.</p>
</body>
</html>
"""
        text_body = f"Reminder: Lab starting soon: {lab_name}\nDate: {date}\nTime: {time}\nDuration: {duration}"
        try:
            if not self.is_enabled or not self.client:
                logger.warning(f"[SES Sandbox Mode Bypass] Lab Reminder email bypass to {email}.")
                return
            self.client.send_email(
                Source=settings.SES_FROM_EMAIL,
                Destination={"ToAddresses": [email]},
                Message={
                    "Subject": {"Data": f"Lab Starting Soon: {lab_name}", "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": html_body, "Charset": "UTF-8"},
                        "Text": {"Data": text_body, "Charset": "UTF-8"}
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to send lab reminder email: {e}")

    def send_added_to_group_email(self, email: str, student_name: str, group_name: str, admin_name: str):
        """
        Sends email informing student they have been successfully added to a cohort/group.
        """
        html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; color: #333;">
    <h2>Cohort Group Enrollment Successful</h2>
    <p>Hello <strong>{student_name}</strong>,</p>
    <p>You have been successfully added to the group cohort <strong>{group_name}</strong> by Administrator <strong>{admin_name}</strong>.</p>
    <p>Please log in to your student portal dashboard to view any assigned training labs and start practicing.</p>
    <p>Best regards,<br><strong>CyberRange Team</strong></p>
</body>
</html>
"""
        text_body = f"Hello {student_name},\nYou have been successfully added to the group cohort '{group_name}' by Administrator {admin_name}.\nLog in to your student portal to see your assigned labs."
        try:
            if not self.is_enabled or not self.client:
                logger.warning(f"[SES Sandbox Mode Bypass] Group Add notification email bypass to {email}.")
                return
            self.client.send_email(
                Source=settings.SES_FROM_EMAIL,
                Destination={"ToAddresses": [email]},
                Message={
                    "Subject": {"Data": f"Successfully Added to Cohort: {group_name}", "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": html_body, "Charset": "UTF-8"},
                        "Text": {"Data": text_body, "Charset": "UTF-8"}
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to send cohort addition email: {e}")

    def send_account_created_email(self, email: str, name: str, role: str):
        """
        Sends account creation success confirmation email.
        """
        html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; color: #333;">
    <h2>CyberRange Account Created Successfully</h2>
    <p>Hello <strong>{name}</strong>,</p>
    <p>Your CyberRange account ({role.upper()} portal) has been verified and created successfully.</p>
    <p>You can now log in to the portal and start using the platform.</p>
    <p>Best regards,<br><strong>CyberRange Team</strong></p>
</body>
</html>
"""
        text_body = f"Hello {name},\nYour CyberRange account ({role.upper()}) has been verified and created successfully.\nLog in to the portal to start using the platform."
        try:
            if not self.is_enabled or not self.client:
                logger.warning(f"[SES Sandbox Mode Bypass] Account creation email bypass to {email}.")
                return
            self.client.send_email(
                Source=settings.SES_FROM_EMAIL,
                Destination={"ToAddresses": [email]},
                Message={
                    "Subject": {"Data": "CyberRange Account Created Successfully", "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": html_body, "Charset": "UTF-8"},
                        "Text": {"Data": text_body, "Charset": "UTF-8"}
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to send account created email: {e}")

ses_service = SESService()

