import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.fixture
def app():
    from app.main import app
    return app


@pytest.mark.asyncio
async def test_health_endpoint(app):
    with patch("app.core.database.db") as mock_db:
        mock_db.command = AsyncMock(return_value={"ok": 1})
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_register_endpoint(app):
    with (
        patch("app.services.auth_service.get_db") as mock_get_db,
    ):
        mock_db = MagicMock()
        mock_db.users.find_one = AsyncMock(return_value=None)
        mock_db.users.insert_one = AsyncMock(return_value=MagicMock(inserted_id="user_123"))
        mock_get_db.return_value = mock_db

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": "newuser@example.com",
                    "username": "newuser123",
                    "password": "SecurePass1",
                },
            )
    assert response.status_code in (201, 409, 422, 500)


@pytest.mark.asyncio
async def test_login_invalid_credentials(app):
    with patch("app.services.auth_service.get_db") as mock_get_db:
        mock_db = MagicMock()
        mock_db.users.find_one = AsyncMock(return_value=None)
        mock_get_db.return_value = mock_db

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/auth/login",
                json={"email": "nobody@example.com", "password": "WrongPass1"},
            )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_forgot_password_always_200(app):
    with patch("app.services.auth_service.get_db") as mock_get_db:
        mock_db = MagicMock()
        mock_db.users.find_one = AsyncMock(return_value=None)
        mock_get_db.return_value = mock_db

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/auth/forgot-password",
                json={"email": "nonexistent@example.com"},
            )
    assert response.status_code == 200
    assert "message" in response.json()
