'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Phone,
  Calendar,
  Lock,
  Unlock,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const SUPER_ADMIN_EMAIL = 'dheeraj@mobilitysum.com';

interface TenantItem {
  accountId: string;
  accountName: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  joinedAt: string;
  isActive: boolean;
  whatsapp: {
    configured: boolean;
    phoneNumberId: string | null;
    wabaId: string | null;
    status: string;
    isRegistered: boolean;
  };
}

interface ApiResponse {
  tenants: TenantItem[];
  total: number;
  activeCount: number;
  whatsappCount: number;
}

export default function TenantsPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);

  const isSuperAdmin = profile?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  const fetchTenants = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const res = await fetch('/api/admin/tenants');
      if (!res.ok) {
        if (res.status === 403) {
          router.push('/dashboard');
          return;
        }
        throw new Error('Failed to load tenants data');
      }
      const data: ApiResponse = await res.json();
      setTenants(data.tenants || []);
      if (showToast) toast.success('Tenant list updated');
    } catch (err: any) {
      toast.error(err.message || 'Error fetching tenants');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!isSuperAdmin) {
        router.push('/dashboard');
      } else {
        fetchTenants();
      }
    }
  }, [authLoading, isSuperAdmin]);

  const handleToggleStatus = async (tenant: TenantItem) => {
    const action = tenant.isActive ? 'deactivate' : 'activate';
    const confirmMsg = tenant.isActive
      ? `Are you sure you want to DEACTIVATE "${tenant.ownerName}" (${tenant.ownerEmail})? They will be unable to log in until re-activated.`
      : `Are you sure you want to RE-ACTIVATE "${tenant.ownerName}" (${tenant.ownerEmail})? Their access will be restored immediately.`;

    if (!confirm(confirmMsg)) return;

    setActionPendingId(tenant.ownerUserId);
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: tenant.ownerUserId,
          action,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update tenant status');
      }

      toast.success(data.message || `Tenant ${action}d successfully!`);

      // Update local state
      setTenants((prev) =>
        prev.map((t) =>
          t.ownerUserId === tenant.ownerUserId ? { ...t, isActive: !t.isActive } : t
        )
      );
    } catch (err: any) {
      toast.error(err.message || 'Error updating tenant status');
    } finally {
      setActionPendingId(null);
    }
  };

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.accountName?.toLowerCase().includes(q) ||
        t.ownerName?.toLowerCase().includes(q) ||
        t.ownerEmail?.toLowerCase().includes(q) ||
        t.whatsapp.phoneNumberId?.includes(q)
    );
  }, [tenants, search]);

  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.isActive).length;
  const deactivatedTenants = totalTenants - activeTenants;
  const whatsappConnected = tenants.filter((t) => t.whatsapp.configured).length;

  if (authLoading || (!isSuperAdmin && loading)) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="mx-auto size-12 text-destructive mb-3" />
        <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This portal is reserved strictly for the platform Super Administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Tenants Portal</h1>
            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500 border border-amber-500/20">
              Super Admin
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overview of all registered tenant organizations, WhatsApp status, and account controls.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchTenants(true)}
          disabled={refreshing}
          className="self-start sm:self-auto gap-2"
        >
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tenants</CardTitle>
            <Building2 className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalTenants}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered organizations</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Tenants</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeTenants}</div>
            <p className="text-xs text-muted-foreground mt-1">Normal platform access</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deactivated</CardTitle>
            <XCircle className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{deactivatedTenants}</div>
            <p className="text-xs text-muted-foreground mt-1">Login suspended</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">WhatsApp Connected</CardTitle>
            <Phone className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{whatsappConnected}</div>
            <p className="text-xs text-muted-foreground mt-1">Active phone configurations</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table Card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Registered Tenants</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Showing {filteredTenants.length} of {totalTenants} total tenant accounts
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search tenant or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-muted border-border"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Tenant & Owner</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Join Date</th>
                  <th className="px-6 py-3.5">WhatsApp Setup</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      No tenants found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => {
                    const isSelf = t.ownerEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                    const isPending = actionPendingId === t.ownerUserId;

                    return (
                      <tr key={t.accountId} className="hover:bg-muted/30 transition-colors">
                        {/* Tenant & Owner Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-xs">
                              {t.ownerName?.charAt(0)?.toUpperCase() || 'T'}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-1.5">
                                {t.ownerName}
                                {isSelf && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-primary/15 text-primary">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{t.accountName}</div>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-6 py-4 font-mono text-xs text-foreground/90">
                          {t.ownerEmail}
                        </td>

                        {/* Join Date */}
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="size-3.5 text-muted-foreground/70" />
                            {new Date(t.joinedAt).toLocaleDateString('en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </td>

                        {/* WhatsApp Status */}
                        <td className="px-6 py-4">
                          {t.whatsapp.configured ? (
                            <div className="flex flex-col gap-1 items-start">
                              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live & Connected
                              </span>
                              {t.whatsapp.phoneNumberId && (
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  ID: {t.whatsapp.phoneNumberId}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border">
                              Not Configured
                            </span>
                          )}
                        </td>

                        {/* Status & Action in Same Column */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            {t.isActive ? (
                              <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="size-3.5" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                <XCircle className="size-3.5" />
                                Deactivated
                              </span>
                            )}

                            {!isSelf && (
                              <Button
                                variant={t.isActive ? 'outline' : 'default'}
                                size="sm"
                                disabled={isPending}
                                onClick={() => handleToggleStatus(t)}
                                className={`h-7 px-2.5 text-xs font-medium gap-1.5 ${
                                  t.isActive
                                    ? 'border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-400 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                }`}
                              >
                                {isPending ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : t.isActive ? (
                                  <>
                                    <Lock className="size-3" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="size-3" />
                                    Activate
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
