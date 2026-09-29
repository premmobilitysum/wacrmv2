import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { encrypt } from '@/lib/whatsapp/encryption'
import { subscribeWabaToApp } from '@/lib/whatsapp/meta-api'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Resolve caller's account_id and role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('account_id, account_role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile?.account_id) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 }
      )
    }

    if (profile.account_role !== 'owner' && profile.account_role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: only account owners and admins can connect WhatsApp.' },
        { status: 403 }
      )
    }

    const accountId = profile.account_id

    // 3. Parse OAuth code from request body
    const body = await request.json().catch(() => ({}))
    const { code } = body

    if (!code) {
      return NextResponse.json({ error: 'Missing OAuth authorization code' }, { status: 400 })
    }

    const appId = process.env.NEXT_PUBLIC_META_APP_ID
    const appSecret = process.env.META_APP_SECRET

    if (!appId || !appSecret) {
      console.error('[oauth/exchange] Missing META_APP_ID or META_APP_SECRET in server environment')
      return NextResponse.json(
        { error: 'Server configuration error: Meta App credentials are not configured.' },
        { status: 500 }
      )
    }

    // 4. Exchange authorization code for User/System Access Token
    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`
    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json()

    if (tokenData.error || !tokenData.access_token) {
      console.error('[oauth/exchange] Meta token exchange error:', tokenData.error || tokenData)
      return NextResponse.json(
        { error: `Failed to exchange Meta access token: ${tokenData.error?.message || 'Unknown error'}` },
        { status: 400 }
      )
    }

    const accessToken: string = tokenData.access_token

    // 5. Inspect debug_token to extract WABA ID
    const debugUrl = `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${appId}|${appSecret}`
    const debugRes = await fetch(debugUrl)
    const debugData = await debugRes.json()

    if (debugData.error || !debugData.data) {
      console.error('[oauth/exchange] Meta debug token error:', debugData.error)
      return NextResponse.json({ error: 'Failed to validate Meta access token.' }, { status: 400 })
    }

    const scopes = debugData.data.granular_scopes || []
    const messagingScope = scopes.find((s: any) => s.scope === 'whatsapp_business_messaging')
    const managementScope = scopes.find((s: any) => s.scope === 'whatsapp_business_management')

    const wabaId: string | undefined =
      messagingScope?.target_ids?.[0] ||
      managementScope?.target_ids?.[0] ||
      debugData.data.shared_waba_id ||
      undefined

    if (!wabaId) {
      console.error('[oauth/exchange] Could not find WABA ID in debug_token scopes:', scopes)
      return NextResponse.json(
        {
          error:
            'No WhatsApp Business Account found in the OAuth scope. Please ensure you completed setup and granted WhatsApp permissions.',
        },
        { status: 400 }
      )
    }

    // 6. Fetch phone numbers registered under this WABA
    const phoneUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${encodeURIComponent(accessToken)}`
    const phoneRes = await fetch(phoneUrl)
    const phoneData = await phoneRes.json()

    if (phoneData.error || !phoneData.data || phoneData.data.length === 0) {
      console.error('[oauth/exchange] Meta phone numbers query error:', phoneData.error || phoneData)
      return NextResponse.json(
        { error: 'No phone numbers found in this WhatsApp Business Account. Please add a phone number in Meta first.' },
        { status: 400 }
      )
    }

    const phoneNumberId: string = phoneData.data[0].id
    const displayPhoneNumber: string = phoneData.data[0].display_phone_number || ''

    // 7. Multi-Tenant Guard: Check if phone_number_id is already claimed by another account
    const admin = getAdminClient()
    const { data: existingClaim } = await admin
      .from('whatsapp_config')
      .select('account_id')
      .eq('phone_number_id', phoneNumberId)
      .maybeSingle()

    if (existingClaim && existingClaim.account_id !== accountId) {
      return NextResponse.json(
        {
          error:
            'This WhatsApp phone number is already connected to another organization in this CRM.',
        },
        { status: 409 }
      )
    }

    // 8. Auto-subscribe WABA to Meta App webhooks
    try {
      await subscribeWabaToApp({ wabaId, accessToken })
    } catch (subErr) {
      console.warn('[oauth/exchange] subscribeWabaToApp warning:', subErr)
      // Continue anyway; user can re-trigger probe if needed
    }

    // 9. Encrypt tokens
    let encryptedAccessToken: string
    let encryptedVerifyToken: string
    try {
      encryptedAccessToken = encrypt(accessToken)
      const defaultVerifyToken = `verify_${accountId.substring(0, 8)}_${Math.random().toString(36).substring(7)}`
      encryptedVerifyToken = encrypt(defaultVerifyToken)
    } catch (encErr: any) {
      console.error('[oauth/exchange] Token encryption failed:', encErr.message)
      return NextResponse.json(
        { error: 'Server encryption configuration error. Check ENCRYPTION_KEY.' },
        { status: 500 }
      )
    }

    // 10. Persist configuration scoped to account_id
    const now = new Date().toISOString()
    const configRow = {
      account_id: accountId,
      user_id: user.id,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      access_token: encryptedAccessToken,
      verify_token: encryptedVerifyToken,
      status: 'connected',
      connected_at: now,
      registered_at: now,
      subscribed_apps_at: now,
      updated_at: now,
    }

    const { error: upsertError } = await admin
      .from('whatsapp_config')
      .upsert(configRow, { onConflict: 'account_id' })

    if (upsertError) {
      console.error('[oauth/exchange] Supabase upsert error:', upsertError)
      return NextResponse.json(
        { error: `Failed to save configuration: ${upsertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      display_phone_number: displayPhoneNumber,
    })
  } catch (error: any) {
    console.error('[oauth/exchange] Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 })
  }
}
