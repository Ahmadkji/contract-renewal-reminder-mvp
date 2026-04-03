import { randomUUID } from 'node:crypto';
import { isValidEmail } from '@/lib/email/email-validator';
import { serverEnv as env } from '@/lib/env/server';
import { logger } from '@/lib/logger';
import { getFormattedFromAddress } from '@/lib/resend';
import type { SendEmailResult } from '@/types/email';
import type { CreateEmailOptions, CreateEmailRequestOptions } from 'resend';

export interface ReminderProcessorOptions {
  dryRun?: boolean;
  limit?: number;
  runAt?: Date;
  claimTimeoutSeconds?: number;
  maxConcurrentSends?: number;
}

export interface ReminderProcessorItemResult {
  reminderId: string;
  contractId: string;
  contractName: string;
  recipients: string[];
  deliveryTier: 'free_trial' | 'premium';
  status: 'dry_run' | 'sent' | 'skipped' | 'failed';
  error?: string;
}

export interface ReminderProcessorResult {
  runAt: string;
  dryRun: boolean;
  dueCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  processedCount: number;
  results: ReminderProcessorItemResult[];
}

export interface DueReminderRecord {
  reminder_id: string;
  contract_id: string;
  user_id: string;
  contract_name: string;
  vendor: string;
  end_date: string;
  days_before: number;
  notify_emails: string[] | null;
  timezone: string | null;
  delivery_tier: 'free_trial' | 'premium';
}

type ReminderRpcResponse = PromiseLike<{ data: unknown; error: { message: string } | null }>;
type ReminderMutationResponse = PromiseLike<{ error: { message: string } | null }>;

interface ReminderUpdateBuilder extends ReminderMutationResponse {
  eq(column: string, value: string | null): ReminderUpdateBuilder;
  in(column: string, values: string[]): ReminderUpdateBuilder;
  is(column: string, value: null): ReminderUpdateBuilder;
  not(column: string, operator: string, value: string | null): ReminderUpdateBuilder;
  lte(column: string, value: string): ReminderUpdateBuilder;
}

export interface ReminderAdminClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): ReminderRpcResponse;
  from(table: 'reminders'): {
    update(values: {
      sent_at?: string | null;
      processing_claimed_at?: string | null;
      processing_claim_token?: string | null;
    }): ReminderUpdateBuilder;
  };
  auth: {
    admin: {
      getUserById(userId: string): Promise<{
        data: { user: { email?: string | null } | null };
        error: { message: string } | null;
      }>;
    };
  };
}

export interface ReminderProcessorRuntime {
  adminClient: ReminderAdminClient;
  sendEmail: (
    data: CreateEmailOptions,
    maxRetries?: number,
    options?: CreateEmailRequestOptions
  ) => Promise<SendEmailResult>;
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return 100;
  }

  return Math.max(1, Math.min(500, Math.trunc(limit as number)));
}

function clampClaimTimeoutSeconds(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 900;
  }

  return Math.max(60, Math.min(3600, Math.trunc(value as number)));
}

