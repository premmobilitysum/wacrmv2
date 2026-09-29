'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ShieldCheck, Zap, ArrowRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface WhatsAppEmbeddedSignupProps {
  onSuccess: () => void
  isConnected?: boolean
}

declare global {
  interface Window {
    fbAsyncInit: () => void
    FB: any
  }
}

export function WhatsAppEmbeddedSignup({ onSuccess, isConnected = false }: WhatsAppEmbeddedSignupProps) {
  const [isSdkLoaded, setIsSdkLoaded] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const appId = process.env.NEXT_PUBLIC_META_APP_ID || '791801833863999'
  const configId = process.env.NEXT_PUBLIC_META_LOGIN_CONFIG_ID || '1011347958131758'

  useEffect(() => {
    if (typeof window !== 'undefined' && window.FB) {
      setIsSdkLoaded(true)
    } else if (typeof window !== 'undefined') {
      window.fbAsyncInit = function () {
        window.FB.init({
          appId: appId,
          cookie: true,
          xfbml: true,
          version: 'v21.0',
        })
        setIsSdkLoaded(true)
      }
    }
  }, [appId])

  const launchWhatsAppSignup = () => {
    if (!configId) {
      toast.error('Missing Configuration: NEXT_PUBLIC_META_LOGIN_CONFIG_ID is not configured in environment.')
      return
    }

    if (!window.FB) {
      toast.error('Facebook SDK is still loading. Please wait 2 seconds and try again.')
      return
    }

    if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
      toast.error('Meta Embedded Signup requires an HTTPS connection. Please switch to the "Manual Credentials" tab above to configure your WhatsApp number on localhost.', { duration: 7000 })
      setIsConnecting(false)
      return
    }

    // Launch Meta Embedded Signup popup
    try {
      window.FB.login(
        async function (response: any) {
          if (response?.authResponse?.code) {
            const code = response.authResponse.code
            toast.loading('Authenticating with Meta & configuring WhatsApp...', { id: 'meta-connect' })
          
          try {
            const res = await fetch('/api/whatsapp/oauth/exchange', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code }),
            })

            const data = await res.json()

            if (!res.ok) {
              toast.dismiss('meta-connect')
              toast.error(data.error || 'Failed to exchange Meta authorization code.')
              setIsConnecting(false)
              return
            }

            toast.dismiss('meta-connect')
            toast.success('WhatsApp Business Account connected successfully!')
            setIsConnecting(false)
            onSuccess()
          } catch (err: any) {
            toast.dismiss('meta-connect')
            toast.error(err.message || 'Network error during connection.')
            setIsConnecting(false)
          }
        } else {
          setIsConnecting(false)
          if (response?.status === 'unknown') {
            toast.info('WhatsApp connection popup was closed.')
          } else {
            console.error('FB Login error response:', response)
            toast.error('WhatsApp connection was cancelled or failed.')
          }
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      }
    )
    } catch (e: any) {
      console.error('FB.login call failed:', e)
      toast.error('Meta Facebook Login failed: ' + (e?.message || 'HTTPS is required by Meta.'))
      setIsConnecting(false)
    }
  }

  return (
    <>
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="lazyOnload"
        crossOrigin="anonymous"
        onLoad={() => {
          if (typeof window !== 'undefined' && window.FB) {
            window.FB.init({
              appId: appId,
              cookie: true,
              xfbml: true,
              version: 'v21.0',
            })
            setIsSdkLoaded(true)
          }
        }}
      />

      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 ring-8 ring-blue-500/5">
            <Zap className="size-7" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            {isConnected ? 'Reconnect WhatsApp Business' : '1-Click Connect with Facebook'}
          </CardTitle>
          <CardDescription className="max-w-md mx-auto text-sm text-muted-foreground">
            Securely link your official WhatsApp Business number in 60 seconds using Meta Embedded Signup. No API tokens to copy or paste.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center pt-4 pb-8">
          {typeof window !== 'undefined' && window.location.protocol === 'http:' && (
            <div className="mb-4 max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs text-amber-700 dark:text-amber-300">
              <p className="font-semibold mb-1">⚠️ Local HTTP Environment Detected</p>
              <p>Meta requires <strong>HTTPS</strong> for Facebook Login. On localhost, please switch to the <strong>&ldquo;Manual Credentials&rdquo;</strong> tab above, or run via HTTPS/ngrok.</p>
            </div>
          )}

          <Button
            onClick={launchWhatsAppSignup}
            disabled={!isSdkLoaded || isConnecting}
            size="lg"
            className="h-12 px-8 text-base font-semibold bg-[#1877F2] hover:bg-[#166fe5] text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" />
                Connecting to Meta...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="mr-2.5 size-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.9981 11.9991C23.9981 5.37216 18.626 0 11.9991 0C5.37216 0 0 5.37216 0 11.9991C0 17.9882 4.38789 22.9522 10.1242 23.8524V15.4676H7.07758V11.9991H10.1242V9.35553C10.1242 6.34826 11.9156 4.68714 14.6564 4.68714C15.9692 4.68714 17.3424 4.92149 17.3424 4.92149V7.87439H15.8294C14.3388 7.87439 13.8739 8.79933 13.8739 9.74824V11.9991H17.2018L16.6698 15.4676H13.8739V23.8524C19.6103 22.9522 23.9981 17.9882 23.9981 11.9991Z" />
                </svg>
                {isConnected ? 'Reconnect with Facebook' : 'Connect with Facebook'}
              </>
            )}
          </Button>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="size-4 text-emerald-500" /> Official Meta Cloud API
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="size-4 text-blue-500" /> Auto-configures Webhooks
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <ArrowRight className="size-4 text-muted-foreground" /> Connects in 1 Click
            </span>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
