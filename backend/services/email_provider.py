
"""Email delivery providers for CompareX."""
from __future__ import annotations

import logging
import smtplib
import ssl
from abc import ABC, abstractmethod
from email.message import EmailMessage

logger = logging.getLogger("comparex.email")


class EmailDeliveryError(Exception):
    """Raised when OTP email delivery fails."""

    def __init__(self, message: str = "Email delivery failed."):
        super().__init__(message)
        self.message = message


class EmailProvider(ABC):
    @abstractmethod
    def send_otp(self, email: str, otp: str) -> None:
        raise NotImplementedError


class DevEmailProvider(EmailProvider):
    """Development provider: prints OTPs to the Flask console."""

    def send_otp(self, email: str, otp: str) -> None:
        message = (
            f"[CompareX DEV EMAIL] OTP for {email}: {otp} "
            "(expires in 5 minutes)"
        )
        logger.info(message)
        print(message, flush=True)


class SmtpEmailProvider(EmailProvider):
    """Send email securely using SMTP with SSL or STARTTLS."""

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        sender: str,
    ):
        self.host = (host or "").strip()
        self.port = int(port or 587)
        self.username = (username or "").strip()
        self.password = (password or "").replace(" ", "").strip()
        self.sender = (sender or self.username).strip()

    def send_otp(self, email: str, otp: str) -> None:
        if not self.host:
            raise EmailDeliveryError("SMTP host is not configured.")

        if not self.username or not self.password:
            raise EmailDeliveryError(
                "SMTP username or App Password is missing."
            )

        if not self.sender:
            raise EmailDeliveryError("Email sender is not configured.")

        msg = EmailMessage()
        msg["Subject"] = "Your CompareX verification code"
        msg["From"] = f"CompareX <{self.sender}>"
        msg["To"] = email

        msg.set_content(
            f"Your CompareX verification code is: {otp}\n\n"
            "This code expires in 5 minutes.\n"
            "Never share this code with anyone."
        )

        msg.add_alternative(
            f"""\
            <div style="font-family:Arial,sans-serif;max-width:500px;
                        margin:auto;padding:24px;border:1px solid #e0e0e0;
                        border-radius:12px;background:#ffffff;">
              <h2 style="color:#ff7a1a;">CompareX</h2>
              <p>Use this verification code to sign in:</p>
              <div style="font-size:32px;font-weight:bold;
                          letter-spacing:6px;color:#111;
                          padding:18px;background:#f5f5f7;
                          border-radius:8px;text-align:center;">
                {otp}
              </div>
              <p style="font-size:13px;color:#777;">
                This code expires in 5 minutes. Never share it.
              </p>
            </div>
            """,
            subtype="html",
        )

        context = ssl.create_default_context()

        try:
            if self.port == 465:
                # Gmail SMTP over implicit SSL.
                with smtplib.SMTP_SSL(
                    self.host,
                    self.port,
                    timeout=20,
                    context=context,
                ) as server:
                    server.login(self.username, self.password)
                    server.send_message(msg)

            else:
                # Gmail SMTP using STARTTLS, normally port 587.
                with smtplib.SMTP(
                    self.host,
                    self.port,
                    timeout=20,
                ) as server:
                    server.ehlo()
                    server.starttls(context=context)
                    server.ehlo()
                    server.login(self.username, self.password)
                    server.send_message(msg)

            logger.info("OTP email sent successfully to %s", email)

        except Exception as error:
            logger.exception("Failed to send OTP email via SMTP")
            raise EmailDeliveryError(
                f"SMTP delivery failed: {type(error).__name__}: {error}"
            ) from error


class SendGridEmailProvider(EmailProvider):
    """Send email using the SendGrid API."""

    def __init__(self, api_key: str, sender: str):
        self.api_key = (api_key or "").strip()
        self.sender = (sender or "").strip()

    def send_otp(self, email: str, otp: str) -> None:
        if not self.api_key or not self.sender:
            raise EmailDeliveryError(
                "SendGrid API key or sender address is not configured."
            )

        import requests

        try:
            response = requests.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [
                        {"to": [{"email": email}]}
                    ],
                    "from": {
                        "email": self.sender,
                        "name": "CompareX",
                    },
                    "subject": "Your CompareX verification code",
                    "content": [
                        {
                            "type": "text/plain",
                            "value": (
                                f"Your CompareX verification code is: {otp}\n\n"
                                "This code expires in 5 minutes."
                            ),
                        }
                    ],
                },
                timeout=15,
            )

            if response.status_code not in (200, 202):
                raise EmailDeliveryError(
                    f"SendGrid returned status {response.status_code}."
                )

        except EmailDeliveryError:
            raise
        except Exception as error:
            logger.exception("SendGrid delivery error")
            raise EmailDeliveryError(
                f"SendGrid delivery failed: {type(error).__name__}: {error}"
            ) from error


def get_email_provider(provider_name: str = "dev", **kwargs) -> EmailProvider:
    name = (provider_name or "dev").lower().strip()

    if name == "smtp":
        return SmtpEmailProvider(
            host=kwargs.get("host", ""),
            port=kwargs.get("port", 587),
            username=kwargs.get("username", ""),
            password=kwargs.get("password", ""),
            sender=kwargs.get("sender", ""),
        )

    if name == "sendgrid":
        return SendGridEmailProvider(
            api_key=kwargs.get("api_key", ""),
            sender=kwargs.get("sender", ""),
        )

    return DevEmailProvider()
