"""OTP generation, delivery, verification, rate limits and user upsert."""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta

from flask_jwt_extended import create_access_token
from werkzeug.security import check_password_hash, generate_password_hash

from database.database import db
from models.models import OtpChallenge, User
from services.email_provider import (
    DevEmailProvider,
    EmailDeliveryError,
    get_email_provider,
)
from services.sms_provider import (
    SmsDeliveryError,
    create_sms_provider_from_config,
)


# ---------------------------------------------------------
# Validation
# ---------------------------------------------------------

PHONE_RE = re.compile(r"^\+?[1-9]\d{7,14}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------
# OTP security settings
# ---------------------------------------------------------

OTP_TTL_MINUTES = 5
RESEND_COOLDOWN_SECONDS = 30
MAX_SENDS_PER_HOUR = 5
MAX_VERIFY_ATTEMPTS = 5


# ---------------------------------------------------------
# OTP error
# ---------------------------------------------------------

class OtpError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


# ---------------------------------------------------------
# Normalization
# ---------------------------------------------------------

def normalize_phone(raw: str) -> str:
    """Normalize and validate a phone number."""

    digits = re.sub(r"[^\d+]", "", (raw or "").strip())

    if digits.startswith("00"):
        digits = "+" + digits[2:]

    if digits.startswith("+"):
        candidate = "+" + re.sub(r"\D", "", digits[1:])
    else:
        local = re.sub(r"\D", "", digits)

        # India: allow a normal 10-digit mobile number.
        if len(local) == 10:
            candidate = "+91" + local

        # India: allow 91XXXXXXXXXX.
        elif local.startswith("91") and len(local) == 12:
            candidate = "+" + local

        else:
            candidate = "+" + local if local else ""

    if not PHONE_RE.match(candidate):
        raise OtpError(
            "Enter a valid mobile number with country code "
            "(e.g. +91 9876543210)."
        )

    return candidate


def normalize_email(raw: str) -> str:
    """Normalize and validate an email address."""

    email = (raw or "").strip().lower()

    if not EMAIL_RE.match(email):
        raise OtpError("Enter a valid email address.")

    return email


# ---------------------------------------------------------
# OTP generation and hashing
# ---------------------------------------------------------

def _generate_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP."""

    return f"{secrets.randbelow(1_000_000):06d}"


def _hash_otp(otp: str) -> str:
    """Hash the OTP before storing it."""

    return generate_password_hash(otp)


def _verify_otp_hash(otp_hash: str, otp: str) -> bool:
    """Verify a submitted OTP against its stored hash."""

    return check_password_hash(otp_hash, otp)


# ---------------------------------------------------------
# Challenge cleanup
# ---------------------------------------------------------

def _purge_expired(destination: str) -> None:
    """Remove expired or already-verified challenges."""

    now = datetime.utcnow()

    OtpChallenge.query.filter(
        OtpChallenge.destination == destination,
        db.or_(
            OtpChallenge.expires_at < now,
            OtpChallenge.verified.is_(True),
        ),
    ).delete(synchronize_session=False)

    db.session.commit()


def _count_recent_sends(destination: str) -> int:
    """Count OTP requests for one email/phone during the last hour."""

    since = datetime.utcnow() - timedelta(hours=1)

    return OtpChallenge.query.filter(
        OtpChallenge.destination == destination,
        OtpChallenge.created_at >= since,
    ).count()


def _discard_challenge(challenge: OtpChallenge | None) -> None:
    """Remove an OTP challenge if delivery fails."""

    if not challenge:
        return

    try:
        db.session.delete(challenge)
        db.session.commit()
    except Exception:
        db.session.rollback()


# ---------------------------------------------------------
# Send OTP
# ---------------------------------------------------------

def send_otp(
    channel: str,
    destination_raw: str,
    client_ip: str | None,
    app_config,
) -> dict:
    """Generate and send an OTP to user's email."""

    channel = (channel or "email").lower().strip()

    if channel == "phone":
        raise OtpError("Login is email-only. SMS OTP is disabled.", 400)

    if channel != "email":
        raise OtpError("Only email login is supported.", 400)

    destination = normalize_email(destination_raw)

    # -----------------------------------------------------
    # Hourly rate limit
    # -----------------------------------------------------

    if _count_recent_sends(destination) >= MAX_SENDS_PER_HOUR:
        raise OtpError(
            "Too many OTP requests. Try again in an hour.",
            429,
        )

    # -----------------------------------------------------
    # Resend cooldown
    # -----------------------------------------------------

    recent = (
        OtpChallenge.query
        .filter_by(
            destination=destination,
            verified=False,
        )
        .order_by(OtpChallenge.created_at.desc())
        .first()
    )

    if recent and recent.created_at:
        elapsed = (
            datetime.utcnow() - recent.created_at
        ).total_seconds()

        if elapsed < RESEND_COOLDOWN_SECONDS:
            wait = max(
                1,
                int(RESEND_COOLDOWN_SECONDS - elapsed),
            )

            raise OtpError(
                f"Please wait {wait}s before requesting another OTP.",
                429,
            )

    # -----------------------------------------------------
    # Invalidate previous unverified challenges
    # -----------------------------------------------------

    now = datetime.utcnow()
    OtpChallenge.query.filter(
        OtpChallenge.destination == destination,
        OtpChallenge.verified.is_(False),
    ).update({"expires_at": now}, synchronize_session=False)

    _purge_expired(destination)

    # -----------------------------------------------------
    # Generate OTP
    # -----------------------------------------------------

    otp = _generate_otp()

    challenge = OtpChallenge(
        channel="email",
        destination=destination,
        otp_hash=_hash_otp(otp),
        expires_at=(
            datetime.utcnow()
            + timedelta(minutes=OTP_TTL_MINUTES)
        ),
        attempts=0,
        max_attempts=MAX_VERIFY_ATTEMPTS,
        verified=False,
        client_ip=client_ip,
    )

    db.session.add(challenge)
    db.session.commit()

    # -----------------------------------------------------
    # Send OTP via Email Provider
    # -----------------------------------------------------

    try:
        provider = get_email_provider(
            app_config.get(
                "EMAIL_PROVIDER",
                "dev",
            ),
            host=app_config.get(
                "SMTP_HOST",
                "",
            ),
            port=app_config.get(
                "SMTP_PORT",
                587,
            ),
            username=app_config.get(
                "SMTP_USERNAME",
                "",
            ),
            password=app_config.get(
                "SMTP_PASSWORD",
                "",
            ),
            sender=app_config.get(
                "EMAIL_SENDER",
                "",
            ),
            api_key=app_config.get(
                "SENDGRID_API_KEY",
                "",
            ),
        )

        provider.send_otp(
            destination,
            otp,
        )

    except EmailDeliveryError as error:
        _discard_challenge(challenge)

        raise OtpError(
            f"Email delivery failed: {error.message}",
            502,
        ) from error

    except Exception:
        _discard_challenge(challenge)

        raise OtpError(
            "Unable to deliver OTP email. Please try again later.",
            502,
        )

    # -----------------------------------------------------
    # Return safe information only (never expose OTP)
    # -----------------------------------------------------

    masked = _mask_destination(
        "email",
        destination,
    )

    is_dev = isinstance(provider, DevEmailProvider)

    return {
        "channel": "email",
        "masked_destination": masked,
        "expires_in": OTP_TTL_MINUTES * 60,
        "resend_in": RESEND_COOLDOWN_SECONDS,
        "message": f"OTP sent to {masked}",
        "dev_mode": is_dev,
    }


# ---------------------------------------------------------
# Mask email / phone
# ---------------------------------------------------------

def _mask_destination(
    channel: str,
    destination: str,
) -> str:
    """Hide part of the destination for UI display."""

    if channel == "phone":
        return (
            destination[:4]
            + "•••••"
            + destination[-3:]
        )

    local, _, domain = destination.partition("@")

    visible = (
        local[:2]
        if len(local) > 2
        else local[:1]
    )

    return f"{visible}***@{domain}"


# ---------------------------------------------------------
# Find or create user
# ---------------------------------------------------------

def _find_or_create_user(
    channel: str,
    destination: str,
) -> tuple[User, bool]:
    """Find user by email or create new OTP-authenticated user."""

    created = False
    email_normalized = destination.strip().lower()

    user = User.query.filter(
        db.func.lower(User.email) == email_normalized
    ).first()

    if not user:
        user = User(
            email=email_normalized,
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

    # Update login timestamp.
    user.last_login_at = datetime.utcnow()
    db.session.commit()

    return user, created


# ---------------------------------------------------------
# Verify OTP
# ---------------------------------------------------------

def verify_otp(
    channel: str,
    destination_raw: str,
    otp_raw: str,
) -> dict:
    """Verify an email OTP and authenticate the user."""

    channel = (channel or "email").lower().strip()

    if channel == "phone":
        raise OtpError(
            "Login is email-only. SMS OTP is disabled.",
            400,
        )

    if channel != "email":
        raise OtpError(
            "Only email login is supported.",
            400,
        )

    destination = normalize_email(destination_raw)

    # Keep only digits from submitted OTP.
    otp = re.sub(
        r"\D",
        "",
        otp_raw or "",
    )

    if len(otp) != 6:
        raise OtpError(
            "Enter the 6-digit OTP."
        )

    # -----------------------------------------------------
    # Find active challenge
    # -----------------------------------------------------

    challenge = (
        OtpChallenge.query
        .filter_by(
            destination=destination,
            channel="email",
            verified=False,
        )
        .order_by(
            OtpChallenge.created_at.desc()
        )
        .first()
    )

    if not challenge:
        raise OtpError(
            "No active OTP found. Request a new one.",
            404,
        )

    # -----------------------------------------------------
    # Check expiration
    # -----------------------------------------------------

    if challenge.is_expired():
        db.session.delete(challenge)
        db.session.commit()

        raise OtpError(
            "OTP expired. Request a new one.",
            400,
        )

    # -----------------------------------------------------
    # Check maximum attempts
    # -----------------------------------------------------

    if challenge.is_locked():
        raise OtpError(
            "Too many incorrect attempts. Request a new OTP.",
            429,
        )

    # -----------------------------------------------------
    # Verify OTP hash
    # -----------------------------------------------------

    if not _verify_otp_hash(
        challenge.otp_hash,
        otp,
    ):
        challenge.attempts += 1
        db.session.commit()

        remaining = max(
            0,
            challenge.max_attempts - challenge.attempts,
        )

        if remaining == 0:
            raise OtpError(
                "Too many incorrect attempts. Request a new OTP.",
                429,
            )

        raise OtpError(
            f"Incorrect OTP. {remaining} attempt(s) left.",
            400,
        )

    # -----------------------------------------------------
    # OTP is correct - invalidate to enforce single-use
    # -----------------------------------------------------

    challenge.verified = True
    db.session.delete(challenge)
    db.session.commit()

    # -----------------------------------------------------
    # Find/create authenticated user
    # -----------------------------------------------------

    user, created = _find_or_create_user(
        "email",
        destination,
    )

    # -----------------------------------------------------
    # Create JWT access token
    # -----------------------------------------------------

    token = create_access_token(
        identity=str(user.id)
    )

    # -----------------------------------------------------
    # Determine whether frontend should ask for name
    # -----------------------------------------------------

    needs_name = not bool(
        (user.name or "").strip()
    )

    # -----------------------------------------------------
    # Return authentication result
    # -----------------------------------------------------

    return {
        "user": user.to_dict(),
        "access_token": token,
        "is_new_user": created,
        "needs_name": needs_name,
        "message": (
            "Welcome to CompareX!"
            if created
            else "Signed in successfully."
        ),
    }