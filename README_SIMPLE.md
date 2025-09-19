# Simple Voice Chat Translation

A simplified version of the voice chat application that focuses on core functionality: sending messages and translating them to the receiver's language.

## Features

- **Simple Chat Interface**: Clean, minimal chat interface
- **Real-time Translation**: Instant translation between multiple languages
- **WebSocket Communication**: Real-time bidirectional communication
- **Default Voice Synthesis**: Uses default ElevenLabs voice for TTS
- **No Authentication**: No user accounts or complex setup required

## Quick Start

### Backend

1. Start the simplified backend:
```bash
./start_simple_backend.sh
```

The backend will run on `http://localhost:8000`

### Frontend

1. Install dependencies:
```bash
cd voicecare/frontend
npm install
```

2. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

3. Navigate to `http://localhost:3000/simple-chat` to start chatting

## How to Use

1. **Select Languages**: Choose source and target languages from the dropdown menus
2. **Type Message**: Type your message in the text area
3. **Send**: Click the send button or press Enter
4. **View Translation**: The message will be translated and displayed
5. **Play Audio**: Click the speaker icon to play the translated audio (if available)

## Supported Languages

- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Russian (ru)
- Japanese (ja)
- Korean (ko)
- Chinese (zh)

## API Endpoints

- `GET /` - Root endpoint
- `GET /health` - Health check
- `WebSocket /ws` - Real-time communication

## WebSocket Message Format

### Send Message
```json
{
  "text": "Hello, how are you?",
  "source_lang": "en",
  "target_lang": "es",
  "sender_id": "user1"
}
```

### Receive Translation
```json
{
  "type": "translation",
  "data": {
    "translated_text": "Hola, ¿cómo estás?",
    "audio_url": "audio_123.mp3",
    "message_id": "123"
  }
}
```

## Configuration

The simplified version uses these default settings:
- **Translation**: LibreTranslate (free)
- **TTS**: ElevenLabs (requires API key)
- **STT**: Whisper (local processing)
- **Voice**: Default ElevenLabs voice

## Requirements

- Python 3.8+
- Node.js 16+
- ElevenLabs API key (for TTS)

## Troubleshooting

1. **WebSocket Connection Failed**: Make sure the backend is running on port 8000
2. **Translation Not Working**: Check your internet connection (LibreTranslate requires internet)
3. **TTS Not Working**: Verify your ElevenLabs API key is set in the config
4. **Frontend Not Loading**: Make sure you're running `npm run dev` in the frontend directory

## Differences from Full Version

This simplified version removes:
- User authentication and accounts
- Database persistence
- Complex user management
- Gender-specific voice selection
- Admin panels
- Conversation history
- User roles and permissions

It focuses only on the core translation functionality for immediate use.
