import { emailService } from '@/lib/email/email-service';
import { createAdminClient } from '@/lib/supabase/server';
import {
  runReminderProcessor,
  type ReminderAdminClient,
  type ReminderProcessorOptions as ReminderProcessorCoreOptions,
  type ReminderProcessorResult,
} from './reminder-processor-core';

export interface ReminderProcessorOptions extends ReminderProcessorCoreOptions {
  adminClient?: ReminderAdminClient;
  sendEmail?: Parameters<typeof runReminderProcessor>[0]['sendEmail'];
}

export type {
  DueReminderRecord,
  ReminderAdminClient,
  ReminderProcessorItemResult,
  ReminderProcessorResult,
} from './reminder-processor-core';

export async function processDueEmailReminders(
  options: ReminderProcessorOptions = {}
): Promise<ReminderProcessorResult> {
  const adminClient = (options.adminClient ?? createAdminClient()) as ReminderAdminClient;
  const sendEmail = options.sendEmail ?? emailService.sendWithRetry.bind(emailService);

  return runReminderProcessor(
    {
      adminClient,
      sendEmail,
    },
    options
  );
}
