#!/usr/bin/env node

const crypto = require("crypto");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.test", override: false });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_TEST_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars for DB audit.");
  console.error(
    "Required: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_TEST_URL), NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_TEST_SERVICE_ROLE_KEY)."
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const createdUsers = [];
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function formatError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  return error.message || JSON.stringify(error);
}

function userClientFromToken(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function createTempUser(label) {
  const nonce = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const email = `dbqa+${label}-${nonce}@example.com`;
  const password = `DbQa!${crypto.randomBytes(8).toString("hex")}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { db_qa: true, label },
  });
  if (createErr || !created?.user?.id) {
    throw new Error(`createUser failed (${label}): ${formatError(createErr)}`);
  }

  const userId = created.user.id;
  createdUsers.push(userId);

  const { data: loginData, error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !loginData?.session?.access_token) {
    throw new Error(`signInWithPassword failed (${label}): ${formatError(signInErr)}`);
  }

  return {
    id: userId,
    email,
    client: userClientFromToken(loginData.session.access_token),
  };
}

async function runTest(name, fn) {
  try {
    await fn();
    passCount += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failCount += 1;
    console.error(`FAIL ${name}`);
    console.error(`  ${formatError(error)}`);
  }
}

function basePayload(userId, overrides = {}) {
  return {
    p_user_id: userId,
    p_name: "QA Contract Alpha",
    p_vendor: "QA Vendor",
    p_type: "service",
    p_start_date: "2030-01-01",
    p_end_date: "2030-12-31",
    p_value: 1999.5,
    p_currency: "USD",
    p_auto_renew: true,
    p_renewal_terms: "Annual renewal",
    p_notes: "Database QA run",
    p_tags: ["qa", "db"],
    p_vendor_contact: "QA Contact",
    p_vendor_email: "qa-contact@example.com",
    p_reminder_days: [30, 7, 7],
    p_email_reminders: true,
    p_notify_emails: [],
    ...overrides,
  };
}

async function getReminderRows(client, contractId) {
  const { data, error } = await client
    .from("reminders")
    .select("id, contract_id, days_before, sent_at, processing_claim_token, processing_claimed_at")
    .eq("contract_id", contractId)
    .order("days_before", { ascending: true });
  if (error) throw new Error(`fetch reminders failed: ${formatError(error)}`);
  return data || [];
}

async function main() {
  console.log("Starting professional database audit...");

  const userA = await createTempUser("a");
  const userB = await createTempUser("b");

  let contractAId = null;
  let claimContractId = null;
  let claimReminderId = null;
  const claimRef = "2030-01-21T10:00:00.000Z";
  const claimToken = `claim-${crypto.randomBytes(6).toString("hex")}`;

  await runTest("schema access: core tables readable by service role", async () => {
    const contractCols = "id,user_id,name,vendor,type,start_date,end_date,email_reminders,created_at,updated_at";
    const reminderCols =
      "id,contract_id,days_before,notify_emails,sent_at,processing_claimed_at,processing_claim_token,created_at";
    const vendorCols = "id,contract_id,contact_name,email,created_at";
    const profileCols = "id,user_id,timezone,email_notifications,created_at,updated_at";
    const eventCols = "id,user_id,contract_id,reminder_id,billing_tier,sent_at,created_at";

    const checks = await Promise.all([
      admin.from("contracts").select(contractCols).limit(1),
      admin.from("reminders").select(reminderCols).limit(1),
      admin.from("vendor_contacts").select(vendorCols).limit(1),
      admin.from("profiles").select(profileCols).limit(1),
      admin.from("email_reminder_send_events").select(eventCols).limit(1),
    ]);

    checks.forEach((result, idx) => {
      if (result.error) {
        throw new Error(`schema check ${idx + 1} failed: ${formatError(result.error)}`);
      }
    });
  });

  await runTest("create contract via atomic RPC", async () => {
    const { data, error } = await userA.client.rpc(
      "create_contract_with_relations",
      basePayload(userA.id)
    );
    if (error || !data) throw new Error(`create rpc failed: ${formatError(error)}`);
    contractAId = data;
    assert(typeof contractAId === "string", "expected UUID contract id");
  });

  await runTest("duplicate submission dedupe returns same contract id", async () => {
    const { data, error } = await userA.client.rpc(
      "create_contract_with_relations",
      basePayload(userA.id)
    );
    if (error || !data) throw new Error(`duplicate create rpc failed: ${formatError(error)}`);
    assert(data === contractAId, "expected duplicate submit to return existing contract id");
  });

  await runTest("reminder days are deduped and persisted correctly", async () => {
    const rows = await getReminderRows(userA.client, contractAId);
    assert(rows.length === 2, `expected 2 reminders, got ${rows.length}`);
    const days = rows.map((r) => r.days_before).join(",");
    assert(days === "7,30", `expected reminder days 7,30 got ${days}`);
  });

  await runTest("RLS blocks cross-tenant read", async () => {
    const { data, error } = await userB.client
      .from("contracts")
      .select("id,user_id")
      .eq("id", contractAId)
      .maybeSingle();
    if (error) throw new Error(`unexpected read error: ${formatError(error)}`);
    assert(!data, "user B should not read user A contract");
  });

  await runTest("RLS blocks cross-tenant update/delete", async () => {
    const update = await userB.client
      .from("contracts")
      .update({ name: "Hacked Name" })
      .eq("id", contractAId)
      .select("id");
    if (update.error) throw new Error(`unexpected update error: ${formatError(update.error)}`);
    assert((update.data || []).length === 0, "user B should not update user A rows");

    const del = await userB.client.from("contracts").delete().eq("id", contractAId).select("id");
    if (del.error) throw new Error(`unexpected delete error: ${formatError(del.error)}`);
    assert((del.data || []).length === 0, "user B should not delete user A rows");
  });

  await runTest("RPC rejects user mismatch attempts", async () => {
    const { error } = await userA.client.rpc(
      "create_contract_with_relations",
      basePayload(userB.id, { p_name: "Mismatch Attempt" })
    );
    assert(error, "expected error for user mismatch");
    assert(
      /user mismatch/i.test(formatError(error)),
      `unexpected mismatch error: ${formatError(error)}`
    );
  });

  await runTest("constraint: invalid contract type rejected", async () => {
    const { error } = await userA.client.rpc(
      "create_contract_with_relations",
      basePayload(userA.id, { p_name: "Invalid Type", p_type: "invalid_type" })
    );
    assert(error, "expected type check failure");
  });

  await runTest("constraint: end_date must be after start_date", async () => {
    const { error } = await userA.client.rpc(
      "create_contract_with_relations",
      basePayload(userA.id, {
        p_name: "Invalid Dates",
        p_start_date: "2030-01-10",
        p_end_date: "2030-01-10",
      })
    );
    assert(error, "expected date validation failure");
    assert(
      /end date must be after start date/i.test(formatError(error)),
      `unexpected date error: ${formatError(error)}`
    );
  });

  await runTest("constraint: reminders.days_before > 0", async () => {
    const { error } = await admin.from("reminders").insert({
      contract_id: contractAId,
      days_before: 0,
      notify_emails: [],
    });
    assert(error, "expected check-constraint failure for days_before");
  });

  await runTest("constraint: unique_contract_reminder prevents duplicates", async () => {
    const { error } = await admin.from("reminders").insert({
      contract_id: contractAId,
      days_before: 7,
      notify_emails: [],
    });
    assert(error, "expected unique constraint failure for duplicate reminder day");
  });

  await runTest("cascade delete removes child reminder/contact rows", async () => {
    const { data: tempContractId, error: createError } = await userA.client.rpc(
      "create_contract_with_relations",
      basePayload(userA.id, {
        p_name: "Cascade Target",
        p_end_date: "2031-12-31",
        p_vendor_contact: "Cascade Contact",
        p_vendor_email: "cascade@example.com",
        p_reminder_days: [14],
      })
    );
    if (createError || !tempContractId) {
      throw new Error(`failed to create cascade target: ${formatError(createError)}`);
    }

    const beforeReminders = await admin
      .from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", tempContractId);
    const beforeContacts = await admin
      .from("vendor_contacts")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", tempContractId);
    if (beforeReminders.error || beforeContacts.error) {
      throw new Error("failed to fetch child counts before delete");
    }

    assert((beforeReminders.count || 0) > 0, "expected reminder row before delete");
    assert((beforeContacts.count || 0) > 0, "expected vendor contact row before delete");

    const deleted = await admin.from("contracts").delete().eq("id", tempContractId);
    if (deleted.error) throw new Error(`delete failed: ${formatError(deleted.error)}`);

    const afterReminders = await admin
      .from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", tempContractId);
    const afterContacts = await admin
      .from("vendor_contacts")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", tempContractId);
    if (afterReminders.error || afterContacts.error) {
      throw new Error("failed to fetch child counts after delete");
    }

    assert((afterReminders.count || 0) === 0, "reminders should be deleted by cascade");
    assert((afterContacts.count || 0) === 0, "vendor_contacts should be deleted by cascade");
  });

  await runTest("service-only RPCs are blocked for authenticated users", async () => {
    const claimAttempt = await userA.client.rpc("claim_due_email_reminders", {
      p_reference_time: claimRef,
      p_limit: 1,
      p_claim_token: "blocked-claim",
      p_claim_timeout_seconds: 900,
    });
    assert(claimAttempt.error, "authenticated user should not call claim_due_email_reminders");

    const completeAttempt = await userA.client.rpc("complete_email_reminder_delivery", {
      p_reminder_id: crypto.randomUUID(),
      p_claim_token: "blocked-complete",
      p_delivery_tier: "free_trial",
    });
    assert(
      completeAttempt.error,
      "authenticated user should not call complete_email_reminder_delivery"
    );
  });

  await runTest("claim_due_email_reminders is idempotent with claim token", async () => {
    const claimPayload = basePayload(userA.id, {
      p_name: "Claim Flow Contract",
      p_start_date: "2029-01-01",
      p_end_date: "2030-01-31",
      p_reminder_days: [10],
      p_vendor_contact: null,
      p_vendor_email: null,
      p_notify_emails: [],
      p_email_reminders: true,
    });

    const { data: createdId, error: createErr } = await userA.client.rpc(
      "create_contract_with_relations",
      claimPayload
    );
    if (createErr || !createdId) {
      throw new Error(`failed creating claim contract: ${formatError(createErr)}`);
    }
    claimContractId = createdId;

    const reminders = await getReminderRows(userA.client, claimContractId);
    assert(reminders.length === 1, "expected one reminder for claim test");
    claimReminderId = reminders[0].id;

    const firstClaim = await admin.rpc("claim_due_email_reminders", {
      p_reference_time: claimRef,
      p_limit: 10,
      p_claim_token: claimToken,
      p_claim_timeout_seconds: 900,
    });
    if (firstClaim.error) throw new Error(`first claim failed: ${formatError(firstClaim.error)}`);
    const firstRows = firstClaim.data || [];
    assert(
      firstRows.some((row) => row.reminder_id === claimReminderId),
      "expected first claim to include test reminder"
    );

    const secondClaim = await admin.rpc("claim_due_email_reminders", {
      p_reference_time: claimRef,
      p_limit: 10,
      p_claim_token: `${claimToken}-second`,
      p_claim_timeout_seconds: 900,
    });
    if (secondClaim.error) throw new Error(`second claim failed: ${formatError(secondClaim.error)}`);
    const secondRows = secondClaim.data || [];
    assert(
      !secondRows.some((row) => row.reminder_id === claimReminderId),
      "same reminder should not be re-claimed while active claim exists"
    );
  });

  await runTest("complete delivery is one-shot and sent_at becomes immutable", async () => {
    assert(claimReminderId, "claim reminder id missing");

    const complete = await admin.rpc("complete_email_reminder_delivery", {
      p_reminder_id: claimReminderId,
      p_claim_token: claimToken,
      p_delivery_tier: "free_trial",
      p_sent_at: "2030-01-21T10:01:00.000Z",
    });
    if (complete.error) throw new Error(`complete delivery failed: ${formatError(complete.error)}`);

    const doubleComplete = await admin.rpc("complete_email_reminder_delivery", {
      p_reminder_id: claimReminderId,
      p_claim_token: claimToken,
      p_delivery_tier: "free_trial",
      p_sent_at: "2030-01-21T10:02:00.000Z",
    });
    assert(doubleComplete.error, "second complete call should fail");

    const mutateSentAt = await admin
      .from("reminders")
      .update({ sent_at: "2030-01-22T00:00:00.000Z" })
      .eq("id", claimReminderId);
    assert(mutateSentAt.error, "sent_at update should be blocked by immutability trigger");
  });

  await runTest("send-event uniqueness prevents duplicate reminder delivery records", async () => {
    assert(claimReminderId, "claim reminder id missing");
    assert(claimContractId, "claim contract id missing");

    const dupInsert = await admin.from("email_reminder_send_events").insert({
      user_id: userA.id,
      contract_id: claimContractId,
      reminder_id: claimReminderId,
      billing_tier: "free_trial",
    });
    assert(dupInsert.error, "expected unique constraint violation on reminder_id");
  });

  await runTest("anon client cannot access tenant contract data", async () => {
    const result = await anon.from("contracts").select("id").eq("id", contractAId).limit(1);
    if (result.error) {
      return;
    }
    assert((result.data || []).length === 0, "anon should never read protected contract rows");
  });

  await runTest("contracts pagination RPC executes successfully", async () => {
    const response = await userA.client.rpc("get_contracts_page_payload", {
      p_user_id: userA.id,
      p_page: 1,
      p_limit: 20,
      p_search: null,
      p_upcoming: false,
      p_count_mode: "planned",
    });
    if (response.error) {
      throw new Error(`get_contracts_page_payload failed: ${formatError(response.error)}`);
    }
    assert(response.data && typeof response.data === "object", "expected JSON response payload");
  });

  console.log("");
  console.log("Database audit completed.");
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    failCount += 1;
    console.error(`FATAL ${formatError(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const userId of createdUsers) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        // best-effort cleanup
      }
    }
  });
