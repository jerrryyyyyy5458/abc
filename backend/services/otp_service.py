"""OTP generation, delivery, verification, rate limits and user upsert."""
from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta

from flask_jwt_extended import create_access_token
from werkzeug.security import check_password_hash, generate_password_hash

from database.database import db
from models.models import OtpChallenge, User
from services.email_provider import get_email_provider
from services.sms_provider import SmsDeliveryError, create_sms_provider_from_config

PHONE_RE = re.compile(r"^\+?[1-9]\d{7,14}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

OTP_TTL_MINUTES = 5
RESEND_COOLDOWN_SECONDS = 30
MAX_SENDS_PER_HOUR = 5
MAX_VERIFY_ATTEMPTS = 5


class OtpError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"[^\d+]", "", (raw or "").strip())
    if digits.startswith("00"):
        digits = "+" + digits[2:]
    if digits.startswith("+"):
        candidate = "+" + re.sub(r"\D", "", digits[1:])
    else:
        local = re.sub(r"\D", "", digits)
        if len(local) == 10:
            candidate = "+91" + local
        elif local.startswith("91") and len(local) == 12:
            candidate = "+" + local
        else:
            candidate = "+" + local if local else ""
    if not PHONE_RE.match(candidate):
        raise OtpError("Enter a valid mobile number with country code (e.g. +91 9876543210).")
    return candidate


def normalize_email(raw: str) -> str:
    email = (raw or "").strip().lower()
    if not EMAIL_RE.match(email):
        raise OtpError("Enter a valid email address.")
    return email


def _generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _hash_otp(otp: str) -> str:
    return generate_password_hash(otp)


def _verify_otp_hash(otp_hash: str, otp: str) -> bool:
    return check_password_hash(otp_hash, otp)


def _purge_expired(destination: str) -> None:
    now = datetime.utcnow()
    OtpChallenge.query.filter(
        OtpChallenge.destination == destination,
        db.or_(OtpChallenge.expires_at < now, OtpChallenge.verified.is_(True)),
    ).delete(synchronize_session=False)
    db.session.commit()


def _count_recent_sends(destination: str) -> int:
    """Max 5 OTP requests per hour for a single phone/email."""
    since = datetime.utcnow() - timedelta(hours=1)
    return OtpChallenge.query.filter(
        OtpChallenge.destination == destination,
        OtpChallenge.created_at >= since,
    ).count()


def _discard_challenge(challenge: OtpChallenge | None) -> None:
    if not challenge:
        return
    try:
        db.session.delete(challenge)
        db.session.commit()
    except Exception:
        db.session.rollback()


def send_otp(channel: str, destination_raw: str, client_ip: str | None, app_config) -> dict:
    channel = (channel or "").lower().strip()
    if channel not in {"phone", "email"}:
        raise OtpError("Choose phone or email to continue.")

    destination = normalize_phone(destination_raw) if channel == "phone" else normalize_email(destination_raw)

    # Count before purge so expired challenges still enforce the hourly cap.
    if _count_recent_sends(destination) >= MAX_SENDS_PER_HOUR:
        raise OtpError("Too many OTP requests. Try again in an hour.", 429)

    recent = (
        OtpChallenge.query.filter_by(destination=destination, verified=False)
        .order_by(OtpChallenge.created_at.desc())
        .first()
    )
    if recent and recent.created_at:
        elapsed = (datetime.utcnow() - recent.created_at).total_seconds()
        if elapsed < RESEND_COOLDOWN_SECONDS:
            wait = max(1, int(RESEND_COOLDOWN_SECONDS - elapsed))
            raise OtpError(f"Please wait {wait}s before requesting another OTP.", 429)

    _purge_expired(destination)

    otp = _generate_otp()
    challenge = OtpChallenge(
        channel=channel,
        destination=destination,
        otp_hash=_hash_otp(otp),
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
        attempts=0,
        max_attempts=MAX_VERIFY_ATTEMPTS,
        verified=False,
        client_ip=client_ip,
    )
    db.session.add(challenge)
    db.session.commit()

    try:
        if channel == "phone":
            provider = create_sms_provider_from_config(app_config)
            provider.send_otp(destination, otp)
        else:
            provider = get_email_provider(
                app_config.get("EMAIL_PROVIDER", "dev"),
                host=app_config.get("SMTP_HOST", ""),
                port=app_config.get("SMTP_PORT", 587),
                username=app_config.get("SMTP_USERNAME", ""),
                password=app_config.get("SMTP_PASSWORD", ""),
                sender=app_config.get("EMAIL_SENDER", ""),
                api_key=app_config.get("SENDGRID_API_KEY", ""),
            )
            provider.send_otp(destination, otp)
    except SmsDeliveryError as error:
        _discard_challenge(challenge)
        raise OtpError(error.message or "Unable to send OTP. Please try again.", 502) from error
    except NotImplementedError:
        _discard_challenge(challenge)
        raise OtpError("Unable to send OTP. Please try again.", 502)
    except Exception:
        _discard_challenge(challenge)
        raise OtpError("Unable to send OTP. Please try again.", 502)

    # Plain OTP never leaves this function (except live SMS / console in DevSmsProvider).
    masked = _mask_destination(channel, destination)
    return {
        "channel": channel,
        "masked_destination": masked,
        "expires_in": OTP_TTL_MINUTES * 60,
        "resend_in": RESEND_COOLDOWN_SECONDS,
        "message": f"OTP sent to {masked}",
    }


