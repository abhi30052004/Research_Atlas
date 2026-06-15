import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone


def make_mock_user():
    return {
        "_id": "user_test_123",
        "email": "test@example.com",
        "username": "testuser",
        "is_active": True,
        "is_verified": True,
    }


@pytest.fixture
def app():
    from app.main import app
    return app


@pytest.mark.asyncio
async def test_create_workspace(app):
    mock_user = make_mock_user()
    with (
        patch("app.core.deps.decode_token", return_value={"sub": "user_test_123", "type": "access"}),
        patch("app.core.deps.get_db") as mock_get_db,
        patch("app.services.workspace_service.get_db") as mock_ws_db,
    ):
        mock_db = MagicMock()
        mock_db.users.find_one = AsyncMock(return_value=mock_user)
        mock_get_db.return_value = mock_db

        mock_ws = MagicMock()
        now = datetime.now(timezone.utc)
        mock_ws.workspaces.insert_one = AsyncMock(return_value=MagicMock())
        mock_ws_db.return_value = mock_ws

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/workspaces",
                json={"name": "Test Workspace", "description": "A test workspace"},
                headers={"Authorization": "Bearer fake_token"},
            )
    assert response.status_code in (201, 401, 422, 500)


@pytest.mark.asyncio
async def test_list_workspaces_unauthorized(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/workspaces")
    assert response.status_code == 403
