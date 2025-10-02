"""Simplified FastAPI application for voice chat translation."""

import uuid
import json
import base64
from typing import Dict, Set
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from .core.config import settings
from .core.logging import get_logger, setup_logging
from .services.translate_libre import translate_service
from .services.tts_elevenlabs import ElevenLabsTTSService
from .services.tts_openai import OpenAITTSService
from .services.stt_elevenlabs import ElevenLabsSTTService
from .services.stt_whisper import WhisperSTTService
from .services.stt_openai import OpenAISTTService

# Setup logging first
setup_logging()
logger = get_logger(__name__)

# Test logging
logger.info("🚀 Simple Voice Chat Backend starting up...")

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

# Dynamic service factories - these check config each time they're called
def get_stt_service():
    """Get STT service based on current configuration."""
    current_provider = settings.stt_provider
    logger.info(f"Getting STT service for provider: {current_provider}")
    
    if current_provider == "elevenlabs":
        return ElevenLabsSTTService()
    elif current_provider == "openai":
        return OpenAISTTService()
    elif current_provider == "whisper":
        return WhisperSTTService()
    else:
        logger.warning(f"Unknown STT provider: {current_provider}, falling back to whisper")
        return WhisperSTTService()

def get_tts_service():
    """Get TTS service based on current configuration."""
    current_provider = settings.tts_provider
    logger.info(f"Getting TTS service for provider: {current_provider}")
    
    if current_provider == "elevenlabs":
        return ElevenLabsTTSService()
    elif current_provider == "openai":
        return OpenAITTSService()
    else:
        logger.warning(f"Unknown TTS provider: {current_provider}, falling back to openai")
        return OpenAITTSService()

# Initialize fallback service (always available)
whisper_stt_service = WhisperSTTService()  # Fallback STT service

# Log service configuration
logger.info("=" * 60)
logger.info("SIMPLE VOICE CHAT CONFIGURATION")
logger.info("=" * 60)
logger.info(f"STT Provider: {settings.stt_provider}")
logger.info(f"TTS Provider: {settings.tts_provider}")
logger.info(f"Translation Provider: {settings.translation_provider}")
logger.info(f"STT Fallback Enabled: {settings.stt_fallback_enabled}")
logger.info(f"OpenAI API Key: {'SET' if settings.openai_api_key else 'NOT SET'}")
logger.info(f"ElevenLabs API Key: {'SET' if settings.elevenlabs_api_key else 'NOT SET'}")
logger.info("=" * 60)
logger.info("Services will be dynamically selected based on configuration")
logger.info("=" * 60)

# Create FastAPI app
app = FastAPI(
    title="Simple Voice Chat Translation",
    description="Simple voice chat with translation",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    """Log startup information."""
    logger.info("🎉 Simple Voice Chat Backend is now running!")
    logger.info(f"📡 Server running on http://127.0.0.1:8000")
    logger.info(f"🔧 Debug config available at http://127.0.0.1:8000/debug/config")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "message": "Voice Chat App is running"}

