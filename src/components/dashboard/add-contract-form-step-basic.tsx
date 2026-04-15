"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { Suspense } from "react";
import { FormField, Input, DatePicker } from "./form-inputs";
import type { ContractFormData } from "./add-contract-form-types";

interface BasicInfoStepProps {
  formData: ContractFormData;
  errors: Partial<Record<keyof ContractFormData, string>>;
  updateField: <K extends keyof ContractFormData>(
    field: K,
    value: ContractFormData[K]
  ) => void;
}

export function BasicInfoStep({
  formData,
  errors,
  updateField,
}: BasicInfoStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[#06b6d4]/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-[#06b6d4]" />
        </div>
        <div>
          <h3 className="text-base font-medium text-white">Basic Information</h3>
          <p className="text-sm text-white/50">Enter the contract details</p>
        </div>
      </div>

      <FormField label="Contract Name" required error={errors.name}>
        <Input
          placeholder="e.g., Microsoft 365 Enterprise"
          value={formData.name}
          onChange={(e) => updateField("name", e.target.value)}
          error={!!errors.name}
        />
      </FormField>

      <FormField label="Contract Type" required error={errors.type}>
        <Input
          placeholder="e.g., SaaS Subscription, MSA, Support Retainer"
          value={formData.type}
          onChange={(e) => updateField("type", e.target.value)}
          error={!!errors.type}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Start Date" required error={errors.startDate}>
          <Suspense fallback={<div className="h-10 bg-[#0a0a0a] border border-white/10 rounded-lg animate-pulse" />}>
            <DatePicker
              value={formData.startDate || undefined}
              onChange={(date) => updateField("startDate", date)}
              placeholder="Select start date"
              error={!!errors.startDate}
            />
          </Suspense>
        </FormField>

        <FormField label="End Date" required error={errors.endDate}>
          <Suspense fallback={<div className="h-10 bg-[#0a0a0a] border border-white/10 rounded-lg animate-pulse" />}>
            <DatePicker
              value={formData.endDate || undefined}
              onChange={(date) => updateField("endDate", date)}
              placeholder="Select end date"
              error={!!errors.endDate}
            />
          </Suspense>
        </FormField>
      </div>
    </div>
  );
}
