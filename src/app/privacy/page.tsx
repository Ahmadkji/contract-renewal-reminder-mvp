import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_LAST_UPDATED, SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Renewly.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Legal</p>
          <h1 className="text-3xl font-semibold">Privacy Policy</h1>
          <p className="text-sm text-slate-300">
            This policy explains how Renewly collects, uses, and protects personal data.
          </p>
          <p className="text-xs text-slate-400">Last updated: {LEGAL_LAST_UPDATED}</p>
        </header>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">Data We Collect</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Account details such as name, email, and authentication metadata.</li>
            <li>Contract records, reminders, and settings you create in the app.</li>
            <li>Billing metadata needed to manage subscriptions and entitlement status.</li>
            <li>Basic security and operational logs for fraud prevention and reliability.</li>
          </ul>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">How We Use Data</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Provide contract tracking, reminders, exports, and account access.</li>
            <li>Process billing events, maintain subscription status, and support requests.</li>
            <li>Protect the service against abuse, fraud, and unauthorized access.</li>
            <li>Maintain service quality, uptime, and auditability.</li>
          </ul>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">Payments</h2>
          <p>
            Payments are processed by Creem as merchant of record. We only store the billing data needed
            to deliver subscription features and support. For purchase processing terms, review our{" "}
            <Link href="/terms" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2">
              Terms of Service
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">Data Sharing</h2>
          <p>
            We share data only with service providers needed to operate Renewly, such as hosting,
            authentication, email delivery, and billing infrastructure. We do not sell personal data.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">Data Retention</h2>
          <p>
            We retain data for as long as your account is active and as required for security, legal, and
            accounting obligations.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300">
          <h2 className="text-xl font-semibold text-slate-100">Contact</h2>
          <p>
            Privacy or account questions:{" "}
            <a className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2" href={SUPPORT_MAILTO}>
              {SUPPORT_EMAIL}
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