@app.get("/debug/config")
async def debug_config():
    """Debug endpoint to show current configuration and active services."""
    # Get current services dynamically
    current_stt_service = get_stt_service()
    current_tts_service = get_tts_service()
    
    return {
        "stt_provider": settings.stt_provider,
        "tts_provider": settings.tts_provider,
        "translation_provider": settings.translation_provider,
        "stt_fallback_enabled": settings.stt_fallback_enabled,
        "openai_api_key_set": bool(settings.openai_api_key),
        "elevenlabs_api_key_set": bool(settings.elevenlabs_api_key),
        "current_stt_service": type(current_stt_service).__name__,
        "current_tts_service": type(current_tts_service).__name__,
        "openai_tts_voice": settings.openai_tts_voice,
        "openai_stt_model": settings.openai_stt_model,
        "elevenlabs_stt_model": settings.elevenlabs_stt_model,
        "note": "Services are dynamically selected based on current configuration"
    }

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
                        audio_bytes = base64.b64decode(message.audio_data)
                        original_text = ""
                        
                        # Try configured STT service first
                        try:
                            # Get the current STT service dynamically
                            current_stt_service = get_stt_service()
                            
                            logger.info("=" * 40)
                            logger.info(f"STT PROCESSING - Primary Service: {settings.stt_provider}")
                            logger.info(f"Audio size: {len(audio_bytes)} bytes")
                            logger.info(f"Language hint: {message.source_lang}")
                            logger.info(f"STT Service type: {type(current_stt_service).__name__}")
                            logger.info("=" * 40)
                            
                            logger.info(f"Calling {settings.stt_provider} STT service...")
                            stt_result = await current_stt_service.transcribe_audio(audio_bytes, message.source_lang)
                            original_text = stt_result.get("text", "")
                            
                            logger.info(f"STT Result: {stt_result}")
                            
                            if original_text:
                                logger.info(f"✅ {settings.stt_provider} STT SUCCESS: '{original_text[:100]}...'")
                            else:
                                error_msg = stt_result.get("error", "Unknown STT error")
                                logger.warning(f"❌ {settings.stt_provider} STT FAILED: {error_msg}")
                                logger.warning(f"Will try Whisper fallback (enabled: {settings.stt_fallback_enabled})")
                        except Exception as e:
                            logger.error(f"❌ {settings.stt_provider} STT EXCEPTION: {e}")
                            logger.warning(f"Will try Whisper fallback (enabled: {settings.stt_fallback_enabled})")
                        
                        # Fallback to Whisper if primary STT failed (only if fallback is enabled)
                        if not original_text and settings.stt_fallback_enabled:
                            logger.info("=" * 40)
                            logger.info("STT FALLBACK - Trying Whisper")
                            logger.info("=" * 40)
                            try:
                                logger.info("Calling Whisper STT fallback service...")
                                whisper_result = await whisper_stt_service.transcribe_audio(audio_bytes, message.source_lang)
                                logger.info(f"Whisper fallback result: {whisper_result}")
                                original_text = whisper_result.get("text", "")
                                if original_text:
                                    logger.info(f"✅ Whisper STT FALLBACK SUCCESS: '{original_text[:100]}...'")
                                else:
                                    logger.error("❌ Whisper STT fallback returned empty result")
                                    raise Exception("Whisper STT fallback returned empty result")
                            except Exception as e:
                                logger.error(f"❌ Whisper STT fallback also failed: {e}")
                                raise e
                        elif not original_text and not settings.stt_fallback_enabled:
                            logger.warning("❌ Primary STT failed and fallback is DISABLED")
                        
                        if not original_text:
                            await manager.send_message(websocket, {
                                "type": "error",
                                "message": f"Speech recognition failed with {settings.stt_provider} and Whisper fallback"
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
                audio_data_base64 = None
                try:
                    # Get the current TTS service dynamically
                    current_tts_service = get_tts_service()
                    
                    logger.info("=" * 40)
                    logger.info(f"TTS PROCESSING - Service: {settings.tts_provider}")
                    logger.info(f"Text to synthesize: '{translated_text[:50]}...'")
                    logger.info(f"Target language: {message.target_lang}")
                    logger.info(f"TTS Service type: {type(current_tts_service).__name__}")
                    logger.info("=" * 40)
                    
                    if settings.tts_provider == "elevenlabs":
                        logger.info("Calling ElevenLabs TTS service...")
                        # Use asyncio.gather for parallel processing if needed
                        audio_data, content_type, needs_fallback, voice_used = await current_tts_service.synthesize_elevenlabs(
                            text=translated_text,
                            lang=message.target_lang,
                            voice_hint=None,
                            sender_gender=None,
                            sender_id=message.sender_id
                        )
                        logger.info(f"ElevenLabs TTS result: audio_data={len(audio_data) if audio_data else 'None'}, content_type={content_type}, needs_fallback={needs_fallback}, voice_used={voice_used}")
                        if audio_data and not needs_fallback:
                            # Optimize base64 encoding
                            audio_data_base64 = base64.b64encode(audio_data).decode('utf-8')
                            audio_url = f"data:{content_type};base64,{audio_data_base64}"
                            logger.info(f"✅ ElevenLabs TTS SUCCESS with voice: {voice_used}")
                        else:
                            logger.warning(f"❌ ElevenLabs TTS FAILED: needs_fallback={needs_fallback}")
                    elif settings.tts_provider == "openai":
                        logger.info(f"Calling OpenAI TTS with voice: {settings.openai_tts_voice}")
                        audio_data, mime_type, is_error, voice_used = await current_tts_service.synthesize(
                            text=translated_text,
                            lang=message.target_lang,
                            voice_hint=settings.openai_tts_voice,
                            sender_gender=None,
                            sender_id=message.sender_id
                        )
                        logger.info(f"OpenAI TTS result: audio_data={len(audio_data) if audio_data else 'None'}, mime_type={mime_type}, is_error={is_error}, voice_used={voice_used}")
                        if audio_data and not is_error:
                            audio_data_base64 = base64.b64encode(audio_data).decode('utf-8')
                            audio_url = f"data:{mime_type};base64,{audio_data_base64}"
                            logger.info(f"✅ OpenAI TTS SUCCESS with voice: {voice_used}")
                        else:
                            logger.warning(f"❌ OpenAI TTS FAILED: is_error={is_error}")
                    else:
                        raise Exception(f"Unknown TTS provider: {settings.tts_provider}")
                except Exception as e:
                    logger.error(f"{settings.tts_provider} TTS failed: {e}, continuing without audio")
                    logger.error(f"TTS Exception details: {type(e).__name__}: {str(e)}")
                    import traceback
                    logger.error(f"TTS Traceback: {traceback.format_exc()}")
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
    logger.info("Starting uvicorn server...")
    uvicorn.run(
        "app.main_simple:app", 
        host="127.0.0.1", 
        port=8000, 
        reload=True,
        log_level="info",
        access_log=True
    )
