"""Simplified FastAPI application for voice chat translation."""

import uuid
import json
from typing import Dict, Set
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from .core.config import settings
from .core.logging import get_logger
from .services.translate_libre import translate_service
from .services.tts_elevenlabs import ElevenLabsTTSService
from .services.tts_openai import OpenAITTSService
from .services.stt_elevenlabs import ElevenLabsSTTService
from .services.stt_whisper import WhisperSTTService
from .services.stt_openai import OpenAISTTService

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
    audio_url: Optional[str] = None
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

# Initialize services based on config
def get_stt_service():
    """Get STT service based on configuration."""
    if settings.stt_provider == "elevenlabs":
        return ElevenLabsSTTService()
    elif settings.stt_provider == "openai":
        return OpenAISTTService()
    elif settings.stt_provider == "whisper":
        return WhisperSTTService()
    else:
        logger.warning(f"Unknown STT provider: {settings.stt_provider}, falling back to whisper")
        return WhisperSTTService()

def get_tts_service():
    """Get TTS service based on configuration."""
    if settings.tts_provider == "elevenlabs":
        return ElevenLabsTTSService()
    elif settings.tts_provider == "openai":
        return OpenAITTSService()
    else:
        logger.warning(f"Unknown TTS provider: {settings.tts_provider}, falling back to elevenlabs")
        return ElevenLabsTTSService()

# Initialize services
stt_service = get_stt_service()
tts_service = get_tts_service()
whisper_stt_service = WhisperSTTService()  # Fallback STT service

# Log service configuration
logger.info(f"Simple Voice Chat configured with:")
logger.info(f"  STT Provider: {settings.stt_provider}")
logger.info(f"  TTS Provider: {settings.tts_provider}")
logger.info(f"  Translation Provider: {settings.translation_provider}")
logger.info(f"  Fallback STT: Whisper (enabled: {settings.stt_fallback_enabled})")

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
                    # Process audio with STT (try ElevenLabs first, fallback to Whisper)
                    try:
                        import base64
                        audio_bytes = base64.b64decode(message.audio_data)
                        original_text = ""
                        
                        # Try configured STT service first
                        try:
                            logger.info(f"Attempting {settings.stt_provider} STT with {len(audio_bytes)} bytes of audio data")
                            if settings.stt_provider == "elevenlabs":
                                stt_result = await stt_service.transcribe_audio(audio_bytes, message.source_lang)
                                original_text = stt_result.get("text", "")
                            elif settings.stt_provider == "openai":
                                stt_result = await stt_service.transcribe_audio(audio_bytes, message.source_lang)
                                original_text = stt_result.get("text", "")
                            elif settings.stt_provider == "whisper":
                                stt_result = await stt_service.transcribe_audio(audio_bytes, message.source_lang)
                                original_text = stt_result.get("text", "")
                            else:
                                raise Exception(f"Unknown STT provider: {settings.stt_provider}")
                            
                            if original_text:
                                logger.info(f"{settings.stt_provider} STT result: {original_text}")
                            else:
                                error_msg = stt_result.get("error", "Unknown STT error")
                                logger.warning(f"{settings.stt_provider} STT failed: {error_msg}, trying Whisper fallback")
                        except Exception as e:
                            logger.warning(f"{settings.stt_provider} STT failed with exception: {e}, trying Whisper fallback")
                        
                        # Fallback to Whisper if ElevenLabs failed
                        if not original_text:
                            try:
                                whisper_result = await whisper_stt_service.transcribe_audio(audio_bytes, message.source_lang)
                                original_text = whisper_result.get("text", "")
                                if original_text:
                                    logger.info(f"Whisper STT result: {original_text}")
                                else:
                                    logger.error("Whisper STT returned empty result")
                                    raise Exception("Whisper STT returned empty result")
                            except Exception as e:
                                logger.error(f"Whisper STT also failed: {e}")
                                raise e
                        
                        if not original_text:
                            await manager.send_message(websocket, {
                                "type": "error",
                                "message": "Speech recognition failed with both ElevenLabs and Whisper"
                            })
                            continue
                            
                    except Exception as e:
                        logger.error(f"All STT services failed: {e}")
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
                    logger.info(f"Attempting {settings.tts_provider} TTS for: {translated_text[:50]}...")
                    if settings.tts_provider == "elevenlabs":
                        audio_data = await tts_service.synthesize_elevenlabs(
                            text=translated_text,
                            lang=message.target_lang,
                            voice_hint=None,
                            sender_gender=None
                        )
                        if audio_data:
                            audio_url = f"audio_{message_id}.mp3"
                            logger.info(f"{settings.tts_provider} TTS successful")
                    elif settings.tts_provider == "openai":
                        audio_data, mime_type, is_error, voice_used = await tts_service.synthesize(
                            text=translated_text,
                            lang=message.target_lang,
                            voice_hint=settings.openai_tts_voice,
                            sender_gender=None,
                            sender_id=message.sender_id
                        )
                        if audio_data and not is_error:
                            audio_url = f"audio_{message_id}.mp3"
                            logger.info(f"{settings.tts_provider} TTS successful with voice: {voice_used}")
                        else:
                            logger.warning(f"{settings.tts_provider} TTS returned empty or error result")
                    else:
                        raise Exception(f"Unknown TTS provider: {settings.tts_provider}")
                except Exception as e:
                    logger.warning(f"{settings.tts_provider} TTS failed: {e}, continuing without audio")
                    # Continue without audio - the text translation will still work
                
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
