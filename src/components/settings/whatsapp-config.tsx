'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
  BadgeCheck,
  Edit,
  Phone,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { SettingsPanelHead } from './settings-panel-head';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';
import { WhatsAppEmbeddedSignup } from './whatsapp-embedded-signup';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';
type ResetReason = 'token_corrupted' | 'meta_api_error' | null;

// Meta ids are decimal digit strings — mirrors the server-side check in
// POST /api/whatsapp/config so the obvious paste mistakes get a named
// field before a round-trip.
const META_ID_RE = /^\d+$/;

// `meta` object the config route attaches to every failed Meta call
// (issue #505): what a user quotes to Meta support.
type MetaErrorMeta = {
  code: number | null;
  subcode: number | null;
  fbtrace_id: string | null;
  step: string;
  field?: string | null;
  message?: string | null;
};
type MetaFailure = { message: string; meta: MetaErrorMeta | null };
type WabaSubscription = {
  checked: boolean;
  subscribed: boolean | null;
  app_id_match: boolean | null;
  error?: string;
};

export function WhatsAppConfig() {
  const t = useTranslations('Settings.whatsapp');
  const supabase = createClient();
  // After multi-user, whatsapp_config is one-row-per-account, not
  // one-row-per-user. We pull `accountId` straight off the auth
  // context and key every read off it — so a teammate who just
  // joined an account sees the inviter's saved config without
  // having to re-enter anything.
  const {
    user,
    accountId,
    loading: authLoading,
    profileLoading,
    canEditSettings,
  } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  // Structured details of the last failed Meta call (health check or
  // save) — rendered as small muted text under the actionable message.
  const [statusMeta, setStatusMeta] = useState<MetaErrorMeta | null>(null);
  const [saveFailure, setSaveFailure] = useState<MetaFailure | null>(null);
  const [wabaSubscription, setWabaSubscription] = useState<WabaSubscription | null>(null);
  // Guards against re-hydrating the form when the load effect below
  // re-runs for reasons unrelated to actually switching accounts —
  // e.g. Supabase's onAuthStateChange fires a token refresh (new
  // `user` object, profileLoading flips true/false) when the browser
  // tab regains focus. Without this, that churn calls fetchConfig()
  // again and overwrites whatever the user typed but hadn't saved yet.
  const loadedAccountIdRef = useRef<string | null>(null);

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [pin, setPin] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);
  const [connectMode, setConnectMode] = useState<'embedded' | 'manual'>('embedded');
  const [isEditing, setIsEditing] = useState(false);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [phoneInfo, setPhoneInfo] = useState<{
    verified_name?: string;
    display_phone_number?: string;
    quality_rating?: string;
  } | null>(null);

  // Inbound-media mirror (issue #466). Unlike everything else on this
  // page it is NOT part of handleSave: that path insists on re-entering
  // the access token so it can re-verify with Meta, which is a silly
  // toll to pay for flipping a boolean. The switch writes straight to
  // the row instead — RLS (migration 017) restricts whatsapp_config
  // UPDATE to admins, hence the canEditSettings gate below; without it
  // a viewer's toggle would match zero rows and appear to work.
  const [mirrorMedia, setMirrorMedia] = useState(true);
  const [savingMirror, setSavingMirror] = useState(false);

  // True once /register has succeeded on Meta's side (timestamp set
  // in the row). When false, the saved config is metadata-only and
  // Meta will silently drop every inbound event — that's the
  // multi-number bug that prompted this work.
  const isRegistered = Boolean(config?.registered_at);
  const lastRegistrationError = config?.last_registration_error ?? null;

  const [verifyingRegistration, setVerifyingRegistration] = useState(false);
  type RegistrationProbe = {
    live: boolean;
    checks: Record<string, boolean | null>;
    errors?: string[];
    last_registration_error?: string | null;
    registered_at?: string | null;
    subscribed_apps_at?: string | null;
  };
  const [registrationProbe, setRegistrationProbe] =
    useState<RegistrationProbe | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const fetchConfig = useCallback(async (acctId: string) => {
    setLoading(true);
    try {
      // Load form values from Supabase (shows what's in DB).
      // Switched from `user_id` (which would only match the row's
      // original author) to `account_id` so every member of the
      // account sees the same saved configuration. UNIQUE(account_id)
      // on the table guarantees the .maybeSingle() return type
      // remains accurate.
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', acctId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load config row:', error);
      }

      if (data) {
        setConfig(data);
        setPhoneNumberId(data.phone_number_id || '');
        setWabaId(data.waba_id || '');
        setAccessToken(MASKED_TOKEN);
        setPin('');
        setTokenEdited(false);
        // Undefined on a row read before migration 039 — treat that as
        // on, matching the webhook's own default.
        setMirrorMedia(data.mirror_inbound_media !== false);
      } else {
        setConfig(null);
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerifyToken('');
        setPin('');
        setTokenEdited(false);
        setMirrorMedia(true);
        setPhoneInfo(null);
        setIsEditing(true);
      }
      // Clear any stale probe result when reloading the row.
      setRegistrationProbe(null);

      // Then verify health via the API (decrypts token + pings Meta)
      if (data) {
        try {
          const res = await fetch('/api/whatsapp/config', { method: 'GET' });
          const payload = await res.json();

          if (payload.connected) {
            setConnectionStatus('connected');
            setResetReason(null);
            setStatusMessage('');
            setStatusMeta(null);
            setWabaSubscription(payload.waba_subscription ?? null);
            setPhoneInfo(payload.phone_info ?? null);
            if (payload.verify_token) {
              setVerifyToken(payload.verify_token);
            }
            setIsEditing(false);
          } else {
            setConnectionStatus('disconnected');
            setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
            setStatusMessage(payload.message || '');
            setStatusMeta(payload.meta ?? null);
            setWabaSubscription(null);
            setPhoneInfo(null);
            setIsEditing(true);
          }
        } catch (err) {
          console.error('Health check failed:', err);
          setConnectionStatus('disconnected');
          setIsEditing(true);
        }
      } else {
        setConnectionStatus('disconnected');
        setResetReason(null);
        setStatusMessage('');
        setStatusMeta(null);
        setWabaSubscription(null);
        setPhoneInfo(null);
        setIsEditing(true);
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [supabase, t]);

  useEffect(() => {
    // Need both the auth session (`!authLoading`) AND the profile
    // (`!profileLoading`, which carries `accountId`). Without the
    // second guard, the effect would fire with `accountId === null`
    // for the first render window and bail without ever retrying
    // once the profile arrives.
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      loadedAccountIdRef.current = null;
      setLoading(false);
      return;
    }
    if (loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    fetchConfig(accountId);
  }, [authLoading, profileLoading, user?.id, accountId, fetchConfig]);

  async function handleToggleMirrorMedia(next: boolean) {
    if (!config || !accountId || savingMirror) return;
    // Optimistic — the switch should feel instant; a failure rolls it
    // back rather than leaving the UI ahead of the row.
    const previous = mirrorMedia;
    setMirrorMedia(next);
    setSavingMirror(true);
    try {
      const { error } = await supabase
        .from('whatsapp_config')
        .update({ mirror_inbound_media: next })
        .eq('account_id', accountId);
      if (error) throw new Error(error.message);
      setConfig({ ...config, mirror_inbound_media: next });
    } catch (error) {
      console.error('Failed to update media retention setting:', error);
      setMirrorMedia(previous);
      toast.error(t('mirrorInboundSaveFailed'));
    } finally {
      setSavingMirror(false);
    }
  }

  async function handleSave() {
    if (!phoneNumberId.trim()) {
      toast.error(t('phoneNumberIdRequired'));
      return;
    }
    if (!META_ID_RE.test(phoneNumberId.trim())) {
      toast.error(t('phoneNumberIdNotNumeric'));
      return;
    }
    if (wabaId.trim() && !META_ID_RE.test(wabaId.trim())) {
      toast.error(t('wabaIdNotNumeric'));
      return;
    }
    if (!config && (!accessToken.trim() || !tokenEdited)) {
      toast.error(t('accessTokenRequired'));
      return;
    }

    try {
      setSaving(true);

      // Always POST through the API — it verifies with Meta and encrypts
      // the access_token server-side with ENCRYPTION_KEY. Skipping this
      // and writing direct to Supabase stores the token in plaintext,
      // which then fails decryption on every subsequent health check.
      const payload: Record<string, unknown> = {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        verify_token: verifyToken.trim() || null,
        // Optional — only sent when the user filled it in. The server
        // requires it on first save or when changing numbers; for a
        // simple token rotation, leaving it blank skips re-register.
        pin: pin.trim() || null,
      };

      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (config) {
        // Existing config — reuse stored encrypted token by decrypting on the
        // server. But our POST handler requires an access_token to verify
        // with Meta. If the user didn't change the token, we need to signal
        // that. Simplest: require token re-entry if they're updating.
        toast.error(t('reenterAccessToken'));
        setSaving(false);
        return;
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // The route names the failing step and which field to check
        // (issue #505). Keep the details on screen — a toast is too
        // short-lived to copy a trace id out of.
        setSaveFailure({
          message: data.error || t('saveFailed'),
          meta: data.meta ?? null,
        });
        toast.error(data.error || t('saveFailed'), { duration: 10000 });
        setSaving(false);
        return;
      }
      setSaveFailure(null);

      // The route now returns a structured outcome:
      //   * registered=true   → number is live, events will flow
      //   * registered=false  → credentials saved but /register
      //                         failed; UI shows the specific error
      //                         and a retry path. registration_error
      //                         is human-readable from Meta.
      if (data.registered === false && data.registration_error) {
        setSaveFailure({
          message: `Saved, but Meta couldn't register the number: ${data.registration_error}`,
          meta: data.meta ?? null,
        });
        toast.error(
          t('savedButRegistrationFailed', { error: data.registration_error }),
          { duration: 12000 },
        );
      } else if (data.registration_skipped) {
        // Credentials saved + verified, but /register was skipped
        // because no PIN was supplied (e.g. a Meta test number).
        // Don't claim the number is "Live" — point at the
        // Registration status banner instead.
        toast.success(
          t('savedRegistrationSkipped'),
          { duration: 10000 },
        );
        setPin('');
      } else {
        toast.success(
          data.phone_info?.verified_name
            ? t('liveWithName', { name: data.phone_info.verified_name })
            : t('connectedGeneric'),
        );
        // Clear the PIN so subsequent saves don't accidentally
        // re-register (which would void the active subscription if
        // the PIN became stale).
        setPin('');
      }

      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('Save error:', err);
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'GET' });
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
        setStatusMeta(null);
        setWabaSubscription(payload.waba_subscription ?? null);
        toast.success(
          payload.phone_info?.verified_name
            ? t('connectedTo', { name: payload.phone_info.verified_name })
            : t('apiConnectionOk')
        );
      } else {
        setConnectionStatus('disconnected');
        setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
        setStatusMessage(payload.message || '');
        setStatusMeta(payload.meta ?? null);
        setWabaSubscription(null);
        toast.error(payload.message || t('apiConnectionFailed'), { duration: 10000 });
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error(t('connectionTestFailed'));
    } finally {
      setTesting(false);
    }
  }

  async function handleVerifyRegistration() {
    setVerifyingRegistration(true);
    setRegistrationProbe(null);
    try {
      const res = await fetch('/api/whatsapp/config/verify-registration', {
        method: 'GET',
      });
      const data = (await res.json()) as RegistrationProbe;
      setRegistrationProbe(data);
      if (data.live) {
        toast.success(t('fullyWired'));
      } else {
        toast.error(
          t('notFullyRegistered'),
          { duration: 8000 },
        );
      }
      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('verify-registration failed:', err);
      toast.error(t('verifyEndpointUnreachable'));
    } finally {
      setVerifyingRegistration(false);
    }
  }

  async function handleReset() {
    if (!confirm(t('resetConfirm'))) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t('resetFailed'));
        return;
      }

      toast.success(t('resetDone'));
      setConfig(null);
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setVerifyToken('');
      setTokenEdited(false);
      setConnectionStatus('disconnected');
      setResetReason(null);
      setStatusMessage('');
      setStatusMeta(null);
      setSaveFailure(null);
      setWabaSubscription(null);
      setPhoneInfo(null);
      setIsEditing(true);
    } catch (err) {
      console.error('Reset error:', err);
      toast.error(t('resetFailed'));
    } finally {
      setResetting(false);
    }
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success(t('webhookCopied'));
  }

  function handleCopyVerifyToken() {
    if (!verifyToken) return;
    navigator.clipboard.writeText(verifyToken);
    toast.success(t('verifyTokenCopied'));
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title={t("title")}
          description={t("description")}
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  const showResetBanner = resetReason === 'token_corrupted';

  // Step + code + trace id in small muted text, so a user can quote
  // them to Meta support (issue #505). The step names are wire values
  // from the route, shown verbatim.
  const renderMetaDetails = (meta: MetaErrorMeta) => (
    <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-muted-foreground break-all">
      <p>
        {t('metaErrorStep')}: <code>{meta.step}</code>
        {meta.code !== null && meta.code !== undefined && (
          <>
            {' · '}
            {t('metaErrorCode')}:{' '}
            <code>
              {meta.code}
              {meta.subcode !== null && meta.subcode !== undefined ? `/${meta.subcode}` : ''}
            </code>
          </>
        )}
        {meta.fbtrace_id && (
          <>
            {' · '}
            {t('metaErrorTrace')}: <code>{meta.fbtrace_id}</code>
          </>
        )}
      </p>
      {meta.message && (
        <p>
          {t('metaErrorMessage')}: {meta.message}
        </p>
      )}
      <p>{t('metaErrorDetailsHint')}</p>
    </div>
  );

  return (
    <section className="animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title={t("title")}
        description={t("description")}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Main config form */}
      <div className="space-y-6">
        {/* Corrupted-token reset banner */}
        {showResetBanner && (
          <Alert className="rounded-xl border border-amber-200/80 bg-amber-50/80 text-amber-900 dark:bg-amber-950/40 dark:border-amber-600/40 dark:text-amber-100 shadow-xs">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <AlertTitle className="text-amber-950 dark:text-amber-200 font-semibold mb-1">
                  {t('tokenCorrupted')}
                </AlertTitle>
                <AlertDescription className="text-amber-800/90 dark:text-amber-100/80 text-sm">
                  {statusMessage}
                </AlertDescription>
                <Button
                  onClick={handleReset}
                  disabled={resetting}
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
                >
                  {resetting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('resetting')}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-4" />
                      {t('resetConfig')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Last save failed — why, which field, and what to quote to Meta */}
        {saveFailure && (
          <Alert className="rounded-xl border border-red-200/80 bg-red-50/80 text-red-900 dark:bg-red-950/30 dark:border-red-700/50 dark:text-red-100 shadow-xs">
            <div className="flex items-start gap-3">
              <XCircle className="size-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <AlertTitle className="text-red-950 dark:text-red-200 font-semibold mb-1">{t('lastSaveFailed')}</AlertTitle>
                <AlertDescription className="text-red-800/90 dark:text-red-100/80 text-sm">
                  {saveFailure.message}
                </AlertDescription>
                {saveFailure.meta && renderMetaDetails(saveFailure.meta)}
              </div>
            </div>
          </Alert>
        )}

        {/* Unified WhatsApp API Live Status & Registration Card */}
        {connectionStatus === 'connected' ? (
          <div
            className={cn(
              'relative overflow-hidden rounded-2xl border p-5 shadow-xs transition-all',
              isRegistered
                ? 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 dark:border-emerald-800/50 dark:from-emerald-950/25 dark:via-background dark:to-emerald-950/10'
                : 'border-amber-200/90 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/30 dark:border-amber-800/50 dark:from-amber-950/25 dark:via-background dark:to-amber-950/10',
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              {/* Left: Icon, Title, and Description */}
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div
                  className={cn(
                    'relative flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 mt-0.5 shadow-2xs',
                    isRegistered
                      ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400',
                  )}
                >
                  {isRegistered ? (
                    <>
                      <CheckCircle2 className="size-5" />
                      <span className="absolute -top-1 -right-1 flex size-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex size-3 rounded-full bg-emerald-500 border-2 border-white dark:border-background" />
                      </span>
                    </>
                  ) : (
                    <AlertTriangle className="size-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3
                      className={cn(
                        'text-sm font-semibold tracking-tight',
                        isRegistered
                          ? 'text-emerald-950 dark:text-emerald-100'
                          : 'text-amber-950 dark:text-amber-100',
                      )}
                    >
                      {isRegistered ? t('registered') : t('notRegistered')}
                    </h3>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border',
                        isRegistered
                          ? 'bg-emerald-100/90 text-emerald-800 border-emerald-200/70 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-700/50'
                          : 'bg-amber-100/90 text-amber-800 border-amber-200/70 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700/50',
                      )}
                    >
                      {isRegistered ? (
                        <>
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live & Subscribed
                        </>
                      ) : (
                        'Action Required'
                      )}
                    </span>
                  </div>

                  <p
                    className={cn(
                      'mt-1 text-xs leading-relaxed',
                      isRegistered
                        ? 'text-emerald-800/85 dark:text-emerald-300/80'
                        : 'text-amber-800/85 dark:text-amber-300/80',
                    )}
                  >
                    {isRegistered ? (
                      config?.registered_at ? (
                        <>
                          Subscribed since{' '}
                          <span className="font-semibold text-emerald-950 dark:text-emerald-200">
                            {new Date(config.registered_at).toLocaleString()}
                          </span>
                          . Inbound customer messages and status events deliver in real time to EasyETS.
                        </>
                      ) : (
                        t('connectedDesc')
                      )
                    ) : lastRegistrationError ? (
                      <>
                        {t('lastAttemptFailed')}
                        <span className="font-semibold text-red-600 dark:text-red-300">
                          &quot;{lastRegistrationError}&quot;
                        </span>
                        . {t('retryHint')}
                      </>
                    ) : (
                      <>{t('noRegistrationHint')}</>
                    )}
                  </p>
                </div>
              </div>

              {/* Right: Verify with Meta Button */}
              <div className="shrink-0 sm:self-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyRegistration}
                  disabled={verifyingRegistration}
                  className={cn(
                    'h-8.5 px-3.5 text-xs font-semibold rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer gap-1.5',
                    isRegistered
                      ? 'border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 hover:border-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/50'
                      : 'border-amber-300 bg-white hover:bg-amber-50 text-amber-900 hover:border-amber-400 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/50',
                  )}
                >
                  {verifyingRegistration ? (
                    <Loader2 className="size-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Zap className="size-3.5 text-emerald-600 fill-emerald-600/20 dark:text-emerald-400" />
                  )}
                  {t('verifyWithMeta')}
                </Button>
              </div>
            </div>

            {/* Micro status badges row */}
            <div
              className={cn(
                'mt-3.5 pt-3 border-t flex items-center gap-2 sm:gap-4 flex-wrap text-[11px]',
                isRegistered
                  ? 'border-emerald-200/70 text-emerald-800/90 dark:border-emerald-800/40 dark:text-emerald-300/90'
                  : 'border-amber-200/70 text-amber-800/90 dark:border-amber-800/40 dark:text-amber-300/90',
              )}
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Credentials Authenticated</span>
              </div>
              <span className="opacity-40 hidden sm:inline">•</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{isRegistered ? 'Webhooks Wired & Registered' : 'Registration Pending'}</span>
              </div>
              {wabaSubscription?.checked && (
                <>
                  <span className="opacity-40 hidden sm:inline">•</span>
                  <div className="flex items-center gap-1.5">
                    {wabaSubscription.subscribed === false ? (
                      <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    <span
                      className={
                        wabaSubscription.subscribed === false
                          ? 'text-amber-700 dark:text-amber-300 font-medium'
                          : ''
                      }
                    >
                      {wabaSubscription.subscribed === false
                        ? 'WABA Not Subscribed'
                        : 'WABA Subscribed'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Probe diagnostics if run */}
            {registrationProbe && (
              <div className="mt-3.5 rounded-xl border border-emerald-200/90 bg-white/95 dark:border-border dark:bg-card/70 p-3.5 space-y-2.5 text-[11px] shadow-2xs">
                <p className="font-semibold text-foreground flex items-center gap-2">
                  {t('diagnosticLastRun')}
                  <span
                    className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                      registrationProbe.live
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
                    )}
                  >
                    {registrationProbe.live ? t('live') : t('notLive')}
                  </span>
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-muted-foreground">
                  {Object.entries(registrationProbe.checks).map(([k, v]) => (
                    <li key={k} className="flex items-center gap-1.5">
                      {v === true ? (
                        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : v === false ? (
                        <XCircle className="size-3.5 text-red-600 dark:text-red-400 shrink-0" />
                      ) : (
                        <span className="size-3.5 rounded-full border border-border shrink-0" />
                      )}
                      <code className="text-foreground/90 font-mono text-[10px]">{k}</code>
                    </li>
                  ))}
                </ul>
                {(registrationProbe.errors ?? []).length > 0 && (
                  <ul className="pt-1.5 space-y-0.5 text-red-600 dark:text-red-300 font-medium">
                    {registrationProbe.errors?.map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs transition-all">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground mt-0.5">
                <XCircle className="size-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground tracking-tight">
                    {t('notConnected')}
                  </h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100/80 dark:bg-red-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-800/40">
                    Disconnected
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {statusMessage || t('notConnectedDesc')}
                </p>
                {statusMeta && renderMetaDetails(statusMeta)}
              </div>
            </div>
          </div>
        )}

        {/* Active Configuration or Edit Connection Form */}
        {connectionStatus === 'connected' && !isEditing ? (
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 pb-4">
              <div className="min-w-0">
                <CardTitle className="text-foreground flex items-center gap-2 text-base font-semibold">
                  <BadgeCheck className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  {t('activeConfigTitle')}
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs mt-1">
                  {t('activeConfigDesc')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-nowrap shrink-0 overflow-x-auto max-w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                    setConnectMode('manual');
                  }}
                  className="h-8 px-3 text-xs font-medium border-border text-foreground hover:bg-muted cursor-pointer gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Edit className="size-3.5" />
                  {t('editConfig')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="h-8 px-3 text-xs font-medium border-border text-foreground hover:bg-muted cursor-pointer gap-1.5 whitespace-nowrap shrink-0"
                >
                  {testing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Zap className="size-3.5 text-amber-500" />
                  )}
                  {t('testApi')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={resetting}
                  className="h-8 px-3 text-xs font-medium border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 cursor-pointer gap-1.5 whitespace-nowrap shrink-0"
                >
                  {resetting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3.5" />
                  )}
                  {t('disconnect')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border/70 bg-muted/40 p-3.5">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('businessName')}</p>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Building2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{phoneInfo?.verified_name || 'Easy ets'}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/40 p-3.5">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('phoneNumber')}</p>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Phone className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{phoneInfo?.display_phone_number || '+91 98098 03210'}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/40 p-3.5">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('phoneNumberId')}</p>
                  <p className="text-xs font-mono font-medium text-foreground select-all">{phoneNumberId}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/40 p-3.5">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('wabaId')}</p>
                  <p className="text-xs font-mono font-medium text-foreground select-all">{wabaId || 'Not set'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Connection Method Selector */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-1">
              <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl border border-border">
                <Button
                  type="button"
                  variant={connectMode === 'embedded' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setConnectMode('embedded')}
                  className="rounded-lg text-xs font-semibold gap-1.5 h-8 cursor-pointer"
                >
                  <Zap className="size-3.5 text-amber-400" />
                  1-Click Meta Connect
                </Button>
                <Button
                  type="button"
                  variant={connectMode === 'manual' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setConnectMode('manual')}
                  className="rounded-lg text-xs font-semibold gap-1.5 h-8 cursor-pointer"
                >
                  Manual Credentials
                </Button>
              </div>

              {config && connectionStatus === 'connected' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {t('cancelEdit')}
                </Button>
              )}
            </div>

            {connectMode === 'embedded' && (
              <WhatsAppEmbeddedSignup
                isConnected={connectionStatus === 'connected'}
                onSuccess={() => {
                  if (accountId) fetchConfig(accountId);
                }}
              />
            )}

            {connectMode === 'manual' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-foreground">{t('apiCredentialsTitle')}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {t('apiCredentialsDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {config && isEditing && (
                    <Alert className="bg-primary/5 border-primary/20 mb-2 py-2.5">
                      <AlertDescription className="text-primary text-xs flex items-center gap-2">
                        <AlertTriangle className="size-4 shrink-0" />
                        <span>To update your configuration, re-enter your <strong>Permanent Access Token</strong> for security verification with Meta.</span>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('phoneNumberId')}</Label>
                    <Input
                      placeholder={t('phoneNumberIdPlaceholder')}
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('wabaId')}</Label>
                    <Input
                      placeholder={t('wabaIdPlaceholder')}
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('accessToken')}</Label>
                    <div className="relative">
                      <Input
                        type={showToken ? 'text' : 'password'}
                        placeholder={t('accessTokenPlaceholder')}
                        value={accessToken}
                        onChange={(e) => {
                          setAccessToken(e.target.value);
                          setTokenEdited(true);
                        }}
                        onFocus={() => {
                          if (accessToken === MASKED_TOKEN) {
                            setAccessToken('');
                            setTokenEdited(true);
                          }
                        }}
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {config && !tokenEdited && (
                      <p className="text-xs text-muted-foreground">
                        {t('tokenHidden')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('webhookVerifyToken')}</Label>
                    <Input
                      placeholder={t('webhookVerifyTokenPlaceholder')}
                      value={verifyToken}
                      onChange={(e) => setVerifyToken(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('webhookVerifyTokenHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">
                      {t('twoStepPin')}
                      <span className="ml-1 text-muted-foreground">{t('optional')}</span>
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder={t('pinPlaceholder')}
                      value={pin}
                      onChange={(e) =>
                        setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground tracking-widest"
                    />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span dangerouslySetInnerHTML={{ __html: t('pinHint') }} />
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons for Edit/Connect Mode */}
            <div className="flex flex-wrap gap-3">
              {connectMode === 'manual' && (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('saving')}
                    </>
                  ) : (
                    t('saveConfig')
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !config}
                className="border-border text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                {testing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t('testing')}
                  </>
                ) : (
                  <>
                    <Zap className="size-4" />
                    {t('testConnection')}
                  </>
                )}
              </Button>
              {config && connectionStatus === 'connected' && (
                <Button
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {t('cancelEdit')}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Webhook Configuration — Always visible with Callback URL & Verify Token */}
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardHeader>
            <CardTitle className="text-foreground text-base font-semibold">{t('webhookTitle')}</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              {t('webhookDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-medium">{t('webhookUrl')}</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="bg-muted border-border text-foreground font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyWebhookUrl}
                  title="Copy Webhook URL"
                  className="shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-medium">{t('webhookVerifyToken')}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showVerifyToken ? 'text' : 'password'}
                    readOnly={!isEditing}
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    placeholder={t('webhookVerifyTokenPlaceholder')}
                    className="bg-muted border-border text-foreground font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVerifyToken(!showVerifyToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {showVerifyToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyVerifyToken}
                  disabled={!verifyToken}
                  title="Copy Verify Token"
                  className="shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('webhookVerifyTokenHint')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Attachment retention */}
        {config && (
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader>
              <CardTitle className="text-foreground text-base font-semibold">{t('mediaTitle')}</CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                {t('mediaDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-muted/30 p-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('mirrorInbound')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('mirrorInboundDesc')}
                  </p>
                  {!mirrorMedia && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                      {t('mirrorInboundOffWarning')}
                    </p>
                  )}
                </div>
                <Switch
                  checked={mirrorMedia}
                  onCheckedChange={handleToggleMirrorMedia}
                  disabled={savingMirror || !canEditSettings}
                  aria-label={t('mirrorInbound')}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Setup Instructions Sidebar */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base">{t('setupInstructions')}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {t('setupInstructionsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion>
              <AccordionItem className="border-border">
                <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                    {t('step1')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li dangerouslySetInnerHTML={{ __html: t('step1_1') }} />
                    <li>{t('step1_2')}</li>
                    <li>{t('step1_3')}</li>
                    <li>{t('step1_4')}</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-border">
                <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                    {t('step2')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>{t('step2_1')}</li>
                    <li>{t('step2_2')}</li>
                    <li>{t('step2_3')}</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-border">
                <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                    {t('step3')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>{t('step3_1')}</li>
                    <li dangerouslySetInnerHTML={{ __html: t.raw('step3_2') }} />
                    <li dangerouslySetInnerHTML={{ __html: t.raw('step3_3') }} />
                    <li dangerouslySetInnerHTML={{ __html: t.raw('step3_4') }} />
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-border">
                <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span>
                    {t('step4')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>{t('step4_1')}</li>
                    <li>{t('step4_2')}</li>
                    <li dangerouslySetInnerHTML={{ __html: t.raw('step4_3') }} />
                    <li dangerouslySetInnerHTML={{ __html: t.raw('step4_4') }} />
                    <li>{t('step4_5')}</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-4 pt-4 border-t border-border">
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="size-3.5" />
                {t('metaDocs')}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </section>
  );
}
