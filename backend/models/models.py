"""Database models for accounts and temporary OTP challenges."""
from datetime import datetime
from werkzeug.security import check_password_hash, generate_password_hash
from database.database import db


class TimestampMixin:
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=True, index=True)
    phone = db.Column(db.String(20), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(255), nullable=True)
    name = db.Column(db.String(120), nullable=True)
    wishlist = db.Column(db.JSON, nullable=False, default=list)
    search_history = db.Column(db.JSON, nullable=False, default=list)
    price_alerts = db.Column(db.JSON, nullable=False, default=list)
    preferences = db.Column(db.JSON, nullable=False, default=dict)
    phone_verified = db.Column(db.Boolean, default=False, nullable=False)
    email_verified = db.Column(db.Boolean, default=False, nullable=False)
    last_login_at = db.Column(db.DateTime, nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def verify_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "phone": self.phone,
            "name": self.name,
            "phone_verified": bool(self.phone_verified),
            "email_verified": bool(self.email_verified),
            "wishlist": self.wishlist or [],
            "search_history": self.search_history or [],
            "price_alerts": self.price_alerts or [],
            "preferences": self.preferences or {},
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "last_login_at": self.last_login_at.isoformat() + "Z" if self.last_login_at else None,
        }


class OtpChallenge(db.Model):
    """Temporary OTP challenge — invalidated after verify or expiry."""

    __tablename__ = "otp_challenges"

    id = db.Column(db.Integer, primary_key=True)
    channel = db.Column(db.String(16), nullable=False)  # phone | email
    destination = db.Column(db.String(255), nullable=False, index=True)
    otp_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    attempts = db.Column(db.Integer, default=0, nullable=False)
    max_attempts = db.Column(db.Integer, default=5, nullable=False)
    verified = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    client_ip = db.Column(db.String(64), nullable=True)

    def is_expired(self):
        return datetime.utcnow() >= self.expires_at

    def is_locked(self):
        return self.attempts >= self.max_attempts
