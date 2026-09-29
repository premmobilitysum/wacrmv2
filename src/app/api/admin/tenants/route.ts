import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const SUPER_ADMIN_EMAIL = 'dheeraj@mobilitysum.com'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/admin/tenants
 * Lists all tenant organizations, owners, WhatsApp configuration, and active status.
 * Strictly gated to SUPER_ADMIN_EMAIL.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user || user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden: Super Admin access required.' }, { status: 403 })
  }

  const adminSb = getAdminClient()

  // 1. Fetch all accounts
  const { data: accounts, error: accErr } = await adminSb
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false })

  if (accErr) {
    return NextResponse.json({ error: accErr.message }, { status: 500 })
  }

  // 2. Fetch all profiles
  const { data: profiles, error: profErr } = await adminSb
    .from('profiles')
    .select('*')

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }

  // 3. Fetch all WhatsApp configs
  const { data: waConfigs, error: waErr } = await adminSb
    .from('whatsapp_config')
    .select('id, account_id, phone_number_id, waba_id, status, registered_at, subscribed_apps_at')

  if (waErr) {
    return NextResponse.json({ error: waErr.message }, { status: 500 })
  }

  // 4. Fetch auth users to inspect ban/active status
  const { data: authUsers, error: usersErr } = await adminSb.auth.admin.listUsers()
  if (usersErr) {
    return NextResponse.json({ error: usersErr.message }, { status: 500 })
  }

  // Map tenants
  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]))
  const waMap = new Map((waConfigs || []).map((w) => [w.account_id, w]))
  const userMap = new Map((authUsers?.users || []).map((u) => [u.id, u]))

  const tenants = (accounts || []).map((acc) => {
    const ownerProfile = profileMap.get(acc.owner_user_id)
    const ownerUser = userMap.get(acc.owner_user_id)
    const wa = waMap.get(acc.id)

    // A user is considered deactivated if banned_until is in the future or user_metadata.is_deactivated is true
    const isBanned = ownerUser?.banned_until
      ? new Date(ownerUser.banned_until) > new Date()
      : false
    const isDeactivated = isBanned || Boolean(ownerUser?.user_metadata?.is_deactivated)

    return {
      accountId: acc.id,
      accountName: acc.name,
      ownerUserId: acc.owner_user_id,
      ownerName: ownerProfile?.full_name || ownerUser?.user_metadata?.full_name || 'Unknown',
      ownerEmail: ownerProfile?.email || ownerUser?.email || '',
      joinedAt: acc.created_at,
      isActive: !isDeactivated,
      whatsapp: {
        configured: Boolean(wa && wa.phone_number_id),
        phoneNumberId: wa?.phone_number_id || null,
        wabaId: wa?.waba_id || null,
        status: wa?.status || 'disconnected',
        isRegistered: Boolean(wa?.registered_at),
      },
    }
  })

  return NextResponse.json({
    tenants,
    total: tenants.length,
    activeCount: tenants.filter((t) => t.isActive).length,
    whatsappCount: tenants.filter((t) => t.whatsapp.configured).length,
  })
}

/**
 * POST /api/admin/tenants
 * Activates or deactivates a tenant account by updating the owner user's ban duration.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user || user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden: Super Admin access required.' }, { status: 403 })
  }

  const body = await request.json()
  const { userId, action } = body

  if (!userId || !['activate', 'deactivate'].includes(action)) {
    return NextResponse.json(
      { error: 'Invalid parameters: userId and valid action (activate/deactivate) required.' },
      { status: 400 }
    )
  }

  // Prevent Super Admin from deactivating their own account
  if (action === 'deactivate' && userId === user.id) {
    return NextResponse.json(
      { error: 'Cannot deactivate the primary Super Admin account.' },
      { status: 400 }
    )
  }

  const adminSb = getAdminClient()

  if (action === 'deactivate') {
    // Ban user for 100 years and set metadata
    const { error: banErr } = await adminSb.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
      user_metadata: { is_deactivated: true },
    })

    if (banErr) {
      return NextResponse.json({ error: banErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, isActive: false, message: 'Tenant deactivated successfully.' })
  } else {
    // Unban user and reset metadata
    const { error: unbanErr } = await adminSb.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
      user_metadata: { is_deactivated: false },
    })

    if (unbanErr) {
      return NextResponse.json({ error: unbanErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, isActive: true, message: 'Tenant activated successfully.' })
  }
}
