"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Crown, RefreshCw, Sparkles } from "lucide-react";

type BillingPlanCode = "monthly" | "yearly";

interface BillingPlan {
  planCode: BillingPlanCode;
  displayName: string;
  priceCents: number;
  currency: string;
  billingPeriod: string;
  productId: string;
  monthlyEquivalentCents: number;
  yearlySavingsPercent: number;
}

interface BillingPricingSnapshot {
  plans: BillingPlan[];
  currency: string;
  source: "live" | "fallback";
  stale: boolean;
  generatedAt: string;
}

interface BillingStatusResponse {
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
  currentPeriodEndDate: string | null;
  currentPeriodStartDate: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialEnd: string | null;
  computedAt: string;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPeriodEnd(value: string | null): string {
  if (!value) {
    return "No renewal date";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }

  return payload.data as T;
}

export function BillingPageClient() {
  const [pricing, setPricing] = useState<BillingPricingSnapshot | null>(null);
  const [status, setStatus] = useState<BillingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"checkout" | "portal" | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [nextPricing, nextStatus] = await Promise.all([
          fetchJson<BillingPricingSnapshot>("/api/billing/plans"),
          fetchJson<BillingStatusResponse>("/api/billing/status"),
        ]);

        if (!mounted) {
          return;
        }

        setPricing(nextPricing);
        setStatus(nextStatus);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setActionError(error instanceof Error ? error.message : "Failed to load billing");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load().catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  const refreshStatus = async () => {
    setRefreshing(true);
    setActionError(null);
    try {
      const [nextPricing, nextStatus] = await Promise.all([
        fetchJson<BillingPricingSnapshot>("/api/billing/plans"),
        fetchJson<BillingStatusResponse>("/api/billing/status"),
      ]);
      setPricing(nextPricing);
      setStatus(nextStatus);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to refresh billing");
    } finally {
      setRefreshing(false);
    }
  };

  const handleCheckout = async (planCode: BillingPlanCode) => {
    setActiveAction("checkout");
    setActionError(null);

    try {
      const response = await fetchJson<{ checkoutUrl: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planCode }),
      });

      window.location.href = response.checkoutUrl;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to start checkout");
    } finally {
      setActiveAction(null);
    }
  };

  const handlePortal = async () => {
    setActiveAction("portal");
    setActionError(null);

    try {
      const response = await fetchJson<{ portalUrl: string }>("/api/billing/portal", {
        method: "POST",
      });

      window.location.href = response.portalUrl;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to open billing portal");
    } finally {
      setActiveAction(null);
    }
  };

  const currentPlanLabel = status?.isPremium
    ? status.planCode === "yearly"
      ? "Yearly"
      : "Monthly"
    : "Free";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <section className="rounded-2xl border border-white/[0.08] bg-[#141414] p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              Live billing
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
              Manage your Creem subscription
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#a3a3a3]">
              Checkout, subscription status, and customer portal access are backed by Supabase and Creem.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-5 lg:min-w-72">
            <div className="flex items-center gap-2 text-sm text-[#a3a3a3]">
              <Crown className="h-4 w-4 text-cyan-400" />
              Current plan
            </div>
            <div className="mt-3 text-2xl font-semibold text-white">{currentPlanLabel}</div>
            <p className="mt-2 text-sm text-[#a3a3a3]">
              Status: {status?.subscriptionStatus || "unknown"}
            </p>
            <p className="mt-1 text-sm text-[#a3a3a3]">
              Period ends: {formatPeriodEnd(status?.currentPeriodEndDate || null)}
            </p>
          </div>
        </div>
      </section>

      {actionError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {actionError}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <PlanCard
          title="Free"
          price="$0"
          description="Track contracts and upgrade when you need reminder emails or CSV export."
          active={!status?.isPremium}
          ctaLabel="Current plan"
          onClick={() => undefined}
          disabled
          bullets={[
            "RLS-protected contract storage in Supabase",
            "Reminder limits enforced at the database layer",
            "No billing card required",
          ]}
        />

        {(pricing?.plans || []).map((plan) => (
          <PlanCard
            key={plan.planCode}
            title={plan.displayName}
            price={formatCurrency(plan.priceCents, plan.currency)}
            description={`Powered by live Creem product data for the ${plan.displayName.toLowerCase()} plan.`}
            active={status?.planCode === plan.planCode}
            ctaLabel={
              status?.planCode === plan.planCode ? "Current plan" : `Checkout ${plan.displayName}`
            }
            onClick={() => {
              if (status?.planCode !== plan.planCode) {
                void handleCheckout(plan.planCode);
              }
            }}
            disabled={activeAction === "checkout" || loading || status?.planCode === plan.planCode}
            bullets={[
              `Renews ${plan.billingPeriod.replace("every-", "")}`,
              plan.yearlySavingsPercent > 0
                ? `${plan.yearlySavingsPercent}% savings vs monthly`
                : "Baseline premium configuration",
              "Portal and webhook reconciliation stay server-side",
            ]}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#141414] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <RefreshCw className="h-4 w-4 text-cyan-400" />
            Subscription details
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshStatus}
              disabled={refreshing}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={handlePortal}
              disabled={activeAction === "portal" || !status?.isPremium}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
            >
              {activeAction === "portal" ? "Opening..." : "Open portal"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              label: "Feature gates",
              value: status?.isPremium ? "Premium enabled" : "Free tier limits active",
            },
            {
              label: "CSV export",
              value: status?.features.csvExport ? "Enabled" : "Disabled",
            },
            {
              label: "Reminder emails",
              value: status?.features.emailReminders ? "Enabled" : "Disabled",
            },
            {
              label: "Contracts limit",
              value:
                status?.usage.contractsLimit === null
                  ? "Unlimited"
                  : String(status?.usage.contractsLimit ?? "Unknown"),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/[0.08] bg-black/20 p-4"
            >
              <div className="text-xs uppercase tracking-wider text-[#a3a3a3]">{item.label}</div>
              <div className="mt-2 text-sm text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  title,
  price,
  description,
  bullets,
  active,
  ctaLabel,
  onClick,
  disabled,
}: {
  title: string;
  price: string;
  description: string;
  bullets: string[];
  active: boolean;
  ctaLabel: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-6 transition-colors ${
        active ? "border-cyan-500/40 bg-cyan-500/10" : "border-white/[0.08] bg-[#141414]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {active ? (
          <span className="rounded-full bg-cyan-500/20 px-2.5 py-1 text-xs font-medium text-cyan-300">
            Active
          </span>
        ) : null}
      </div>

      <div className="mt-4 text-3xl font-semibold text-white">{price}</div>
      <p className="mt-3 text-sm leading-6 text-[#a3a3a3]">{description}</p>

      <div className="mt-5 space-y-3">
        {bullets.map((bullet) => (
          <div key={bullet} className="flex items-start gap-3 text-sm text-[#cbd5e1]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400" />
            <span>{bullet}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors ${
          active || disabled
            ? "bg-white text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
            : "bg-cyan-600 text-white hover:bg-cyan-500"
        }`}
      >
        {ctaLabel}
      </button>
    </article>
  );
}
