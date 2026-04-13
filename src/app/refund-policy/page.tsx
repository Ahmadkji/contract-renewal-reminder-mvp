import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_LAST_UPDATED, SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Refund Policy for Doc Renewal subscriptions.",
};

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Legal</p>
          <h1 className="text-3xl font-semibold">Refund Policy</h1>
          <p className="text-sm text-slate-300">
            This policy explains how refund requests are handled for Doc Renewal paid plans.
          </p>
          <p className="text-xs text-slate-400">Last updated: {LEGAL_LAST_UPDATED}</p>
        </header>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">How to Request a Refund</h2>
          <p>
            Send your request to{" "}
            <a className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2" href={SUPPORT_MAILTO}>
              {SUPPORT_EMAIL}
            </a>{" "}
            with your account email and purchase details so we can identify the transaction.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">Response Timeline</h2>
          <p>
            We respond to billing and refund requests within 3 business days. If extra information is needed,
            we will reply with follow-up questions and keep you updated.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">How Refunds Are Processed</h2>
          <p>
            Doc Renewal uses Creem as merchant of record. Approved refunds are processed through Creem and
            returned to the original payment method according to network and bank timelines.
          </p>
          <p>
            You can also manage billing and cancellations directly in your dashboard from{" "}
            <Link
              href="/dashboard/billing"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
            >
              Billing Settings
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">Additional Notes</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Chargebacks may result in additional review and account limitations.</li>
            <li>Fraudulent or abusive refund patterns may lead to service suspension.</li>
            <li>For full service terms, review the Terms of Service page.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
