"""SMS delivery providers for OTP.

Architecture:
  SmsProvider (ABC)
    ├── DevSmsProvider      — console only (no live SMS)
    ├── Msg91SmsProvider    — primary for Indian numbers
    ├── TwilioSmsProvider   — optional swap-in
    └── AwsSnsSmsProvider   — stub for later

Credentials come from environment variables via Flask config.
Missing production credentials automatically fall back to DevSmsProvider.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod

import requests

logger = logging.getLogger("comparex.sms")

OTP_SMS_BODY = (
    "CompareX\n\n"
    "Your verification code is:\n\n"
    "{otp}\n\n"
    "This OTP expires in 5 minutes.\n\n"
    "Never share this code with anyone."
)


class SmsDeliveryError(Exception):
    """Raised when an SMS provider fails to deliver a message."""

    def __init__(self, message: str = "Unable to send OTP. Please try again."):
        super().__init__(message)
        self.message = message


class SmsProvider(ABC):
    @abstractmethod
    def send_otp(self, phone: str, otp: str) -> None:
        raise NotImplementedError


class DevSmsProvider(SmsProvider):
    """Development provider — prints OTP to the Flask console only."""

    def send_otp(self, phone: str, otp: str) -> None:
        message = (
            f"[CompareX DEV SMS] OTP for {phone}: {otp} "
            f"(expires in 5 minutes) — configure SMS_PROVIDER=msg91 for live delivery"
        )
        logger.warning(message)
        print(message, flush=True)


class Msg91SmsProvider(SmsProvider):
    """Send OTP via MSG91 SendOTP API (DLT template required for India)."""

    SEND_OTP_URL = "https://control.msg91.com/api/v5/otp"

    def __init__(
        self,
        api_key: str,
        template_id: str,
        sender_id: str | None = None,
        *,
        timeout: float = 12.0,
    ):
        self.api_key = (api_key or "").strip()
        self.template_id = (template_id or "").strip()
        self.sender_id = (sender_id or "").strip() or None
        self.timeout = timeout
        if not self.api_key or not self.template_id:
            raise ValueError("MSG91 requires MSG91_API_KEY and MSG91_TEMPLATE_ID.")

    @staticmethod
    def _to_msisdn(phone: str) -> str:
        """MSG91 expects digits with country code, no '+'."""
        return "".join(ch for ch in phone if ch.isdigit())

    def send_otp(self, phone: str, otp: str) -> None:
        mobile = self._to_msisdn(phone)
        if len(mobile) < 10:
            raise SmsDeliveryError("Unable to send OTP. Please try again.")

        params = {
            "template_id": self.template_id,
            "mobile": mobile,
            "otp": otp,
            "otp_expiry": 5,
            "otp_length": 6,
        }
        if self.sender_id:
            params["sender"] = self.sender_id

        headers = {
            "authkey": self.api_key,
            "accept": "application/json",
            "content-type": "application/json",
        }
        # Body carries the same OTP so templates using ##OTP## / var placeholders work.
        payload = {
            "OTP": otp,
            "otp": otp,
            "var": otp,
            "var1": otp,
        }
        if self.sender_id:
            payload["sender"] = self.sender_id

        try:
            response = requests.post(
                self.SEND_OTP_URL,
                params=params,
                json=payload,
                headers=headers,
                timeout=self.timeout,
            )
        except requests.RequestException as error:
            logger.error("MSG91 network error while sending OTP to %s: %s", mobile[-4:].rjust(len(mobile), "*"), error)
            raise SmsDeliveryError("Unable to send OTP. Please try again.") from error

        if response.status_code >= 400:
            logger.error(
                "MSG91 HTTP %s for mobile ending %s: %s",
                response.status_code,
                mobile[-4:],
                _safe_response_text(response),
            )
            raise SmsDeliveryError("Unable to send OTP. Please try again.")

        data = _safe_json(response)
        status = str(data.get("type") or data.get("status") or "").lower()
        # MSG91 success responses typically include type=success or message request id.
        if status and status not in {"success", "ok", "submitted"}:
            logger.error("MSG91 rejected OTP send for mobile ending %s: %s", mobile[-4:], data)
            raise SmsDeliveryError("Unable to send OTP. Please try again.")

        if data.get("message") and status == "error":
            logger.error("MSG91 error for mobile ending %s: %s", mobile[-4:], data)
            raise SmsDeliveryError("Unable to send OTP. Please try again.")

        logger.info("MSG91 OTP dispatched to mobile ending %s", mobile[-4:])


class TwilioSmsProvider(SmsProvider):
    """Optional Twilio SMS provider (swap via SMS_PROVIDER=twilio)."""

    def __init__(self, account_sid: str, auth_token: str, from_number: str, *, timeout: float = 12.0):
        self.account_sid = (account_sid or "").strip()
        self.auth_token = (auth_token or "").strip()
        self.from_number = (from_number or "").strip()
        self.timeout = timeout
        if not self.account_sid or not self.auth_token or not self.from_number:
            raise ValueError("Twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.")

    def send_otp(self, phone: str, otp: str) -> None:
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        body = OTP_SMS_BODY.format(otp=otp)
        try:
            response = requests.post(
                url,
                data={"To": phone, "From": self.from_number, "Body": body},
                auth=(self.account_sid, self.auth_token),
                timeout=self.timeout,
            )
        except requests.RequestException as error:
            logger.error("Twilio network error: %s", error)
            raise SmsDeliveryError("Unable to send OTP. Please try again.") from error

        if response.status_code >= 400:
            logger.error("Twilio HTTP %s: %s", response.status_code, _safe_response_text(response))
            raise SmsDeliveryError("Unable to send OTP. Please try again.")

        logger.info("Twilio OTP dispatched to phone ending %s", "".join(ch for ch in phone if ch.isdigit())[-4:])


class AwsSnsSmsProvider(SmsProvider):
    """Stub for AWS SNS — implement when AWS credentials are provisioned."""

    def __init__(self, region: str = "ap-south-1", access_key: str = "", secret_key: str = ""):
        self.region = region
        self.access_key = access_key
        self.secret_key = secret_key

    def send_otp(self, phone: str, otp: str) -> None:
        raise SmsDeliveryError(
            "AWS SNS is not configured yet. Set SMS_PROVIDER=msg91 or twilio."
        )


def _safe_json(response: requests.Response) -> dict:
    try:
        data = response.json()
        return data if isinstance(data, dict) else {"raw": data}
    except ValueError:
        return {}


def _safe_response_text(response: requests.Response, limit: int = 240) -> str:
    text = (response.text or "").strip().replace("\n", " ")
    return text[:limit]


def get_sms_provider(provider_name: str = "dev", **kwargs) -> SmsProvider:
    """Factory used by otp_service. Prefer create_sms_provider_from_config()."""
    name = (provider_name or "dev").lower().strip()
    try:
        if name == "msg91":
            return Msg91SmsProvider(
                api_key=kwargs.get("api_key") or kwargs.get("auth_key", ""),
                template_id=kwargs.get("template_id") or "",
                sender_id=kwargs.get("sender_id"),
            )
        if name == "twilio":
            return TwilioSmsProvider(
                account_sid=kwargs.get("account_sid", ""),
                auth_token=kwargs.get("auth_token", ""),
                from_number=kwargs.get("from_number", ""),
            )
        if name in {"sns", "aws", "aws_sns"}:
            return AwsSnsSmsProvider(
                region=kwargs.get("region", "ap-south-1"),
                access_key=kwargs.get("access_key", ""),
                secret_key=kwargs.get("secret_key", ""),
            )
    except ValueError as error:
        logger.warning("%s — falling back to development SMS mode.", error)
        return DevSmsProvider()
    return DevSmsProvider()


def create_sms_provider_from_config(app_config) -> SmsProvider:
    """Resolve SMS provider from Flask config with automatic dev fallback."""
    configured = str(app_config.get("SMS_PROVIDER") or "").strip().lower()
    api_key = (
        str(app_config.get("MSG91_API_KEY") or "").strip()
        or str(app_config.get("MSG91_AUTH_KEY") or "").strip()
    )
    template_id = str(app_config.get("MSG91_TEMPLATE_ID") or "").strip()
    sender_id = str(app_config.get("MSG91_SENDER_ID") or "").strip()

    twilio_sid = str(app_config.get("TWILIO_ACCOUNT_SID") or "").strip()
    twilio_token = str(app_config.get("TWILIO_AUTH_TOKEN") or "").strip()
    twilio_from = str(app_config.get("TWILIO_FROM_NUMBER") or "").strip()

    # Auto-pick a live provider when credentials exist and provider is unset/"auto".
    name = configured
    if not name or name == "auto":
        if api_key and template_id:
            name = "msg91"
        elif twilio_sid and twilio_token and twilio_from:
            name = "twilio"
        else:
            name = "dev"

    if name == "msg91" and (not api_key or not template_id):
        logger.warning("MSG91 credentials missing — falling back to development SMS mode.")
        return DevSmsProvider()

    if name == "twilio" and (not twilio_sid or not twilio_token or not twilio_from):
        logger.warning("Twilio credentials missing — falling back to development SMS mode.")
        return DevSmsProvider()

    return get_sms_provider(
        name,
        api_key=api_key,
        auth_key=api_key,
        template_id=template_id,
        sender_id=sender_id,
        account_sid=twilio_sid,
        auth_token=twilio_token,
        from_number=twilio_from,
        region=str(app_config.get("AWS_SNS_REGION") or "ap-south-1"),
        access_key=str(app_config.get("AWS_ACCESS_KEY_ID") or ""),
        secret_key=str(app_config.get("AWS_SECRET_ACCESS_KEY") or ""),
    )