def _mask_destination(channel: str, destination: str) -> str:
    if channel == "phone":
        return destination[:4] + "•••••" + destination[-3:]
    local, _, domain = destination.partition("@")
    visible = local[:2] if len(local) > 2 else local[:1]
    return f"{visible}•••@{domain}"


def _find_or_create_user(channel: str, destination: str) -> tuple[User, bool]:
    created = False
    if channel == "phone":
        user = User.query.filter_by(phone=destination).first()
        if not user:
            user = User(
                phone=destination,
                phone_verified=True,
                wishlist=[],
                search_history=[],
                price_alerts=[],
                preferences={},
            )
            db.session.add(user)
            created = True
        else:
            user.phone_verified = True
    else:
        user = User.query.filter_by(email=destination).first()
        if not user:
            user = User(
                email=destination,
                email_verified=True,
                wishlist=[],
                search_history=[],
                price_alerts=[],
                preferences={},
            )
            db.session.add(user)
            created = True
        else:
            user.email_verified = True

    user.last_login_at = datetime.utcnow()
    db.session.commit()
    return user, created


def verify_otp(channel: str, destination_raw: str, otp_raw: str) -> dict:
    channel = (channel or "").lower().strip()
    if channel not in {"phone", "email"}:
        raise OtpError("Choose phone or email to continue.")

    destination = normalize_phone(destination_raw) if channel == "phone" else normalize_email(destination_raw)
    otp = re.sub(r"\D", "", otp_raw or "")
    if len(otp) != 6:
        raise OtpError("Enter the 6-digit OTP.")

    challenge = (
        OtpChallenge.query.filter_by(destination=destination, channel=channel, verified=False)
        .order_by(OtpChallenge.created_at.desc())
        .first()
    )
    if not challenge:
        raise OtpError("No active OTP found. Request a new one.", 404)
    if challenge.is_expired():
        db.session.delete(challenge)
        db.session.commit()
        raise OtpError("OTP expired. Request a new one.")
    if challenge.is_locked():
        raise OtpError("Too many incorrect attempts. Request a new OTP.", 429)

    if not _verify_otp_hash(challenge.otp_hash, otp):
        challenge.attempts += 1
        db.session.commit()
        remaining = max(0, challenge.max_attempts - challenge.attempts)
        raise OtpError(f"Incorrect OTP. {remaining} attempt(s) left.")

    challenge.verified = True
    db.session.delete(challenge)
    db.session.commit()

    user, created = _find_or_create_user(channel, destination)
    token = create_access_token(identity=str(user.id))
    return {
        "user": user.to_dict(),
        "access_token": token,
        "is_new_user": created,
        "message": "Welcome to CompareX!" if created else "Signed in successfully.",
    }
