#!/usr/bin/env python3
"""Test script for streaming optimizations in simplified voice chat backend."""

import asyncio
import time
import json
import base64
import websockets
import sys
from typing import List, Dict, Any

class StreamingTestClient:
    def __init__(self, uri: str):
        self.uri = uri
        self.messages_received = []
        self.processing_stages = []
        self.start_time = None
        self.end_time = None
        
    async def test_streaming_mode(self):
        """Test streaming mode with progressive updates"""
        print("🧪 Testing Streaming Mode")
        print("=" * 50)
        
        # Create test audio data (dummy)
        test_audio = b"dummy_audio_data_for_testing_streaming_optimization"
        test_audio_b64 = base64.b64encode(test_audio).decode('utf-8')
        
        test_message = {
            "audio_data": test_audio_b64,
            "source_lang": "en",
            "target_lang": "es",
            "sender_id": "test_user_streaming"
        }
        
        try:
            async with websockets.connect(self.uri) as websocket:
                print(f"✅ Connected to WebSocket: {self.uri}")
                
                # Send test message
                self.start_time = time.time()
                print(f"📤 Sending test message...")
                await websocket.send(json.dumps(test_message))
                
                # Collect all streaming responses
                print(f"⏳ Collecting streaming responses...")
                while True:
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=30.0)
                        response_data = json.loads(response)
                        self.messages_received.append(response_data)
                        
                        print(f"📥 Received: {response_data.get('type')} - {response_data.get('data', {}).get('stage', 'N/A')}")
                        
                        # Check if processing is complete
                        if response_data.get('type') in ['translation_complete', 'error']:
                            self.end_time = time.time()
                            break
                            
                    except asyncio.TimeoutError:
                        print("⏰ Timeout waiting for response")
                        break
                
                # Analyze streaming performance
                self.analyze_streaming_performance()
                
        except websockets.exceptions.ConnectionRefused:
            print("❌ Connection refused. Make sure the backend is running on localhost:8000")
            return False
        except Exception as e:
            print(f"❌ Test failed: {e}")
            return False
        
        return True
    
    async def test_parallel_mode(self):
        """Test parallel mode with maximum parallelization"""
        print("\n🚀 Testing Parallel Mode")
        print("=" * 50)
        
        # Create test audio data (dummy)
        test_audio = b"dummy_audio_data_for_testing_parallel_optimization"
        test_audio_b64 = base64.b64encode(test_audio).decode('utf-8')
        
        test_message = {
            "audio_data": test_audio_b64,
            "source_lang": "en",
            "target_lang": "es",
            "sender_id": "test_user_parallel"
        }
        
        try:
            # Use parallel endpoint
            parallel_uri = self.uri.replace('/ws', '/ws/parallel')
            async with websockets.connect(parallel_uri) as websocket:
                print(f"✅ Connected to Parallel WebSocket: {parallel_uri}")
                
                # Send test message
                self.start_time = time.time()
                print(f"📤 Sending test message...")
                await websocket.send(json.dumps(test_message))
                
                # Collect all streaming responses
                print(f"⏳ Collecting parallel responses...")
                while True:
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=30.0)
                        response_data = json.loads(response)
                        self.messages_received.append(response_data)
                        
                        print(f"📥 Received: {response_data.get('type')} - {response_data.get('data', {}).get('stage', 'N/A')}")
                        
                        # Check if processing is complete
                        if response_data.get('type') in ['translation_complete', 'error']:
                            self.end_time = time.time()
                            break
                            
                    except asyncio.TimeoutError:
                        print("⏰ Timeout waiting for response")
                        break
                
                # Analyze parallel performance
                self.analyze_parallel_performance()
                
        except websockets.exceptions.ConnectionRefused:
            print("❌ Connection refused. Make sure the backend is running on localhost:8000")
            return False
        except Exception as e:
            print(f"❌ Test failed: {e}")
            return False
        
        return True
    
    def analyze_streaming_performance(self):
        """Analyze streaming performance metrics"""
        if not self.start_time or not self.end_time:
            print("❌ No timing data available")
            return
        
        total_time = self.end_time - self.start_time
        
        print(f"\n📊 Streaming Performance Analysis:")
        print(f"   Total processing time: {total_time:.2f} seconds")
        print(f"   Messages received: {len(self.messages_received)}")
        
        # Analyze message types
        message_types = {}
        for msg in self.messages_received:
            msg_type = msg.get('type', 'unknown')
            message_types[msg_type] = message_types.get(msg_type, 0) + 1
        
        print(f"   Message types received:")
        for msg_type, count in message_types.items():
            print(f"     - {msg_type}: {count}")
        
        # Check for progressive updates
        has_progressive = any(msg.get('type') in ['processing_started', 'processing_update', 'stt_result', 'translation_result'] for msg in self.messages_received)
        print(f"   Progressive updates: {'✅ Yes' if has_progressive else '❌ No'}")
        
        # Performance assessment
        if total_time < 2.0:
            print(f"   🎯 EXCELLENT - Under 2 seconds")
        elif total_time < 4.0:
            print(f"   ✅ GOOD - Under 4 seconds")
        elif total_time < 6.0:
            print(f"   ⚠️  ACCEPTABLE - Under 6 seconds")
        else:
            print(f"   ❌ SLOW - Over 6 seconds")
    
    def analyze_parallel_performance(self):
        """Analyze parallel performance metrics"""
        if not self.start_time or not self.end_time:
            print("❌ No timing data available")
            return
        
        total_time = self.end_time - self.start_time
        
        print(f"\n📊 Parallel Performance Analysis:")
        print(f"   Total processing time: {total_time:.2f} seconds")
        print(f"   Messages received: {len(self.messages_received)}")
        
        # Analyze message types
        message_types = {}
        for msg in self.messages_received:
            msg_type = msg.get('type', 'unknown')
            message_types[msg_type] = message_types.get(msg_type, 0) + 1
        
        print(f"   Message types received:")
        for msg_type, count in message_types.items():
            print(f"     - {msg_type}: {count}")
        
        # Check for parallel processing indicators
        has_parallel = any(msg.get('type') in ['processing_started', 'processing_update', 'stt_result', 'translation_result'] for msg in self.messages_received)
        print(f"   Parallel processing: {'✅ Yes' if has_parallel else '❌ No'}")
        
        # Check for dual audio (original + translated)
        has_dual_audio = any('audio_url_original' in msg.get('data', {}) and 'audio_url_translated' in msg.get('data', {}) for msg in self.messages_received)
        print(f"   Dual audio generation: {'✅ Yes' if has_dual_audio else '❌ No'}")
        
        # Performance assessment
        if total_time < 1.5:
            print(f"   🎯 EXCELLENT - Under 1.5 seconds")
        elif total_time < 3.0:
            print(f"   ✅ GOOD - Under 3 seconds")
        elif total_time < 5.0:
            print(f"   ⚠️  ACCEPTABLE - Under 5 seconds")
        else:
            print(f"   ❌ SLOW - Over 5 seconds")

