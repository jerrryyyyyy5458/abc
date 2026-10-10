"""Authentication APIs for CompareX.

Supports:
- Email/phone OTP authentication
- Password login
- Registration
- Current-user session check
- Logout
- Profile retrieval
- Profile name update after OTP verification
"""

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
)

from database.database import db
from models.models import User
from services.otp_service import OtpError, send_otp, verify_otp


auth_blueprint = Blueprint("auth", __name__)


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------

def _client_ip() -> str | None:
    """Get the client's IP address."""
    forwarded = request.headers.get("X-Forwarded-For", "")

    if forwarded:
        return forwarded.split(",")[0].strip()

    return request.remote_addr


# ---------------------------------------------------------
# OTP - SEND
# ---------------------------------------------------------

@auth_blueprint.post("/auth/otp/send")
def otp_send():
    """Send an OTP to the user's email."""

    payload = request.get_json(silent=True) or {}

    channel = str(payload.get("channel", "email")).strip().lower() or "email"
    destination = str(payload.get("destination", payload.get("email", ""))).strip()

    try:
        result = send_otp(
            channel=channel,
            destination_raw=destination,
            client_ip=_client_ip(),
            app_config=current_app.config,
        )

        # Never return the actual OTP in the HTTP response.
        return jsonify(result), 200

    except OtpError as error:
        return jsonify({
            "message": error.message
        }), error.status

    except Exception:
        current_app.logger.exception("OTP send failed")

        return jsonify({
            "message": "Unable to send OTP. Please try again."
        }), 502


# ---------------------------------------------------------
# OTP - VERIFY
# ---------------------------------------------------------

@auth_blueprint.post("/auth/otp/verify")
def otp_verify():
    """Verify the OTP entered by the user."""

    payload = request.get_json(silent=True) or {}

    channel = str(payload.get("channel", "email")).strip().lower() or "email"
    destination = str(payload.get("destination", payload.get("email", ""))).strip()
    otp = str(payload.get("otp", "")).strip()

    try:
        result = verify_otp(
            channel=channel,
            destination_raw=destination,
            otp_raw=otp,
        )

        return jsonify(result), 200

    except OtpError as error:
        return jsonify({
            "message": error.message
        }), error.status

    except Exception:
        current_app.logger.exception("OTP verification failed")

        return jsonify({
            "message": "Unable to verify OTP. Please try again."
        }), 500


# ---------------------------------------------------------
# CURRENT USER / SESSION
# ---------------------------------------------------------

@auth_blueprint.get("/auth/me")
@jwt_required()
def auth_me():
    """Return the currently authenticated user."""

    user_id = get_jwt_identity()

    user = db.session.get(User, int(user_id))

    if not user:
        return jsonify({
            "message": "Session expired. Please sign in again."
        }), 401

    return jsonify({
        "user": user.to_dict()
    }), 200


# ---------------------------------------------------------
# LOGOUT
# ---------------------------------------------------------

@auth_blueprint.post("/auth/logout")
@jwt_required(optional=True)
def auth_logout():
    """Acknowledge logout.

    The JWT is currently stored on the client, so the frontend
    removes the token after this request.
    """

    return jsonify({
        "message": "Signed out."
    }), 200


# ---------------------------------------------------------
# PASSWORD REGISTRATION
# ---------------------------------------------------------

@auth_blueprint.post("/register")
def register():
    """Register a traditional email/password account."""

    payload = request.get_json(silent=True) or {}

    email = str(payload.get("email", "")).lower().strip()
    password = str(payload.get("password", ""))
    name = str(payload.get("name", "")).strip()

    if "@" not in email or len(password) < 8:
        return jsonify({
            "message": (
                "Use a valid email and a password "
                "with at least 8 characters."
            )
        }), 400

    existing_user = User.query.filter_by(email=email).first()

    if existing_user:
        return jsonify({
            "message": "An account already exists for this email."
        }), 409

    user = User(
        email=email,
        name=name or None,
        email_verified=False,
    )

    user.set_password(password)

    # Initialise user collections.
    user.wishlist = []
    user.search_history = []
    user.price_alerts = []
    user.preferences = {}

    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(
        identity=str(user.id)
    )

    return jsonify({
        "user": user.to_dict(),
        "access_token": access_token,
    }), 201


# ---------------------------------------------------------
# PASSWORD LOGIN
# ---------------------------------------------------------

@auth_blueprint.post("/login")
def login():
    """Traditional email/password login."""

    payload = request.get_json(silent=True) or {}

    email = str(payload.get("email", "")).lower().strip()
    password = str(payload.get("password", ""))

    user = User.query.filter_by(email=email).first()

    if not user or not user.verify_password(password):
        return jsonify({
            "message": "Incorrect email or password."
        }), 401

    access_token = create_access_token(
        identity=str(user.id)
    )

    return jsonify({
        "user": user.to_dict(),
        "access_token": access_token,
    }), 200


# ---------------------------------------------------------
# PROFILE - GET
# ---------------------------------------------------------

@auth_blueprint.get("/profile")
@jwt_required()
def profile():
    """Return the authenticated user's profile."""

    user_id = get_jwt_identity()

    user = db.session.get(User, int(user_id))

    if not user:
        return jsonify({
            "message": "User not found."
        }), 404

    return jsonify({
        "user": user.to_dict()
    }), 200


# ---------------------------------------------------------
# PROFILE - UPDATE NAME
# ---------------------------------------------------------

@auth_blueprint.patch("/profile")
@jwt_required()
def update_profile():
    """Save the user's name after OTP authentication."""

    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()

    # Name is required.
    if len(name) < 2:
        return jsonify({
            "message": "Please enter your name."
        }), 400

    # Prevent excessively long names.
    if len(name) > 80:
        return jsonify({
            "message": "Name must be 80 characters or less."
        }), 400

    user_id = get_jwt_identity()

    user = db.session.get(User, int(user_id))

    if not user:
        return jsonify({
            "message": "User not found."
        }), 404

    user.name = name

    db.session.commit()

    return jsonify({
        "message": "Profile updated successfully.",
        "user": user.to_dict(),
    }), 200