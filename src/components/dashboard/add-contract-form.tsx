"use client";

import * as React from "react";
import { SlideOverPanel } from "./slide-over-panel";
import { cn } from "@/lib/utils";
import {
  Bell,
  Check,
  ChevronDown,
  FileText,
  Loader2,
} from "lucide-react";
import { toast as toastFn } from "@/hooks/use-toast";
import type { ContractFormData } from "./add-contract-form-types";
import { initialFormData } from "./add-contract-form-types";
import { validateForm } from "./add-contract-form-validation";
import {
  CONTRACT_TYPES,
  CURRENCIES,
  REMINDER_OPTIONS,
} from "./add-contract-form-constants";
import {
  CurrencyInput,
  DatePicker,
  FormField,
  Input,
  Select,
  Textarea,
  Toggle,
} from "./form-inputs";

// ============================================
// Component Props
// ============================================
interface AddContractFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: ContractFormData) => Promise<void>;
  editData?: ContractFormData;
}

// ============================================
// Add Contract Form Component
// ============================================
export function AddContractForm({
  open,
  onOpenChange,
  onSubmit,
  editData,
}: AddContractFormProps) {
  const [formData, setFormData] = React.useState<ContractFormData>(
    editData || initialFormData
  );
  const [errors, setErrors] =
    React.useState<Partial<Record<keyof ContractFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [notesExpanded, setNotesExpanded] = React.useState(false);

  // Reset form when opening
  React.useEffect(() => {
    if (open) {
      const nextFormData = editData || initialFormData;
      setFormData(nextFormData);
      setErrors({});
      setNotesExpanded(Boolean(nextFormData.notes.trim()));
    }
  }, [open, editData]);

  // Update form field
  const updateField = <K extends keyof ContractFormData>(
    field: K,
    value: ContractFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is updated
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Submit
  const handleSubmit = async () => {
    const validation = validateForm(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      await onSubmit?.(formData);
      // Success toast is handled by useCreateContract mutation in layout.tsx
      onOpenChange(false);
    } catch (error) {
      // FIX #14: Add specific error handling for different error types
      let errorMessage = "Please try again.";
      let errorTitle = "Failed to create contract";
      const errorName = error instanceof Error ? error.name : "UnknownError";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        const normalizedMessage = errorMessage.toLowerCase();
        
        // Distinguish between error types for better UX
        if (errorMessage.includes('Authentication') || errorMessage.includes('Unauthorized')) {
          errorTitle = "Authentication required";
          errorMessage = "Please sign in and try again.";
        } else if (normalizedMessage.includes('free email reminder quota exhausted')) {
          errorTitle = "Free reminder limit reached";
          errorMessage =
            "Your free plan includes 5 reminder emails. Upgrade in Billing to continue reminder delivery.";
        } else if (
          normalizedMessage.includes('additional reminder recipients require an active premium subscription')
        ) {
          errorTitle = "Upgrade required";
          errorMessage =
            "Free reminder emails send only to your account email. Upgrade to add extra reminder recipients.";
        } else if (
          normalizedMessage.includes('premium subscription') ||
          normalizedMessage.includes('feature_requires_premium')
        ) {
          errorTitle = "Upgrade required";
          errorMessage =
            "Unlimited reminder emails and extra recipients are available on premium. Adjust reminder settings or upgrade in Billing.";
        } else if (errorMessage.includes('Validation') || errorMessage.includes('required')) {
          errorTitle = "Validation error";
          errorMessage = "Please check your form data and try again.";
        } else if (errorMessage.includes('vendor contact')) {
          errorTitle = "Vendor contact error";
          errorMessage = "Could not save vendor contact. Please check the email format.";
        } else if (normalizedMessage.includes('reminder')) {
          errorTitle = "Reminder error";
          // Preserve backend context instead of masking with a generic message.
          errorMessage = error.message;
        } else if (errorMessage.includes('database') || errorMessage.includes('constraint')) {
          errorTitle = "Database error";
          errorMessage = "A database error occurred. Please try again.";
        }
      }
      
      console.error('[Contract Form] Submission failed:', {
        errorName,
        errorTitle,
        errorMessage,
      });
      
      toastFn.error(errorTitle, errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle reminder day
  const toggleReminderDay = (day: number) => {
    const current = formData.reminderDays;
    if (current.includes(day)) {
      updateField("reminderDays", current.filter((d) => d !== day));
    } else {
      updateField(
        "reminderDays",
        [...current, day].sort((a, b) => b - a)
      );
    }
  };

  const hasNotes = Boolean(formData.notes.trim());

  return (
    <SlideOverPanel
      open={open}
      onOpenChange={onOpenChange}
      title={editData ? "Edit Contract" : "Add New Contract"}
      description="Add contract details below"
      width="2xl"
      footer={
        <>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 bg-[#22c55e] text-white text-sm font-medium rounded-lg hover:bg-[#16a34a] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {editData ? "Saving..." : "Creating..."}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {editData ? "Save Changes" : "Create Contract"}
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <SectionHeader
            icon={FileText}
            title="Core Details"
            description="Everything needed to create the contract"
          />

          <div className="space-y-4">
            <FormField label="Contract Name" required error={errors.name}>
              <Input
                placeholder="e.g., Microsoft 365 Enterprise"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                error={!!errors.name}
              />
            </FormField>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Contract Type" required>
                <Select
                  options={CONTRACT_TYPES}
                  value={formData.type}
                  onChange={(value) =>
                    updateField("type", value as ContractFormData["type"])
                  }
                />
              </FormField>

              <FormField label="Vendor Name" required error={errors.vendor}>
                <Input
                  placeholder="e.g., Microsoft Corporation"
                  value={formData.vendor}
                  onChange={(e) => updateField("vendor", e.target.value)}
                  error={!!errors.vendor}
                />
              </FormField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Contact Person">
                <Input
                  placeholder="e.g., John Smith"
                  value={formData.vendorContact}
                  onChange={(e) => updateField("vendorContact", e.target.value)}
                />
              </FormField>

              <FormField label="Contact Email" error={errors.vendorEmail}>
                <Input
                  type="email"
                  placeholder="e.g., john@vendor.com"
                  value={formData.vendorEmail}
                  onChange={(e) => updateField("vendorEmail", e.target.value)}
                  error={!!errors.vendorEmail}
                />
              </FormField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Start Date" required error={errors.startDate}>
                <DatePicker
                  value={formData.startDate || undefined}
                  onChange={(date) => updateField("startDate", date)}
                  placeholder="Select start date"
                  error={!!errors.startDate}
                />
              </FormField>

              <FormField label="End Date" required error={errors.endDate}>
                <DatePicker
                  value={formData.endDate || undefined}
                  onChange={(date) => updateField("endDate", date)}
                  placeholder="Select end date"
                  error={!!errors.endDate}
                />
              </FormField>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_180px_minmax(0,1fr)]">
              <FormField label="Contract Value">
                <CurrencyInput
                  value={formData.value}
                  onChange={(value) => updateField("value", value)}
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="Currency">
                <Select
                  options={CURRENCIES}
                  value={formData.currency}
                  onChange={(value) => updateField("currency", value)}
                />
              </FormField>

              <div className="rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3">
                <Toggle
                  checked={formData.autoRenew}
                  onChange={(checked) => updateField("autoRenew", checked)}
                  label="Auto-renewal"
                  description="Renews at end of term"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <SectionHeader
              icon={Bell}
              title="Reminders"
              description="Choose when the team should be notified"
              className="mb-0"
            />

            <div className="rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 xl:min-w-[260px]">
              <Toggle
                checked={formData.emailReminders}
                onChange={(checked) => updateField("emailReminders", checked)}
                label="Send email reminders"
                description="Notify stakeholders before expiry"
              />
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-3 block text-sm font-medium text-white/80">
                Reminder Schedule
              </label>
              <div className="flex flex-wrap gap-2">
                {REMINDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleReminderDay(option.value)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition-all duration-200",
                      formData.reminderDays.includes(option.value)
                        ? "border-[#06b6d4] bg-[#06b6d4]/20 text-[#06b6d4]"
                        : "border-white/10 bg-transparent text-white/60 hover:border-white/20"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {formData.emailReminders && (
              <FormField
                label="Additional Notification Emails"
                helper="The contract owner email is included automatically. Separate additional emails with commas."
              >
                <Input
                  placeholder="e.g., team@company.com, finance@company.com"
                  value={formData.notifyEmails.join(", ")}
                  onChange={(e) =>
                    updateField(
                      "notifyEmails",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                />
              </FormField>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setNotesExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">Notes</span>
                {hasNotes && (
                  <span className="rounded-full bg-[#06b6d4]/15 px-2 py-0.5 text-[11px] font-medium text-[#67e8f9]">
                    Added
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-white/50">
                Internal context, handoff notes, or renewal guidance
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-white/50 transition-transform duration-200",
                notesExpanded && "rotate-180"
              )}
            />
          </button>

          {notesExpanded && (
            <div className="border-t border-white/10 px-4 py-4 sm:px-5">
              <FormField label="Notes">
                <Textarea
                  placeholder="Add any notes or context..."
                  value={formData.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  className="min-h-[120px]"
                />
              </FormField>
            </div>
          )}
        </section>
      </div>
    </SlideOverPanel>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start gap-3", className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
        <Icon className="h-4 w-4 text-white/80" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/50">{description}</p>
      </div>
    </div>
  );
}
