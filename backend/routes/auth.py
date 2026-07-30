"""Auth APIs — password login retained; OTP phone/email is the primary flow."""
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from database.database import db
from models.models import User
from services.otp_service import OtpError, send_otp, verify_otp

auth_blueprint = Blueprint("auth", __name__)


def _client_ip() -> str | None:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr


@auth_blueprint.post("/auth/otp/send")
def otp_send():
    payload = request.get_json(silent=True) or {}
    try:
        result = send_otp(
            channel=payload.get("channel", ""),
            destination_raw=payload.get("destination", ""),
            client_ip=_client_ip(),
            app_config=current_app.config,
        )
        # Never include the OTP (or any debug code) in the HTTP response.
        return jsonify(result)
    except OtpError as error:
        return jsonify({"message": error.message}), error.status
    except Exception:
        return jsonify({"message": "Unable to send OTP. Please try again."}), 502


@auth_blueprint.post("/auth/otp/verify")
def otp_verify():
    payload = request.get_json(silent=True) or {}
    try:
        result = verify_otp(
            channel=payload.get("channel", ""),
            destination_raw=payload.get("destination", ""),
            otp_raw=payload.get("otp", ""),
        )
        return jsonify(result)
    except OtpError as error:
        return jsonify({"message": error.message}), error.status


@auth_blueprint.get("/auth/me")
@jwt_required()
def auth_me():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        return jsonify({"message": "Session expired. Please sign in again."}), 401
    return jsonify({"user": user.to_dict()})


@auth_blueprint.post("/auth/logout")
@jwt_required(optional=True)
def auth_logout():
    # JWT is client-stored; logout is acknowledged so the frontend can clear state.
    return jsonify({"message": "Signed out."})


@auth_blueprint.post("/register")
def register():
    payload = request.get_json(silent=True) or {}
    email = payload.get("email", "").lower().strip()
    password = payload.get("password", "")
    if "@" not in email or len(password) < 8:
        return jsonify({"message": "Use a valid email and a password with at least 8 characters."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "An account already exists for this email."}), 409
    user = User(email=email, name=(payload.get("name", "") or "").strip() or None, email_verified=False)
    user.set_password(password)
    user.wishlist = []
    user.search_history = []
    user.price_alerts = []
    user.preferences = {}
    db.session.add(user)
    db.session.commit()
    return jsonify({"user": user.to_dict(), "access_token": create_access_token(identity=str(user.id))}), 201


@auth_blueprint.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    user = User.query.filter_by(email=payload.get("email", "").lower().strip()).first()
    if not user or not user.verify_password(payload.get("password", "")):
        return jsonify({"message": "Incorrect email or password."}), 401
    return jsonify({"user": user.to_dict(), "access_token": create_access_token(identity=str(user.id))})


@auth_blueprint.get("/profile")
@jwt_required()
def profile():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        return jsonify({"message": "User not found."}), 404
    return jsonify({"user": user.to_dict()})
