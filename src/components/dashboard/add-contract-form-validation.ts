import type { ContractFormData } from "./add-contract-form-types";

// ============================================
// Form Validation Utilities
// ============================================

export function validateForm(
  formData: ContractFormData
): { valid: boolean; errors: Partial<Record<keyof ContractFormData, string>> } {
  const errors: Partial<Record<keyof ContractFormData, string>> = {};

  if (!formData.name.trim()) {
    errors.name = "Contract name is required";
  }
  if (!formData.startDate) {
    errors.startDate = "Start date is required";
  }
  if (!formData.endDate) {
    errors.endDate = "End date is required";
  }
  if (
    formData.startDate &&
    formData.endDate &&
    formData.startDate >= formData.endDate
  ) {
    errors.endDate = "End date must be after start date";
  }

  if (!formData.vendor.trim()) {
    errors.vendor = "Vendor name is required";
  }
  if (
    formData.vendorEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.vendorEmail)
  ) {
    errors.vendorEmail = "Invalid email format";
  }

  const hasVendorContact = Boolean(formData.vendorContact.trim());
  const hasVendorEmail = Boolean(formData.vendorEmail.trim());
  if (hasVendorContact !== hasVendorEmail) {
    const message = "Contact person and contact email must be provided together";
    errors.vendorContact = message;
    errors.vendorEmail = message;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
