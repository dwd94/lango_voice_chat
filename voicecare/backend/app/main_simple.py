"""Simplified FastAPI application for voice chat translation."""

import uuid
import json
from typing import Dict, Set
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .core.config import settings
from .core.logging import get_logger
from .services.translate_libre import translate_service
from .services.tts_elevenlabs import ElevenLabsTTSService
from .services.stt_whisper import WhisperSTTService

logger = get_logger(__name__)

# Pydantic models for WebSocket messages
class SimpleMessage(BaseModel):
    text: str = None
    audio_data: str = None  # base64 encoded audio
    source_lang: str
    target_lang: str
    sender_id: str

class SimpleResponse(BaseModel):
    original_text: str = None
    translated_text: str
    audio_url: str = None
    message_id: str

class ConnectionManager:
    """Manages WebSocket connections."""
    
    def __init__(self) -> None:
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[str, str] = {}  # user_id -> connection_id
    
    async def connect(self, websocket: WebSocket, connection_id: str) -> None:
        """Accept new WebSocket connection."""
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        logger.info(f"WebSocket connected: {connection_id}")
    
    def disconnect(self, connection_id: str) -> None:
        """Remove WebSocket connection."""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        
        # Remove user mapping
        user_id_to_remove = None
        for user_id, conn_id in self.user_connections.items():
            if conn_id == connection_id:
                user_id_to_remove = user_id
                break
        
        if user_id_to_remove:
            del self.user_connections[user_id_to_remove]
        
        logger.info(f"WebSocket disconnected: {connection_id}")
    
    async def send_message(self, websocket: WebSocket, message: dict) -> None:
        """Send message to WebSocket client."""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending message: {e}")

# Global connection manager
manager = ConnectionManager()

# Initialize services
tts_service = ElevenLabsTTSService()
stt_service = WhisperSTTService()

# Create FastAPI app
app = FastAPI(
    title="Simple Voice Chat Translation",
    description="Simple voice chat with translation",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication."""
    connection_id = str(uuid.uuid4())
    await manager.connect(websocket, connection_id)
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Validate message
            try:
                message = SimpleMessage(**message_data)
            except Exception as e:
                await manager.send_message(websocket, {
                    "type": "error",
                    "message": f"Invalid message format: {str(e)}"
                })
                continue
            
            # Process message
            message_id = str(uuid.uuid4())
            original_text = None
            
            try:
                # Handle audio or text input
                if message.audio_data:
                    # Process audio with STT
                    try:
                        import base64
                        audio_bytes = base64.b64decode(message.audio_data)
                        original_text = await stt_service.transcribe(audio_bytes)
                        logger.info(f"STT result: {original_text}")
                    except Exception as e:
                        logger.error(f"STT failed: {e}")
                        await manager.send_message(websocket, {
                            "type": "error",
                            "message": f"Speech recognition failed: {str(e)}"
                        })
                        continue
                elif message.text:
                    original_text = message.text
                else:
                    await manager.send_message(websocket, {
                        "type": "error",
                        "message": "No text or audio data provided"
                    })
                    continue
                
                # Translate text
                translated_text = await translate_service.translate(
                    original_text,
                    message.source_lang,
                    message.target_lang
                )
                
                # Generate TTS audio
                audio_url = None
                try:
                    audio_data = await tts_service.synthesize(
                        text=translated_text,
                        voice_id="21m00Tcm4TlvDq8ikWAM",  # Default voice
                        model_id="eleven_monolingual_v1"
                    )
                    if audio_data:
                        # In a real app, you'd save this to a file and return URL
                        # For simplicity, we'll just indicate audio was generated
                        audio_url = f"audio_{message_id}.mp3"
                except Exception as e:
                    logger.warning(f"TTS failed: {e}")
                
                # Send response
                response = SimpleResponse(
                    original_text=original_text,
                    translated_text=translated_text,
                    audio_url=audio_url,
                    message_id=message_id
                )
                
                await manager.send_message(websocket, {
                    "type": "translation",
                    "data": response.dict()
                })
                
            except Exception as e:
                logger.error(f"Translation error: {e}")
                await manager.send_message(websocket, {
                    "type": "error",
                    "message": f"Translation failed: {str(e)}"
                })
                
    except WebSocketDisconnect:
        manager.disconnect(connection_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(connection_id)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "simple-voice-chat"}

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Simple Voice Chat Translation API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main_simple:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )
