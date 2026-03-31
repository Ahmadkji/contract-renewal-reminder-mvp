"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  Crown,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

type BillingPlanCode = "monthly" | "yearly";
type BillingAction = BillingPlanCode | "portal";
type BillingPricingSource = "live" | "fallback";

interface BillingStatusData {
  planCode: BillingPlanCode | null;
  subscriptionStatus: string;
  isPremium: boolean;
  features: {
    emailReminders: boolean;
    csvExport: boolean;
  };
  usage: {
    contractsLimit: number | null;
  };
  effectiveTo: string | null;
  currentPeriodEndDate: string | null;
  currentPeriodStartDate: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialEnd: string | null;
  computedAt: string | null;
}

interface BillingPricingPlan {
  planCode: BillingPlanCode;
  displayName: string;
  priceCents: number;
  currency: string;
  billingPeriod: string;
  productId: string;
  monthlyEquivalentCents: number;
  yearlySavingsPercent: number;
}

interface BillingPricingData {
  plans: BillingPricingPlan[];
  currency: string;
  source: BillingPricingSource;
  stale: boolean;
  generatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface CheckoutResponse {
  checkoutUrl?: string;
}

interface PortalResponse {
  portalUrl?: string;
}

function createLocalFallbackPricing(): BillingPricingData {
  return {
    plans: [
      {
        planCode: "monthly",
        displayName: "Monthly",
        priceCents: 1900,
        currency: "USD",
        billingPeriod: "every-month",
        productId: "",
        monthlyEquivalentCents: 1900,
        yearlySavingsPercent: 0,
      },
      {
        planCode: "yearly",
        displayName: "Yearly",
        priceCents: 19000,
        currency: "USD",
        billingPeriod: "every-year",
        productId: "",
        monthlyEquivalentCents: 1583,
        yearlySavingsPercent: 17,
      },
    ],
    currency: "USD",
    source: "fallback",
    stale: true,
    generatedAt: new Date().toISOString(),
  };
}

function formatPlan(planCode: BillingPlanCode | null, isPremium: boolean): string {
  if (!isPremium || !planCode) {
    return "Free";
  }

  return planCode === "yearly" ? "Yearly" : "Monthly";
}

function formatStatus(status: string): string {
  if (!status) return "None";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatPeriodLabel(billingPeriod: string): string {
  if (billingPeriod.includes("month")) return "/month";
  if (billingPeriod.includes("year")) return "/year";
  return "/billing cycle";
}

function formatContractLimit(limit: number | null | undefined): string {
  if (limit === null || limit === undefined) {
    return "Unlimited contracts";
  }

  return `Up to ${limit} contracts`;
}

function isActiveSubscriptionStatus(status?: string): boolean {
  if (!status) return false;
  return ["active", "trialing", "past_due", "unpaid"].includes(status);
}

function normalizeRetryAfterSeconds(value: unknown, fallback: number = 30): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(1, Math.min(300, Math.trunc(parsed)));
}

export function BillingPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const billingParam = searchParams.get("billing");
  const fallbackPricing = useMemo(() => createLocalFallbackPricing(), []);

  const [status, setStatus] = useState<BillingStatusData | null>(null);
  const [pricing, setPricing] = useState<BillingPricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<BillingAction | null>(null);
  const [checkoutCooldownUntilMs, setCheckoutCooldownUntilMs] = useState(0);
  const [checkoutCooldownNowMs, setCheckoutCooldownNowMs] = useState(0);

  const loadBillingData = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const statusPromise = fetch("/api/billing/status", {
        method: "GET",
        cache: "no-store",
      });
      const pricingPromise = fetch("/api/billing/plans", {
        method: "GET",
        cache: "no-store",
      });

      const [statusResult, pricingResult] = await Promise.allSettled([
        statusPromise,
        pricingPromise,
      ]);

      let statusLoaded = false;

      if (statusResult.status === "fulfilled") {
        try {
          const payload = (await statusResult.value.json().catch(() => ({}))) as ApiResponse<BillingStatusData>;
          if (!statusResult.value.ok || !payload.success || !payload.data) {
            throw new Error(payload.error || "Failed to load billing status.");
          }
          setStatus(payload.data);
          statusLoaded = true;
        } catch (statusError) {
          const message =
            statusError instanceof Error ? statusError.message : "Failed to load billing status.";
          setError(message);
          toast({
            title: "Unable to load billing status",
            description: message,
            variant: "destructive",
          });
        }
      } else {
        setError("Failed to load billing status.");
        toast({
          title: "Unable to load billing status",
          description: "Please refresh and try again.",
          variant: "destructive",
        });
      }

