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
    max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    sniff_size = 8192
    chunk_size = 1024 * 1024

    first_chunk = await upload_file.read(sniff_size)
    if not first_chunk:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    mime = magic.from_buffer(first_chunk, mime=True)
    ext = MIME_TO_EXT.get(mime)
    if not ext:
        original_ext = Path(upload_file.filename or "").suffix.lstrip(".").lower()
        if original_ext in settings.ALLOWED_EXTENSIONS:
            ext = original_ext
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {mime}")

    workspace_dir = Path(settings.UPLOAD_DIR) / workspace_id
    workspace_dir.mkdir(parents=True, exist_ok=True)
    temp_path = workspace_dir / f"{uuid.uuid4().hex}.uploading"

    digest = hashlib.sha256()
    total_size = 0
    try:
        async with aiofiles.open(str(temp_path), "wb") as f:
            digest.update(first_chunk)
            total_size += len(first_chunk)
            if total_size > max_size:
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB",
                )
            await f.write(first_chunk)

            while True:
                chunk = await upload_file.read(chunk_size)
                if not chunk:
                    break
                digest.update(chunk)
                total_size += len(chunk)
                if total_size > max_size:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB",
                    )
                await f.write(chunk)
    except Exception:
        delete_file(str(temp_path))
        raise

    file_hash = digest.hexdigest()[:16]
    unique_name = f"{uuid.uuid4().hex}_{file_hash}.{ext}"
    file_path = workspace_dir / unique_name
    os.replace(temp_path, file_path)

    return {
        "file_path": str(file_path),
        "filename": unique_name,
        "original_name": upload_file.filename,
        "file_size": total_size,
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
