"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { FormField, Input, Toggle, Textarea } from "./form-inputs";
import type { ContractFormData } from "./add-contract-form-types";
import { REMINDER_OPTIONS } from "./add-contract-form-constants";
import { cn } from "@/lib/utils";

interface RemindersStepProps {
  formData: ContractFormData;
  updateField: <K extends keyof ContractFormData>(
    field: K,
    value: ContractFormData[K]
  ) => void;
  toggleReminderDay: (day: number) => void;
}

export function RemindersStep({
  formData,
  updateField,
  toggleReminderDay,
}: RemindersStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[#22c55e]/20 flex items-center justify-center">
          <Bell className="w-5 h-5 text-[#22c55e]" />
        </div>
        <div>
          <h3 className="text-base font-medium text-white">Reminders & Notes</h3>
          <p className="text-sm text-white/50">Set up your renewal reminders</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white/80 mb-3">
          Reminder Schedule
        </label>
        <div className="flex flex-wrap gap-2">
          {REMINDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleReminderDay(option.value)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg border transition-all duration-200",
                formData.reminderDays.includes(option.value)
                  ? "bg-[#06b6d4]/20 border-[#06b6d4] text-[#06b6d4]"
                  : "bg-transparent border-white/10 text-white/60 hover:border-white/20"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2">
        <Toggle
          checked={formData.emailReminders}
          onChange={(checked) => updateField("emailReminders", checked)}
          label="Send email reminders"
          description="Receive email notifications before contract expires"
        />
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
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
              )
            }
          />
        </FormField>
      )}

      <FormField label="Notes" helper="Any additional notes about this contract">
        <Textarea
          placeholder="Add any notes or context..."
          value={formData.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          className="min-h-[120px]"
        />
      </FormField>
    </div>
  );
}
