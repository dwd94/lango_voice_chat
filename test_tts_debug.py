#!/usr/bin/env python3
"""Test script to debug TTS functionality."""

import asyncio
import sys
import os

# Add the backend to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'voicecare', 'backend'))

from app.main_simple import get_tts_service, settings
from app.core.logging import get_logger, setup_logging

async def test_tts_service():
    """Test TTS service directly"""
    setup_logging()
    logger = get_logger(__name__)
    
    print("🔧 TTS Service Debug Test")
    print("=" * 50)
    
    # Check configuration
    print(f"TTS Provider: {settings.tts_provider}")
    print(f"OpenAI API Key Set: {bool(settings.openai_api_key)}")
    print(f"ElevenLabs API Key Set: {bool(settings.elevenlabs_api_key)}")
    print(f"OpenAI TTS Model: {settings.openai_tts_model}")
    print(f"OpenAI TTS Voice: {settings.openai_tts_voice}")
    
    # Get TTS service
    tts_service = get_tts_service()
    print(f"TTS Service Type: {type(tts_service).__name__}")
    
    # Test TTS service
    test_text = "Hello, this is a test of the TTS system."
    test_lang = "en"
    
    print(f"\nTesting TTS with text: '{test_text}'")
    print(f"Language: {test_lang}")
    
    try:
        if hasattr(tts_service, 'synthesize'):
            # OpenAI TTS
            result = await tts_service.synthesize(
                text=test_text,
                lang=test_lang,
                voice_hint=None,
                sender_gender=None,
                sender_id="test_user"
            )
            audio_data, content_type, needs_fallback, voice_used = result
            print(f"✅ TTS Success!")
            print(f"   Audio data length: {len(audio_data) if audio_data else 'None'}")
            print(f"   Content type: {content_type}")
            print(f"   Needs fallback: {needs_fallback}")
            print(f"   Voice used: {voice_used}")
            
            if audio_data and not needs_fallback:
                print(f"   ✅ Audio generated successfully!")
            else:
                print(f"   ❌ No audio generated or needs fallback")
                
        elif hasattr(tts_service, 'synthesize_elevenlabs'):
            # ElevenLabs TTS
            result = await tts_service.synthesize_elevenlabs(
                text=test_text,
                lang=test_lang,
                voice_hint=None,
                sender_gender=None,
                sender_id="test_user"
            )
            audio_data, content_type, needs_fallback, voice_used = result
            print(f"✅ TTS Success!")
            print(f"   Audio data length: {len(audio_data) if audio_data else 'None'}")
            print(f"   Content type: {content_type}")
            print(f"   Needs fallback: {needs_fallback}")
            print(f"   Voice used: {voice_used}")
            
            if audio_data and not needs_fallback:
                print(f"   ✅ Audio generated successfully!")
            else:
                print(f"   ❌ No audio generated or needs fallback")
        else:
            print(f"❌ Unknown TTS service method")
            
    except Exception as e:
        print(f"❌ TTS Error: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")

async def test_safe_tts_processing():
    """Test the safe TTS processing function"""
    from app.main_simple import safe_tts_processing
    
    print(f"\n🧪 Testing safe_tts_processing function")
    print("=" * 50)
    
    test_text = "Hello, this is a test of the safe TTS processing."
    test_lang = "en"
    
    try:
        result = await safe_tts_processing(
            text=test_text,
            lang=test_lang,
            voice_hint=None,
            sender_gender=None,
            sender_id="test_user"
        )
        audio_data, content_type, needs_fallback, voice_used = result
        print(f"✅ Safe TTS Success!")
        print(f"   Audio data length: {len(audio_data) if audio_data else 'None'}")
        print(f"   Content type: {content_type}")
        print(f"   Needs fallback: {needs_fallback}")
        print(f"   Voice used: {voice_used}")
        
        if audio_data and not needs_fallback:
            print(f"   ✅ Audio generated successfully!")
        else:
            print(f"   ❌ No audio generated or needs fallback")
            
    except Exception as e:
        print(f"❌ Safe TTS Error: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")

async def main():
    """Main test function"""
    print("🔧 TTS Debug Test Suite")
    print("=" * 60)
    
    # Test 1: Direct TTS service
    await test_tts_service()
    
    # Test 2: Safe TTS processing
    await test_safe_tts_processing()
    
    print("\n🎉 TTS debug tests completed!")

if __name__ == "__main__":
    asyncio.run(main())
