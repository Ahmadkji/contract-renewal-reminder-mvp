import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_LAST_UPDATED, SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Renewly.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Legal</p>
          <h1 className="text-3xl font-semibold">Terms of Service</h1>
          <p className="text-sm text-slate-300">
            These terms govern use of Renewly&apos;s contract renewal tracking platform.
          </p>
          <p className="text-xs text-slate-400">Last updated: {LEGAL_LAST_UPDATED}</p>
        </header>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">1. Service</h2>
          <p>
            Renewly helps teams track contracts, renewal timelines, reminders, and billing status. You are
            responsible for the information you upload and for managing access to your account.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">2. Billing and Subscriptions</h2>
          <p>
            Paid plans are offered as monthly or yearly subscriptions. You can manage or cancel your
            subscription from the billing area in your dashboard.
          </p>
          <p>
            Payments are processed by Creem as merchant of record. By completing checkout, you agree that
            Creem processes payment and invoicing for purchases.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">3. Refunds</h2>
          <p>
            Refund handling follows our{" "}
            <Link
              href="/refund-policy"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
            >
              Refund Policy
            </Link>
            . We review requests in good faith and provide responses through support.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">4. Acceptable Use</h2>
          <p>
            You may not use Renewly for illegal, fraudulent, abusive, or deceptive activity. We can suspend
            access if misuse creates security or compliance risk.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">5. Support</h2>
          <p>
            For account, billing, or product support contact{" "}
            <a className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2" href={SUPPORT_MAILTO}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">6. Privacy</h2>
          <p>
            Our collection and use of personal data is described in the{" "}
            <Link
              href="/privacy"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
