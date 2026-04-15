"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

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
  features: string[];
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

const FREE_PLAN_BULLETS = [
  "Track up to 5 contracts",
  "Send up to 5 reminder emails total",
  "Use reminder schedules with one recipient",
  "Upgrade any time to unlock unlimited usage",
];

const PREMIUM_BASE_BENEFITS = [
  "Remove free-plan limits with unlimited contracts",
  "Send unlimited renewal reminder emails",
  "Add additional reminder recipients",
  "Export contracts to CSV",
  "Manage plan and payment method in billing portal",
];

const PLAN_SPECIFIC_BENEFITS: Record<BillingPlanCode, string[]> = {
  monthly: ["Month-to-month billing flexibility"],
  yearly: ["Everything in Monthly", "Lower effective monthly cost with annual billing"],
};

function dedupeBenefits(benefits: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const benefit of benefits) {
    const normalized = benefit.trim();
    if (!normalized) {
      continue;
    }

    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    result.push(normalized);
  }

  return result;
}

function getPlanBullets(plan: BillingPlan): string[] {
  const savingsBenefit =
    plan.planCode === "yearly" && plan.yearlySavingsPercent > 0
      ? [`Save ${plan.yearlySavingsPercent}% vs monthly billing`]
      : [];

  return dedupeBenefits([
    ...plan.features,
    ...PREMIUM_BASE_BENEFITS,
    ...PLAN_SPECIFIC_BENEFITS[plan.planCode],
    ...savingsBenefit,
  ]);
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"checkout" | null>(null);

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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {actionError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {actionError}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <PlanCard
          title="Free"
          price="$0"
          description="Get started with core tracking and a limited reminder quota before upgrading."
          active={!status?.isPremium}
          ctaLabel="Current plan"
          onClick={() => undefined}
          disabled
          bullets={FREE_PLAN_BULLETS}
        />

        {(pricing?.plans || []).map((plan) => (
          <PlanCard
            key={plan.planCode}
            title={plan.displayName}
            price={formatCurrency(plan.priceCents, plan.currency)}
            description={
              plan.planCode === "yearly"
                ? "All premium features with annual billing savings."
                : "All premium features with monthly billing flexibility."
            }
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
            bullets={getPlanBullets(plan)}
          />
        ))}
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
