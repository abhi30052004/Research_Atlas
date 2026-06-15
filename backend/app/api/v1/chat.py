import json
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, status
from fastapi.responses import StreamingResponse
from typing import Optional

from app.schemas.chat import ChatCreate, ChatMessageRequest, RegenerateRequest
from app.services.chat_service import chat_service
from app.core.deps import get_current_user
from app.core.security import decode_token

router = APIRouter()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_chat(data: ChatCreate, current_user: dict = Depends(get_current_user)):
    return await chat_service.create_chat(
        data.workspace_id, str(current_user["_id"]), data.model, data.title
    )


@router.get("")
async def list_chats(
    workspace_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    chats = await chat_service.list_chats(workspace_id, str(current_user["_id"]))
    return {"chats": chats, "total": len(chats)}


@router.get("/{chat_id}")
async def get_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    return await chat_service.get_chat(chat_id, str(current_user["_id"]))


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    await chat_service.delete_chat(chat_id, str(current_user["_id"]))


@router.post("/{chat_id}/messages/stream")
async def stream_message(
    chat_id: str,
    data: ChatMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    async def generate():
        async for chunk in chat_service.send_message_stream(
            chat_id, str(current_user["_id"]), data.content, data.model
        ):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/{chat_id}/messages/regenerate")
async def regenerate_message(
    chat_id: str,
    data: RegenerateRequest,
    current_user: dict = Depends(get_current_user),
):
    return await chat_service.regenerate_message(
        chat_id, str(current_user["_id"]), data.message_id, data.model
    )


@router.websocket("/ws/{workspace_id}")
async def websocket_chat(websocket: WebSocket, workspace_id: str, token: str = Query(...)):
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id or payload.get("type") != "access":
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "content": "Invalid JSON"}))
                continue

            action = msg.get("action")
            if action == "send_message":
                chat_id = msg.get("chat_id")
                content = msg.get("content", "")
                model = msg.get("model")
                if not chat_id or not content:
                    await websocket.send_text(json.dumps({"type": "error", "content": "Missing chat_id or content"}))
                    continue
                async for chunk in chat_service.send_message_stream(chat_id, user_id, content, model):
                    await websocket.send_text(chunk)
            elif action == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            else:
                await websocket.send_text(json.dumps({"type": "error", "content": f"Unknown action: {action}"}))
    except WebSocketDisconnect:
        pass
