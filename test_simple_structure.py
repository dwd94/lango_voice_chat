#!/usr/bin/env python3
"""
Test script to verify the simplified voice chat structure is correct.
"""

import os
import sys

def check_file_exists(filepath, description):
    """Check if a file exists and print status."""
    if os.path.exists(filepath):
        print(f"✅ {description}: {filepath}")
        return True
    else:
        print(f"❌ {description}: {filepath} - NOT FOUND")
        return False

def main():
    print("🔍 Checking Simplified Voice Chat Structure...")
    print("=" * 50)
    
    # Check backend files
    backend_files = [
        ("voicecare/backend/app/main_simple.py", "Simplified Backend Main"),
        ("voicecare/backend/requirements_simple.txt", "Simplified Requirements"),
        ("start_simple_backend.sh", "Backend Startup Script"),
    ]
    
    # Check frontend files
    frontend_files = [
        ("voicecare/frontend/app/simple-chat/page.tsx", "Simplified Chat Page"),
    ]
    
    # Check documentation
    doc_files = [
        ("README_SIMPLE.md", "Simplified README"),
    ]
    
    all_good = True
    
    print("\n📁 Backend Files:")
    for filepath, description in backend_files:
        if not check_file_exists(filepath, description):
            all_good = False
    
    print("\n📁 Frontend Files:")
    for filepath, description in frontend_files:
        if not check_file_exists(filepath, description):
            all_good = False
    
    print("\n📁 Documentation:")
    for filepath, description in doc_files:
        if not check_file_exists(filepath, description):
            all_good = False
    
    print("\n" + "=" * 50)
    if all_good:
        print("🎉 All files are in place! The simplified voice chat is ready.")
        print("\n📋 Next steps:")
        print("1. Run: ./start_simple_backend.sh")
        print("2. In another terminal: cd voicecare/frontend && npm run dev")
        print("3. Open: http://localhost:3000/simple-chat")
    else:
        print("❌ Some files are missing. Please check the errors above.")
    
    return all_good

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
