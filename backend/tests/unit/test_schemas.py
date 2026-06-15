import pytest
from pydantic import ValidationError
from app.schemas.auth import RegisterRequest, LoginRequest


def test_register_valid():
    req = RegisterRequest(email="test@example.com", username="testuser", password="TestPass1")
    assert req.email == "test@example.com"
    assert req.username == "testuser"


def test_register_invalid_email():
    with pytest.raises(ValidationError):
        RegisterRequest(email="not-an-email", username="user", password="TestPass1")


def test_register_weak_password_no_uppercase():
    with pytest.raises(ValidationError):
        RegisterRequest(email="test@test.com", username="user", password="weakpass1")


def test_register_weak_password_no_digit():
    with pytest.raises(ValidationError):
        RegisterRequest(email="test@test.com", username="user", password="WeakPassNoDigit")


def test_register_username_with_special_chars():
    with pytest.raises(ValidationError):
        RegisterRequest(email="test@test.com", username="user@name!", password="TestPass1")


def test_register_short_username():
    with pytest.raises(ValidationError):
        RegisterRequest(email="test@test.com", username="ab", password="TestPass1")


def test_login_valid():
    req = LoginRequest(email="user@test.com", password="anypassword")
    assert req.email == "user@test.com"
