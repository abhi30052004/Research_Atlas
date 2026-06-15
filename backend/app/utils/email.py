import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to_email: str, subject: str, html_body: str) -> bool:
    if not settings.SMTP_HOST:
        logger.info(f"Email not configured. Would send to {to_email}: {subject}")
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.FROM_EMAIL
        msg["To"] = to_email
        part = MIMEText(html_body, "html")
        msg.attach(part)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


async def send_password_reset_email(email: str, reset_token: str) -> bool:
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
    html = f"""
    <html>
    <body>
        <h2>Reset Your Atlas AI Password</h2>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="{reset_url}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
            Reset Password
        </a>
        <p>If you didn't request this, ignore this email.</p>
    </body>
    </html>
    """
    return await send_email(email, "Reset Your Atlas AI Password", html)
