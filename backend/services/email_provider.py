"""Email delivery providers. Swap DevEmailProvider for SMTP / SendGrid / Mailgun later."""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod

logger = logging.getLogger("comparex.email")


class EmailProvider(ABC):
    @abstractmethod
    def send_otp(self, email: str, otp: str) -> None:
        raise NotImplementedError


class DevEmailProvider(EmailProvider):
    """Development provider — logs OTP to the Flask console."""

    def send_otp(self, email: str, otp: str) -> None:
        message = f"[CompareX DEV EMAIL] OTP for {email}: {otp} (expires in 5 minutes)"
        logger.warning(message)
        print(message, flush=True)


class SmtpEmailProvider(EmailProvider):
    def __init__(self, host: str, port: int, username: str, password: str, sender: str):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.sender = sender

    def send_otp(self, email: str, otp: str) -> None:
        raise NotImplementedError("Configure SMTP credentials to enable live email delivery.")


class SendGridEmailProvider(EmailProvider):
    def __init__(self, api_key: str, sender: str):
        self.api_key = api_key
        self.sender = sender

    def send_otp(self, email: str, otp: str) -> None:
        raise NotImplementedError("Configure SendGrid credentials to enable live email delivery.")


def get_email_provider(provider_name: str = "dev", **kwargs) -> EmailProvider:
    name = (provider_name or "dev").lower()
    if name == "smtp":
        return SmtpEmailProvider(
            kwargs.get("host", ""),
            int(kwargs.get("port", 587)),
            kwargs.get("username", ""),
            kwargs.get("password", ""),
            kwargs.get("sender", ""),
        )
    if name == "sendgrid":
        return SendGridEmailProvider(kwargs.get("api_key", ""), kwargs.get("sender", ""))
    return DevEmailProvider()
