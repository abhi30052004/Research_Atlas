import io
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import UploadFile


@pytest.mark.asyncio
async def test_save_upload_file_streams_to_workspace(tmp_path):
    from app.core.config import settings
    from app.utils.file_utils import save_upload_file

    content = b"hello atlas\n" * 1024
    upload = UploadFile(filename="notes.txt", file=io.BytesIO(content))

    with patch.object(settings, "UPLOAD_DIR", str(tmp_path)):
        file_info = await save_upload_file(upload, "workspace_1")

    saved_path = Path(file_info["file_path"])
    assert saved_path.exists()
    assert saved_path.read_bytes() == content
    assert saved_path.parent == tmp_path / "workspace_1"
    assert file_info["extension"] == "txt"
    assert file_info["file_size"] == len(content)