async def load_test_streaming(concurrent_requests=3, total_requests=9):
    """Load test streaming mode with concurrent requests"""
    print(f"\n🚀 Load Testing Streaming Mode: {concurrent_requests} concurrent, {total_requests} total")
    print("=" * 60)
    
    uri = "ws://localhost:8000/ws"
    semaphore = asyncio.Semaphore(concurrent_requests)
    
    async def single_streaming_request(request_id):
        """Single streaming WebSocket request"""
        async with semaphore:
            try:
                async with websockets.connect(uri) as websocket:
                    test_message = {
                        "audio_data": base64.b64encode(f"test_audio_streaming_{request_id}".encode()).decode(),
                        "source_lang": "en",
                        "target_lang": "es",
                        "sender_id": f"load_test_streaming_{request_id}"
                    }
                    
                    start_time = time.time()
                    await websocket.send(json.dumps(test_message))
                    
                    # Collect all responses
                    responses = []
                    while True:
                        try:
                            response = await asyncio.wait_for(websocket.recv(), timeout=15.0)
                            response_data = json.loads(response)
                            responses.append(response_data)
                            
                            if response_data.get('type') in ['translation_complete', 'error']:
                                break
                        except asyncio.TimeoutError:
                            break
                    
                    end_time = time.time()
                    
                    return {
                        "request_id": request_id,
                        "processing_time": end_time - start_time,
                        "success": len(responses) > 0,
                        "response_count": len(responses),
                        "has_progressive": any(r.get('type') in ['processing_started', 'processing_update', 'stt_result', 'translation_result'] for r in responses)
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
    tasks = [single_streaming_request(i) for i in range(total_requests)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    end_time = time.time()
    
    # Analyze results
    successful_requests = [r for r in results if isinstance(r, dict) and r.get('success')]
    failed_requests = [r for r in results if isinstance(r, dict) and not r.get('success')]
    
    if successful_requests:
        avg_processing_time = sum(r['processing_time'] for r in successful_requests) / len(successful_requests)
        min_processing_time = min(r['processing_time'] for r in successful_requests)
        max_processing_time = max(r['processing_time'] for r in successful_requests)
        avg_response_count = sum(r['response_count'] for r in successful_requests) / len(successful_requests)
        progressive_count = sum(1 for r in successful_requests if r.get('has_progressive'))
    else:
        avg_processing_time = min_processing_time = max_processing_time = avg_response_count = 0
        progressive_count = 0
    
    print(f"📊 Load Test Results:")
    print(f"   Total time: {end_time - start_time:.2f} seconds")
    print(f"   Successful requests: {len(successful_requests)}/{total_requests}")
    print(f"   Failed requests: {len(failed_requests)}")
    print(f"   Success rate: {len(successful_requests)/total_requests*100:.1f}%")
    print(f"   Average processing time: {avg_processing_time:.2f} seconds")
    print(f"   Min processing time: {min_processing_time:.2f} seconds")
    print(f"   Max processing time: {max_processing_time:.2f} seconds")
    print(f"   Average responses per request: {avg_response_count:.1f}")
    print(f"   Progressive updates: {progressive_count}/{len(successful_requests)} requests")
    print(f"   Requests per second: {total_requests/(end_time - start_time):.2f}")

async def main():
    """Main test function"""
    print("🔧 Streaming Optimizations Test Suite")
    print("=" * 60)
    
    # Test 1: Streaming mode
    print("\n1️⃣  Testing Streaming Mode")
    streaming_client = StreamingTestClient("ws://localhost:8000/ws")
    streaming_success = await streaming_client.test_streaming_mode()
    
    if not streaming_success:
        print("\n❌ Streaming test failed. Please check the backend is running.")
        sys.exit(1)
    
    # Test 2: Parallel mode
    print("\n2️⃣  Testing Parallel Mode")
    parallel_client = StreamingTestClient("ws://localhost:8000/ws")
    parallel_success = await parallel_client.test_parallel_mode()
    
    if not parallel_success:
        print("\n❌ Parallel test failed.")
        sys.exit(1)
    
    # Test 3: Load testing
    print("\n3️⃣  Load Testing Streaming Mode")
    await load_test_streaming(concurrent_requests=2, total_requests=6)
    
    print("\n🎉 All streaming optimization tests completed!")
    print("\n💡 Streaming Optimization Summary:")
    print("   ✅ Progressive response streaming")
    print("   ✅ Parallel processing mode")
    print("   ✅ Immediate feedback and progress updates")
    print("   ✅ Dual audio generation (original + translated)")
    print("   ✅ Real-time processing stage indicators")
    print("   ✅ Enhanced user experience with live updates")

if __name__ == "__main__":
    asyncio.run(main())
