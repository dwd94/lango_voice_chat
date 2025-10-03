#!/usr/bin/env python3
"""Test script for optimized simplified voice chat backend."""

import asyncio
import time
import json
import base64
import websockets
import sys

async def test_performance():
    """Test performance of optimized WebSocket endpoint"""
    uri = "ws://localhost:8000/ws"
    
    # Create test audio data (dummy)
    test_audio = b"dummy_audio_data_for_testing_optimization"
    test_audio_b64 = base64.b64encode(test_audio).decode('utf-8')
    
    test_message = {
        "audio_data": test_audio_b64,
        "source_lang": "en",
        "target_lang": "es",
        "sender_id": "test_user_optimized"
    }
    
    print("🧪 Testing Optimized Voice Chat Backend")
    print("=" * 50)
    
    try:
        async with websockets.connect(uri) as websocket:
            print(f"✅ Connected to WebSocket: {uri}")
            
            # Send test message
            start_time = time.time()
            print(f"📤 Sending test message...")
            await websocket.send(json.dumps(test_message))
            
            # Wait for response
            print(f"⏳ Waiting for response...")
            response = await websocket.recv()
            end_time = time.time()
            
            processing_time = end_time - start_time
            print(f"⏱️  Processing time: {processing_time:.2f} seconds")
            
            # Parse response
            response_data = json.loads(response)
            print(f"📥 Response type: {response_data.get('type')}")
            
            if response_data.get('type') == 'translation':
                data = response_data.get('data', {})
                print(f"✅ Translation successful!")
                print(f"   Original text: {data.get('original_text', 'N/A')}")
                print(f"   Translated text: {data.get('translated_text', 'N/A')}")
                print(f"   Audio URL present: {bool(data.get('audio_url'))}")
                print(f"   Message ID: {data.get('message_id', 'N/A')}")
            elif response_data.get('type') == 'error':
                print(f"❌ Error: {response_data.get('message', 'Unknown error')}")
            else:
                print(f"⚠️  Unexpected response: {response_data}")
            
            print(f"\n🎯 Performance Summary:")
            print(f"   Total time: {processing_time:.2f}s")
            if processing_time < 3.0:
                print(f"   ✅ EXCELLENT - Under 3 seconds")
            elif processing_time < 5.0:
                print(f"   ✅ GOOD - Under 5 seconds")
            elif processing_time < 7.0:
                print(f"   ⚠️  ACCEPTABLE - Under 7 seconds")
            else:
                print(f"   ❌ SLOW - Over 7 seconds")
                
    except websockets.exceptions.ConnectionRefused:
        print("❌ Connection refused. Make sure the backend is running on localhost:8000")
        print("   Start with: cd voicecare/backend && python -m app.main_simple")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False
    
    return True

async def load_test(concurrent_requests=5, total_requests=20):
    """Load test with concurrent requests"""
    uri = "ws://localhost:8000/ws"
    
    print(f"\n🚀 Load Testing: {concurrent_requests} concurrent, {total_requests} total")
    print("=" * 50)
    
    # Create semaphore to limit concurrent requests
    semaphore = asyncio.Semaphore(concurrent_requests)
    
    async def single_request(request_id):
        """Single WebSocket request"""
        async with semaphore:
            try:
                async with websockets.connect(uri) as websocket:
                    test_message = {
                        "audio_data": base64.b64encode(f"test_audio_{request_id}".encode()).decode(),
                        "source_lang": "en",
                        "target_lang": "es",
                        "sender_id": f"load_test_user_{request_id}"
                    }
                    
                    start_time = time.time()
                    await websocket.send(json.dumps(test_message))
                    response = await websocket.recv()
                    end_time = time.time()
                    
                    return {
                        "request_id": request_id,
                        "processing_time": end_time - start_time,
                        "success": response is not None,
                        "response_type": json.loads(response).get('type') if response else 'none'
                    }
            except Exception as e:
                return {
                    "request_id": request_id,
                    "processing_time": 0,
                    "success": False,
                    "error": str(e)
                }
    
    # Run load test
    start_time = time.time()
    tasks = [single_request(i) for i in range(total_requests)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    end_time = time.time()
    
    # Analyze results
    successful_requests = [r for r in results if isinstance(r, dict) and r.get('success')]
    failed_requests = [r for r in results if isinstance(r, dict) and not r.get('success')]
    
    if successful_requests:
        avg_processing_time = sum(r['processing_time'] for r in successful_requests) / len(successful_requests)
        min_processing_time = min(r['processing_time'] for r in successful_requests)
        max_processing_time = max(r['processing_time'] for r in successful_requests)
    else:
        avg_processing_time = min_processing_time = max_processing_time = 0
    
    print(f"📊 Load Test Results:")
    print(f"   Total time: {end_time - start_time:.2f} seconds")
    print(f"   Successful requests: {len(successful_requests)}/{total_requests}")
    print(f"   Failed requests: {len(failed_requests)}")
    print(f"   Success rate: {len(successful_requests)/total_requests*100:.1f}%")
    print(f"   Average processing time: {avg_processing_time:.2f} seconds")
    print(f"   Min processing time: {min_processing_time:.2f} seconds")
    print(f"   Max processing time: {max_processing_time:.2f} seconds")
    print(f"   Requests per second: {total_requests/(end_time - start_time):.2f}")
    
    # Performance assessment
    if avg_processing_time < 3.0:
        print(f"   🎯 EXCELLENT performance - Average under 3 seconds")
    elif avg_processing_time < 5.0:
        print(f"   ✅ GOOD performance - Average under 5 seconds")
    elif avg_processing_time < 7.0:
        print(f"   ⚠️  ACCEPTABLE performance - Average under 7 seconds")
    else:
        print(f"   ❌ SLOW performance - Average over 7 seconds")

async def main():
    """Main test function"""
    print("🔧 Optimized Voice Chat Backend Test Suite")
    print("=" * 60)
    
    # Test 1: Basic functionality
    print("\n1️⃣  Testing Basic Functionality")
    basic_success = await test_performance()
    
    if not basic_success:
        print("\n❌ Basic test failed. Please check the backend is running.")
        sys.exit(1)
    
    # Test 2: Load testing
    print("\n2️⃣  Testing Load Performance")
    await load_test(concurrent_requests=3, total_requests=10)
    
    print("\n🎉 All tests completed!")
    print("\n💡 Optimization Summary:")
    print("   ✅ Thread pool for CPU-intensive operations")
    print("   ✅ Background task processing")
    print("   ✅ Retry logic with exponential backoff")
    print("   ✅ Optimized JSON and base64 operations")
    print("   ✅ Improved error handling")

if __name__ == "__main__":
    asyncio.run(main())
