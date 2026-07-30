"""Environment-aware Flask configuration for local SQLite and PostgreSQL deployments."""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

# Always load backend/.env regardless of the process working directory.
_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(_BACKEND_DIR / ".env")
load_dotenv()  # also allow a parent/.env override when present


class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///comparex.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-before-production")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://127.0.0.1:5500,http://localhost:5500").split(",")

    # OTP delivery — missing live credentials auto-fall back to console (dev) mode
    SMS_PROVIDER = os.getenv("SMS_PROVIDER", "dev")  # dev | msg91 | twilio | auto | aws_sns
    EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "dev")
    # MSG91 (preferred for India). MSG91_API_KEY preferred; MSG91_AUTH_KEY kept for compatibility.
    MSG91_API_KEY = os.getenv("MSG91_API_KEY") or os.getenv("MSG91_AUTH_KEY", "")
    MSG91_AUTH_KEY = os.getenv("MSG91_AUTH_KEY", "") or MSG91_API_KEY
    MSG91_SENDER_ID = os.getenv("MSG91_SENDER_ID", "")
    MSG91_TEMPLATE_ID = os.getenv("MSG91_TEMPLATE_ID", "")
    # Twilio (optional swap-in)
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
    # AWS SNS (stub / future)
    AWS_SNS_REGION = os.getenv("AWS_SNS_REGION", "ap-south-1")
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    EMAIL_SENDER = os.getenv("EMAIL_SENDER", "")
    SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