      if (pricingResult.status === "fulfilled") {
        try {
          const payload = (await pricingResult.value.json().catch(() => ({}))) as ApiResponse<BillingPricingData>;
          if (!pricingResult.value.ok || !payload.success || !payload.data) {
            throw new Error(payload.error || "Failed to load pricing.");
          }
          setPricing(payload.data);
          setPricingError(null);
        } catch (planError) {
          const message = planError instanceof Error ? planError.message : "Failed to load pricing.";
          setPricing(fallbackPricing);
          setPricingError(message);
          toast({
            title: "Using cached pricing",
            description: "Live pricing is temporarily unavailable.",
          });
        }
      } else {
        setPricing(fallbackPricing);
        setPricingError("Failed to load pricing.");
        toast({
          title: "Using cached pricing",
          description: "Live pricing is temporarily unavailable.",
        });
      }

      if (statusLoaded) {
        setError(null);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [fallbackPricing]
  );

  useEffect(() => {
    void loadBillingData();
  }, [loadBillingData]);

  useEffect(() => {
    if (!billingParam) {
      return;
    }

    if (billingParam === "checkout_success") {
      toast({
        title: "Checkout completed",
        description: "We are refreshing your billing status now.",
      });
    } else if (billingParam === "checkout_canceled") {
      toast({
        title: "Checkout canceled",
        description: "No worries, your plan is unchanged.",
      });
    } else if (billingParam === "portal_return") {
      toast({
        title: "Returned from billing portal",
        description: "Your subscription details have been refreshed.",
      });
    }

    router.replace("/dashboard/billing");
    void loadBillingData({ silent: true });
  }, [billingParam, loadBillingData, router]);

