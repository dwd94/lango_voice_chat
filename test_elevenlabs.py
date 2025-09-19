#!/usr/bin/env python3
"""Test ElevenLabs API access"""

import asyncio
import httpx
import sys
import os

# Add the backend to path
sys.path.append('voicecare/backend')
from app.core.config import settings

async def test_elevenlabs_api():
    """Test ElevenLabs API access"""
    api_key = settings.elevenlabs_api_key
    print(f"API Key: {api_key}")
    print(f"API Key length: {len(api_key) if api_key else 0}")
    
    # Test voices endpoint first (simpler request)
    headers = {"xi-api-key": api_key}
    
    try:
        async with httpx.AsyncClient() as client:
            print("\nTesting ElevenLabs voices endpoint...")
            response = await client.get(
                "https://api.elevenlabs.io/v1/voices",
                headers=headers,
                timeout=10.0
            )
            print(f"Voices endpoint status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Number of voices: {len(data.get('voices', []))}")
            else:
                print(f"Error response: {response.text}")
                
    except Exception as e:
        print(f"Error testing voices endpoint: {e}")
    
    # Test STT endpoint
    try:
        async with httpx.AsyncClient() as client:
            print("\nTesting ElevenLabs STT endpoint...")
            # Create a minimal test audio (just a small dummy file)
            test_audio = b"dummy_audio_data"  # This will fail but we can see the error
            
            files = {
                'audio': ('test.wav', test_audio, 'audio/wav'),
            }
            data = {
                'model_id': 'scribe_v1',
                'language': 'en'
            }
            
            response = await client.post(
                "https://api.elevenlabs.io/v1/speech-to-text",
                headers={"xi-api-key": api_key},
                files=files,
                data=data,
                timeout=10.0
            )
            print(f"STT endpoint status: {response.status_code}")
            print(f"STT response: {response.text}")
                
    except Exception as e:
        print(f"Error testing STT endpoint: {e}")

if __name__ == "__main__":
    asyncio.run(test_elevenlabs_api())
