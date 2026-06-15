import os
import uuid
import hashlib
import aiofiles
from pathlib import Path
from fastapi import UploadFile, HTTPException
import magic

from app.core.config import settings

MIME_TO_EXT = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
}


async def save_upload_file(upload_file: UploadFile, workspace_id: str) -> dict:
    content = await upload_file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB")

    mime = magic.from_buffer(content, mime=True)
    ext = MIME_TO_EXT.get(mime)
    if not ext:
        original_ext = Path(upload_file.filename or "").suffix.lstrip(".").lower()
        if original_ext in settings.ALLOWED_EXTENSIONS:
            ext = original_ext
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {mime}")

    file_hash = hashlib.sha256(content).hexdigest()[:16]
    unique_name = f"{uuid.uuid4().hex}_{file_hash}.{ext}"

    workspace_dir = Path(settings.UPLOAD_DIR) / workspace_id
    workspace_dir.mkdir(parents=True, exist_ok=True)
    file_path = workspace_dir / unique_name

    async with aiofiles.open(str(file_path), "wb") as f:
        await f.write(content)

    return {
        "file_path": str(file_path),
        "filename": unique_name,
        "original_name": upload_file.filename,
        "file_size": len(content),
        "mime_type": mime,
        "extension": ext,
    }


def delete_file(file_path: str) -> None:
    try:
        path = Path(file_path)
        if path.exists():
            path.unlink()
    except Exception:
        pass


def sanitize_filename(filename: str) -> str:
    import re
    filename = re.sub(r"[^\w\s\-\.]", "_", filename)
    return filename[:255]