function clampMaxConcurrentSends(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 3;
  }

  return Math.max(1, Math.min(20, Math.trunc(value as number)));
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function normalizeNotifyEmails(value: string[] | null | undefined): string[] {
  return Array.from(
    new Set((value || []).map((email) => email.trim()).filter(Boolean))
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getDashboardUrl(): string {
  return `${env.NEXT_PUBLIC_APP_URL}/dashboard/contracts`;
}

function buildReminderEmail(reminder: DueReminderRecord, recipients: string[]): CreateEmailOptions {
  const dashboardUrl = getDashboardUrl();
  const contractName = escapeHtml(reminder.contract_name);
  const vendor = escapeHtml(reminder.vendor);
  const renewalDate = escapeHtml(reminder.end_date);
  const previewText = `${reminder.contract_name} renews in ${reminder.days_before} day${reminder.days_before === 1 ? '' : 's'}.`;
  const subject = `Reminder: ${reminder.contract_name} renews in ${reminder.days_before} day${reminder.days_before === 1 ? '' : 's'}`;
  const text = [
    previewText,
    '',
    `Vendor: ${reminder.vendor}`,
    `Renewal date: ${reminder.end_date}`,
    `Scheduled reminder: ${reminder.days_before} days before renewal`,
    '',
    `Review contract: ${dashboardUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #111827; line-height: 1.6;">
      <p style="font-size: 14px; color: #6b7280; margin-bottom: 24px;">${escapeHtml(previewText)}</p>
      <h1 style="font-size: 24px; margin-bottom: 16px;">${contractName}</h1>
      <p style="margin: 0 0 12px;">Your scheduled renewal reminder is due now.</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0 0 8px;"><strong>Vendor:</strong> ${vendor}</p>
        <p style="margin: 0 0 8px;"><strong>Renewal date:</strong> ${renewalDate}</p>
        <p style="margin: 0;"><strong>Reminder schedule:</strong> ${reminder.days_before} days before renewal</p>
      </div>
      <p style="margin: 0 0 24px;">Open your contracts dashboard to review the renewal details and next steps.</p>
      <a
        href="${dashboardUrl}"
        style="display: inline-block; background: #0891b2; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600;"
      >
        Open dashboard
      </a>
    </div>
  `.trim();

  return {
    from: getFormattedFromAddress(),
    to: recipients,
    subject,
    text,
    html,
    tags: [
      { name: 'type', value: 'contract-reminder' },
      { name: 'contract_id', value: reminder.contract_id },
      { name: 'reminder_id', value: reminder.reminder_id },
    ],
  };
}

async function resolvePrimaryEmails(
  admin: ReminderAdminClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const userEmailMap = new Map<string, string>();

  for (const userIdChunk of chunk(userIds, 10)) {
    const results = await Promise.all(
      userIdChunk.map(async (userId) => {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        return {
          userId,
          email: data.user?.email ?? null,
          error,
        };
      })
    );

    results.forEach((result) => {
      if (result.error) {
        logger.warn('[ReminderProcessor] Failed to resolve auth user email', {
          context: 'ReminderProcessor',
          userId: result.userId,
          error: result.error.message,
        });
        return;
      }

      if (result.email) {
        userEmailMap.set(result.userId, result.email);
      }
    });
  }

  return userEmailMap;
}

function getRecipients(reminder: DueReminderRecord, primaryEmail: string | undefined): string[] {
  return Array.from(
    new Set(
      [primaryEmail, ...normalizeNotifyEmails(reminder.notify_emails)]
        .filter((email): email is string => Boolean(email))
        .map((email) => email.trim())
        .filter((email) => isValidEmail(email))
    )
  );
}

async function updateClaimedReminder(
  adminClient: ReminderAdminClient,
  reminderId: string,
  claimToken: string,
  values: {
    sent_at?: string | null;
    processing_claimed_at?: string | null;
    processing_claim_token?: string | null;
  }
) {
  const { error } = await adminClient
    .from('reminders')
    .update(values)
    .eq('id', reminderId)
    .eq('processing_claim_token', claimToken);

  if (error) {
    throw new Error(`Failed to update reminder ${reminderId}: ${error.message}`);
  }
}

async function completeClaimedReminderDelivery(
  adminClient: ReminderAdminClient,
  reminderId: string,
  claimToken: string,
  deliveryTier: DueReminderRecord['delivery_tier'],
  sentAtIso: string
) {
  const { error } = await adminClient.rpc('complete_email_reminder_delivery', {
    p_reminder_id: reminderId,
    p_claim_token: claimToken,
    p_delivery_tier: deliveryTier,
    p_sent_at: sentAtIso,
  });

  if (error) {
    throw new Error(`Failed to finalize reminder ${reminderId}: ${error.message}`);
  }
}

async function releaseStaleClaims(
  adminClient: ReminderAdminClient,
  runAt: Date,
  claimTimeoutSeconds: number
) {
  const staleBeforeIso = new Date(runAt.getTime() - claimTimeoutSeconds * 1000).toISOString();

  const { error } = await adminClient
    .from('reminders')
    .update({
      processing_claimed_at: null,
      processing_claim_token: null,
    })
    .is('sent_at', null)
    .not('processing_claimed_at', 'is', null)
    .lte('processing_claimed_at', staleBeforeIso);

  if (error) {
    throw new Error(`Failed to release stale reminder claims: ${error.message}`);
  }
}

export async function runReminderProcessor(
  runtime: ReminderProcessorRuntime,
  options: ReminderProcessorOptions = {}
): Promise<ReminderProcessorResult> {
  const runAt = options.runAt ?? new Date();
  const dryRun = options.dryRun ?? false;
  const limit = clampLimit(options.limit);
  const claimTimeoutSeconds = clampClaimTimeoutSeconds(options.claimTimeoutSeconds);
  const maxConcurrentSends = clampMaxConcurrentSends(options.maxConcurrentSends);
  const claimToken = randomUUID();

  if (!dryRun) {
    await releaseStaleClaims(runtime.adminClient, runAt, claimTimeoutSeconds);
  }

  const { data, error } = await runtime.adminClient.rpc(
    dryRun ? 'get_due_email_reminders' : 'claim_due_email_reminders',
    dryRun
      ? {
          p_reference_time: runAt.toISOString(),
          p_limit: limit,
          p_claim_timeout_seconds: claimTimeoutSeconds,
        }
      : {
          p_reference_time: runAt.toISOString(),
          p_limit: limit,
          p_claim_token: claimToken,
          p_claim_timeout_seconds: claimTimeoutSeconds,
        }
  );

  if (error) {
    throw new Error(`Failed to load due reminders: ${error.message}`);
  }

  const dueReminders = ((data || []) as DueReminderRecord[]).map((reminder) => ({
    ...reminder,
    notify_emails: normalizeNotifyEmails(reminder.notify_emails),
  }));

  const userIds = Array.from(new Set(dueReminders.map((reminder) => reminder.user_id)));
  const userEmailMap = await resolvePrimaryEmails(runtime.adminClient, userIds);
  const results: ReminderProcessorItemResult[] = [];

  async function processReminder(reminder: DueReminderRecord): Promise<ReminderProcessorItemResult> {
    const recipients = getRecipients(reminder, userEmailMap.get(reminder.user_id));

    if (recipients.length === 0) {
      if (!dryRun) {
        logger.warn('[ReminderProcessor] Skipping reminder with no valid recipients', {
          context: 'ReminderProcessor',
          reminderId: reminder.reminder_id,
          contractId: reminder.contract_id,
          userId: reminder.user_id,
        });

        await updateClaimedReminder(runtime.adminClient, reminder.reminder_id, claimToken, {
          sent_at: null,
          // Keep claim timestamp so retries are delayed by claim timeout.
          processing_claimed_at: runAt.toISOString(),
          processing_claim_token: null,
        });
      }

      return {
        reminderId: reminder.reminder_id,
        contractId: reminder.contract_id,
        contractName: reminder.contract_name,
        recipients,
        deliveryTier: reminder.delivery_tier,
        status: 'skipped',
        error: 'No valid recipients resolved for reminder',
      };
    }

    if (dryRun) {
      return {
        reminderId: reminder.reminder_id,
        contractId: reminder.contract_id,
        contractName: reminder.contract_name,
        recipients,
        deliveryTier: reminder.delivery_tier,
        status: 'dry_run',
      };
    }

    const email = buildReminderEmail(reminder, recipients);
    const sendResult = await runtime.sendEmail(email, undefined, {
      idempotencyKey: `contract-reminder:${reminder.reminder_id}`,
    });

    if (!sendResult.success) {
      logger.warn('[ReminderProcessor] Email send failed', {
        context: 'ReminderProcessor',
        reminderId: reminder.reminder_id,
        contractId: reminder.contract_id,
        userId: reminder.user_id,
        error: sendResult.error || 'Unknown Resend error',
      });

      await updateClaimedReminder(runtime.adminClient, reminder.reminder_id, claimToken, {
        sent_at: null,
        // Keep claim timestamp so retries are delayed by claim timeout.
        processing_claimed_at: runAt.toISOString(),
        processing_claim_token: null,
      });

      return {
        reminderId: reminder.reminder_id,
        contractId: reminder.contract_id,
        contractName: reminder.contract_name,
        recipients,
        deliveryTier: reminder.delivery_tier,
        status: 'failed',
        error: sendResult.error || 'Unknown Resend error',
      };
    }

    await completeClaimedReminderDelivery(
      runtime.adminClient,
      reminder.reminder_id,
      claimToken,
      reminder.delivery_tier,
      runAt.toISOString()
    );

    return {
      reminderId: reminder.reminder_id,
      contractId: reminder.contract_id,
      contractName: reminder.contract_name,
      recipients,
      deliveryTier: reminder.delivery_tier,
      status: 'sent',
    };
  }

  for (const reminderChunk of chunk(dueReminders, maxConcurrentSends)) {
    const chunkResults = await Promise.all(
      reminderChunk.map((reminder) => processReminder(reminder))
    );
    results.push(...chunkResults);
  }

  const sentCount = results.filter((result) => result.status === 'sent').length;
  const skippedCount = results.filter((result) => result.status === 'skipped').length;
  const failedCount = results.filter((result) => result.status === 'failed').length;

  return {
    runAt: runAt.toISOString(),
    dryRun,
    dueCount: dueReminders.length,
    sentCount,
    skippedCount,
    failedCount,
    processedCount: results.length,
    results,
  };
}
