"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { FormField, Input, CurrencyInput, Toggle, Textarea, Select } from "./form-inputs";
import type { ContractFormData } from "./add-contract-form-types";
import { CURRENCIES } from "./add-contract-form-constants";

interface VendorStepProps {
  formData: ContractFormData;
  errors: Partial<Record<keyof ContractFormData, string>>;
  updateField: <K extends keyof ContractFormData>(
    field: K,
    value: ContractFormData[K]
  ) => void;
}

export function VendorStep({
  formData,
  errors,
  updateField,
}: VendorStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[#6366f1]/20 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-[#6366f1]" />
        </div>
        <div>
          <h3 className="text-base font-medium text-white">Vendor & Terms</h3>
          <p className="text-sm text-white/50">Who is this contract with?</p>
        </div>
      </div>

      <FormField label="Vendor Name" required error={errors.vendor}>
        <Input
          placeholder="e.g., Microsoft Corporation"
          value={formData.vendor}
          onChange={(e) => updateField("vendor", e.target.value)}
          error={!!errors.vendor}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <FormField label="Contract Value">
            <CurrencyInput
              value={formData.value}
              onChange={(value) => updateField("value", value)}
              placeholder="0.00"
            />
          </FormField>
        </div>

        <FormField label="Currency">
          <Select
            options={CURRENCIES}
            value={formData.currency}
            onChange={(value) => updateField("currency", value)}
          />
        </FormField>
      </div>

      <div className="pt-2">
        <Toggle
          checked={formData.autoRenew}
          onChange={(checked) => updateField("autoRenew", checked)}
          label="Auto-renewal"
          description="This contract automatically renews at the end of term"
        />
      </div>

      <FormField label="Renewal Terms" helper="Any special terms or conditions">
        <Textarea
          placeholder="e.g., 30-day notice required for cancellation..."
          value={formData.renewalTerms}
          onChange={(e) => updateField("renewalTerms", e.target.value)}
        />
      </FormField>
    </div>
  );
}
