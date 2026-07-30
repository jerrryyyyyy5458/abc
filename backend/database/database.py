"""SQLAlchemy database bootstrap and lightweight SQLite schema upgrades."""
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text

db = SQLAlchemy()


def initialize_database(app):
    with app.app_context():
        db.create_all()
        _ensure_user_otp_columns()


def _ensure_user_otp_columns():
    """Add OTP-era columns to an existing SQLite users table without wiping data."""
    try:
        inspector = inspect(db.engine)
        if "users" not in inspector.get_table_names():
            return
        existing = {column["name"] for column in inspector.get_columns("users")}
        alters = []
        if "phone" not in existing:
            alters.append("ALTER TABLE users ADD COLUMN phone VARCHAR(20)")
        if "wishlist" not in existing:
            alters.append("ALTER TABLE users ADD COLUMN wishlist JSON")
        if "search_history" not in existing:
            alters.append("ALTER TABLE users ADD COLUMN search_history JSON")
        if "price_alerts" not in existing:
            alters.append("ALTER TABLE users ADD COLUMN price_alerts JSON")
        if "preferences" not in existing:
            alters.append("ALTER TABLE users ADD COLUMN preferences JSON")
        if "phone_verified" not in existing:
            alters.append("ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT 0")
        if "email_verified" not in existing:
            alters.append("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0")
        if "last_login_at" not in existing:
            alters.append("ALTER TABLE users ADD COLUMN last_login_at DATETIME")

        for statement in alters:
            db.session.execute(text(statement))
        if alters:
            db.session.commit()
    except Exception as error:
        db.session.rollback()
        print(f"[CompareX] Schema upgrade skipped: {error}", flush=True)
