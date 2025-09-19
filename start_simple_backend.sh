#!/bin/bash

# Simple Voice Chat Backend Startup Script

echo "Starting Simple Voice Chat Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install simplified requirements
echo "Installing simplified requirements..."
pip install -r voicecare/backend/requirements_simple.txt

# Set environment variables
export PYTHONPATH="${PYTHONPATH}:$(pwd)/voicecare/backend"

# Start the simplified backend
echo "Starting simplified backend server..."
cd voicecare/backend
python -m app.main_simple
