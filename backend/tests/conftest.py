import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture(autouse=True)
def mock_db_connection():
    with patch("app.core.database.client", MagicMock()):
        with patch("app.core.database.db", MagicMock()):
            yield


@pytest.fixture(autouse=True)
def mock_redis_connection():
    with patch("app.core.redis.redis_client", None):
        yield


@pytest.fixture
def mock_openai():
    with patch("openai.AsyncOpenAI") as mock:
        instance = MagicMock()
        instance.chat.completions.create = AsyncMock(
            return_value=MagicMock(
                choices=[MagicMock(message=MagicMock(content="Test response"))],
                usage=MagicMock(total_tokens=100),
            )
        )
        instance.embeddings.create = AsyncMock(
            return_value=MagicMock(data=[MagicMock(embedding=[0.1] * 1536)])
        )
        mock.return_value = instance
        yield instance


@pytest.fixture
def mock_groq():
    with patch("groq.AsyncGroq") as mock:
        instance = MagicMock()
        instance.chat.completions.create = AsyncMock(
            return_value=MagicMock(
                choices=[MagicMock(message=MagicMock(content="Test response from Groq"))],
                usage=MagicMock(total_tokens=80),
            )
        )
        mock.return_value = instance
        yield instance