  useEffect(() => {
    if (checkoutCooldownUntilMs <= Date.now()) {
      return;
    }

    const timer = setInterval(() => {
      setCheckoutCooldownNowMs(Date.now());
      if (Date.now() >= checkoutCooldownUntilMs) {
        clearInterval(timer);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [checkoutCooldownUntilMs]);

  const checkoutCooldownSeconds = useMemo(() => {
    if (checkoutCooldownUntilMs <= checkoutCooldownNowMs) {
      return 0;
    }
    return Math.max(
      0,
      Math.ceil((checkoutCooldownUntilMs - checkoutCooldownNowMs) / 1000)
    );
  }, [checkoutCooldownNowMs, checkoutCooldownUntilMs]);

  const handleCheckout = async (planCode: BillingPlanCode) => {
    if (pendingAction || checkoutCooldownSeconds > 0) {
      return;
    }

    setPendingAction(planCode);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify({ planCode }),
      });

      const payload = (await response.json().catch(() => ({}))) as ApiResponse<CheckoutResponse> & {
        code?: string;
        retryAfterSeconds?: number;
      };

      if (!response.ok) {
        const isCheckoutRateLimited =
          response.status === 429 || payload.code === "CHECKOUT_RATE_LIMITED";

        if (isCheckoutRateLimited) {
          const retryAfterSeconds = normalizeRetryAfterSeconds(
            payload.retryAfterSeconds ?? response.headers.get("retry-after"),
            30
          );
          const now = Date.now();
          setCheckoutCooldownNowMs(now);
          setCheckoutCooldownUntilMs(now + retryAfterSeconds * 1000);
          toast({
            title: "Checkout temporarily limited",
            description:
              payload.error || `Please wait ${retryAfterSeconds}s before trying again.`,
          });
          return;
        }
      }

      if (!response.ok || !payload.success || !payload.data?.checkoutUrl) {
        throw new Error(payload.error || "Failed to start checkout.");
      }

      window.location.assign(payload.data.checkoutUrl);
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error ? checkoutError.message : "Failed to start checkout.";
      toast({
        title: "Checkout failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleOpenPortal = async () => {
    if (pendingAction) {
      return;
    }

    setPendingAction("portal");
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          Origin: window.location.origin,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as ApiResponse<PortalResponse>;
      if (!response.ok || !payload.success || !payload.data?.portalUrl) {
        throw new Error(payload.error || "Failed to open billing portal.");
      }

      window.location.assign(payload.data.portalUrl);
    } catch (portalError) {
      const message =
        portalError instanceof Error ? portalError.message : "Failed to open billing portal.";
      toast({
        title: "Billing portal unavailable",
        description: message,
        variant: "destructive",
      });
      setPendingAction(null);
    }
  };

  if (loading && !status) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="h-52 bg-[#141414] border border-white/[0.08] rounded-xl flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#a3a3a3] animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-[#141414] border border-red-500/30 rounded-xl p-6">
          <div className="flex items-center gap-2 text-red-300 mb-2">
            <XCircle className="w-5 h-5" />
            <h1 className="text-lg font-semibold">Unable to load billing</h1>
          </div>
          <p className="text-sm text-[#d4d4d4] mb-4">{error}</p>
          <button
            onClick={() => void loadBillingData()}
            className="h-10 px-4 text-sm font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const pricingData = pricing ?? fallbackPricing;
  const monthlyPlan =
    pricingData.plans.find((plan) => plan.planCode === "monthly") ?? fallbackPricing.plans[0];
  const yearlyPlan =
    pricingData.plans.find((plan) => plan.planCode === "yearly") ?? fallbackPricing.plans[1];
  const yearlySavings = yearlyPlan.yearlySavingsPercent;
  const hasPendingAction = pendingAction !== null;
  const hasCheckoutCooldown = checkoutCooldownSeconds > 0;
  const subscriptionStatus = formatStatus(status?.subscriptionStatus || "none");
  const activePlanLabel = formatPlan(status?.planCode ?? null, status?.isPremium ?? false);
  const isSubscriptionActive = isActiveSubscriptionStatus(status?.subscriptionStatus);
  const freePlanActive = !status?.isPremium || !isSubscriptionActive;
  const monthlyPlanActive = status?.isPremium && status?.planCode === "monthly" && isSubscriptionActive;
  const yearlyPlanActive = status?.isPremium && status?.planCode === "yearly" && isSubscriptionActive;

  const statusTone = (() => {
    const value = status?.subscriptionStatus || "none";
    if (value === "active" || value === "trialing") {
      return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
    }
    if (value === "past_due" || value === "unpaid") {
      return "bg-amber-500/15 text-amber-300 border-amber-400/30";
    }
    if (value === "canceled" || value === "expired") {
      return "bg-red-500/15 text-red-300 border-red-400/30";
    }
    return "bg-white/10 text-[#d4d4d4] border-white/15";
  })();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Billing</h1>
          <p className="text-sm text-[#a3a3a3] mt-1">
            Manage your plan, pricing, and premium subscription settings.
          </p>
        </div>

        <button
          onClick={() => void loadBillingData({ silent: true })}
          disabled={refreshing}
          className="h-9 px-3 inline-flex items-center gap-2 text-sm rounded-lg border border-white/10 text-[#d4d4d4] hover:text-white hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <section className="bg-[#141414] border border-white/[0.08] rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Plans & Pricing</h2>
            <p className="text-sm text-[#a3a3a3] mt-1">
              Professional plans with live pricing and instant checkout.
            </p>
          </div>

          <button
            onClick={() => void handleOpenPortal()}
            disabled={hasPendingAction}
            className="h-10 px-4 rounded-lg border border-white/15 text-[#d4d4d4] text-sm hover:text-white hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
          >
            {pendingAction === "portal" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUpRight className="w-4 h-4" />
            )}
            Manage Billing
          </button>
        </div>

        {(pricingData.stale || pricingError) && (
          <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Pricing data may be delayed. Showing cached values while live pricing refreshes.
          </div>
        )}
        {hasCheckoutCooldown && (
          <div className="mb-5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
            Checkout temporarily limited. Try again in {checkoutCooldownSeconds}s.
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <article
            className={`rounded-xl border p-5 ${
              freePlanActive
                ? "border-cyan-400/40 bg-cyan-500/10"
                : "border-white/10 bg-black/20"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Free</h3>
              {freePlanActive && (
                <span className="text-xs px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                  Current
                </span>
              )}
            </div>
            <div className="mb-4">
              <p className="text-3xl font-semibold text-white">$0</p>
              <p className="text-xs text-[#a3a3a3] mt-1">Forever</p>
            </div>
            <ul className="space-y-2 text-sm text-[#d4d4d4]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                {formatContractLimit(status?.usage.contractsLimit)}
              </li>
              <li className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-300" />
                CSV export
              </li>
              <li className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-300" />
                Email reminders
              </li>
            </ul>
          </article>

          <article
            className={`rounded-xl border p-5 ${
              monthlyPlanActive
                ? "border-cyan-400/40 bg-cyan-500/10"
                : "border-white/10 bg-black/20"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">{monthlyPlan.displayName}</h3>
              {monthlyPlanActive && (
                <span className="text-xs px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                  Current
                </span>
              )}
            </div>
            <div className="mb-4">
              <p className="text-3xl font-semibold text-white">
                {formatCurrency(monthlyPlan.priceCents, monthlyPlan.currency)}
              </p>
              <p className="text-xs text-[#a3a3a3] mt-1">{formatPeriodLabel(monthlyPlan.billingPeriod)}</p>
            </div>
            <ul className="space-y-2 text-sm text-[#d4d4d4] mb-4">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                Unlimited contracts
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                CSV export
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                Email reminders
              </li>
            </ul>
            <button
              onClick={() => void handleCheckout("monthly")}
              disabled={hasPendingAction || hasCheckoutCooldown || monthlyPlanActive}
              className="w-full h-10 px-4 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              {pendingAction === "monthly" && <Loader2 className="w-4 h-4 animate-spin" />}
              {monthlyPlanActive ? "Current Plan" : "Upgrade Monthly"}
            </button>
          </article>

          <article
            className={`rounded-xl border p-5 relative ${
              yearlyPlanActive
                ? "border-cyan-400/40 bg-cyan-500/10"
                : "border-[#3b82f6]/40 bg-blue-500/10"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">{yearlyPlan.displayName}</h3>
              <div className="flex items-center gap-2">
                {yearlySavings > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/40 inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </span>
                )}
                {yearlyPlanActive && (
                  <span className="text-xs px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                    Current
                  </span>
                )}
              </div>
            </div>
            <div className="mb-4">
              <p className="text-3xl font-semibold text-white">
                {formatCurrency(yearlyPlan.priceCents, yearlyPlan.currency)}
              </p>
              <p className="text-xs text-[#a3a3a3] mt-1">{formatPeriodLabel(yearlyPlan.billingPeriod)}</p>
              <p className="text-xs text-blue-200 mt-2">
                Equivalent to {formatCurrency(yearlyPlan.monthlyEquivalentCents, yearlyPlan.currency)}/month
              </p>
              {yearlySavings > 0 && (
                <p className="text-xs text-emerald-200 mt-1">Save {yearlySavings}% vs monthly billing</p>
              )}
            </div>
            <ul className="space-y-2 text-sm text-[#d4d4d4] mb-4">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                Unlimited contracts
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                CSV export
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                Email reminders
              </li>
            </ul>
            <button
              onClick={() => void handleCheckout("yearly")}
              disabled={hasPendingAction || hasCheckoutCooldown || yearlyPlanActive}
              className="w-full h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              {pendingAction === "yearly" && <Loader2 className="w-4 h-4 animate-spin" />}
              {yearlyPlanActive ? "Current Plan" : "Upgrade Yearly"}
            </button>
          </article>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-[#a3a3a3] mb-2">Current Plan</p>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-cyan-400" />
            <p className="text-xl font-semibold text-white">{activePlanLabel}</p>
          </div>
          <p className="text-xs text-[#a3a3a3] mt-3">
            {formatContractLimit(status?.usage.contractsLimit)}
          </p>
        </div>

        <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-[#a3a3a3] mb-2">Subscription Status</p>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs border ${statusTone}`}>
            {subscriptionStatus}
          </span>
          <p className="text-xs text-[#a3a3a3] mt-3">
            Current period end: {formatDate(status?.currentPeriodEndDate || null)}
          </p>
        </div>

        <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-5">
          <h2 className="text-sm uppercase tracking-wide text-[#a3a3a3] mb-3">Entitlements</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#a3a3a3]">Premium</span>
              <span className={status?.isPremium ? "text-emerald-300" : "text-[#d4d4d4]"}>
                {status?.isPremium ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#a3a3a3]">CSV Export</span>
              <span className={status?.features.csvExport ? "text-emerald-300" : "text-[#d4d4d4]"}>
                {status?.features.csvExport ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#a3a3a3]">Email Reminders</span>
              <span className={status?.features.emailReminders ? "text-emerald-300" : "text-[#d4d4d4]"}>
                {status?.features.emailReminders ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
          <p className="text-xs text-[#a3a3a3] mt-4">
            Pricing source: {pricingData.source === "live" ? "Live" : "Cached fallback"} · Updated{" "}
            {formatDate(pricingData.generatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
