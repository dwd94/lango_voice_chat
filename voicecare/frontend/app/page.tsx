'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LandingPage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('voicecare_token')
    const user = localStorage.getItem('voicecare_user')
    
    if (token && user) {
      try {
        const userData = JSON.parse(user)
        if (userData.role === 'admin') {
          router.push('/admin')
        } else {
          router.push('/conversations')
        }
      } catch (error) {
        // Invalid user data, clear storage
        localStorage.removeItem('voicecare_token')
        localStorage.removeItem('voicecare_user')
      }
    }
  }, [router])

  const features = [
    {
      icon: '🎤',
      title: 'Advanced Speech Recognition',
      description: 'Whisper-powered STT supporting 80+ languages with medical terminology accuracy'
    },
    {
      icon: '🌍',
      title: 'Real-time Translation',
      description: 'Instant translation between languages using LibreTranslate for seamless communication'
    },
    {
      icon: '💬',
      title: 'Natural Voice Synthesis',
      description: 'ElevenLabs premium voices deliver natural-sounding speech in multiple languages'
    },
    {
      icon: '👥',
      title: 'Role-Based Access',
      description: 'Secure patient-nurse-admin roles with appropriate permissions and workflows'
    },
    {
      icon: '⚡',
      title: 'Lightning Fast',
      description: 'Optimized pipeline for minimal latency from speech to translated audio output'
    },
    {
      icon: '🛡️',
      title: 'Healthcare Compliant',
      description: 'Built with healthcare privacy and security requirements in mind'
    }
  ]

  const steps = [
    { number: '01', title: 'Speak', description: 'Record your voice message in your preferred language' },
    { number: '02', title: 'Process', description: 'AI transcribes and translates to recipient\'s language' },
    { number: '03', title: 'Deliver', description: 'Natural voice synthesis plays in recipient\'s language' },
    { number: '04', title: 'Confirm', description: 'Real-time delivery and playback confirmations' }
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Voice<span className="text-purple-300">Care</span>
            </h1>
            <p className="text-xl md:text-2xl text-purple-100 mb-8 max-w-4xl mx-auto">
              Break language barriers in healthcare with AI-powered voice translation. 
              Real-time communication between patients and nurses using premium voice synthesis.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                href="/auth/login"
                className="btn-primary px-8 py-4 rounded-2xl text-lg font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="btn-secondary px-8 py-4 rounded-2xl text-lg font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Get Started
              </Link>
            </div>

            {/* System Status */}
            <div className="glass-card rounded-2xl p-6 max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold text-white mb-4">System Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'Whisper STT', status: 'online' },
                  { name: 'ElevenLabs TTS', status: 'online' },
                  { name: 'Translation', status: 'online' },
                  { name: 'WebSocket', status: 'online' }
                ].map((service) => (
                  <div key={service.name} className="text-center">
                    <div className="w-3 h-3 bg-green-400 rounded-full mx-auto mb-2 animate-pulse"></div>
                    <div className="text-sm text-purple-100">{service.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Powered by Advanced AI
            </h2>
            <p className="text-xl text-purple-100 max-w-2xl mx-auto">
              Enterprise-grade voice processing with medical-specific optimizations
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="glass-card rounded-2xl p-8 text-center hover:neon-glow transition-all duration-300"
              >
                <div className="text-4xl mb-6">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-4">{feature.title}</h3>
                <p className="text-purple-100">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-purple-100 max-w-2xl mx-auto">
              Four simple steps to seamless multilingual healthcare communication
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white shadow-lg">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">{step.title}</h3>
                <p className="text-purple-100">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass-strong rounded-3xl p-12">
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Transform Healthcare Communication?
            </h2>
            <p className="text-xl text-purple-100 mb-8">
              Join healthcare professionals using VoiceCare to break language barriers
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/register"
                className="btn-primary px-8 py-4 rounded-2xl text-lg font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Start Free Trial
              </Link>
              <Link
                href="/settings/languages"
                className="btn-secondary px-8 py-4 rounded-2xl text-lg font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                View Capabilities
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
