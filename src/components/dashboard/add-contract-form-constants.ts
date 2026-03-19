// ============================================
// Add Contract Form Constants
// ============================================

export const STEPS = [
  { id: "basic", label: "Basic Info" },
  { id: "vendor", label: "Vendor & Terms" },
  { id: "reminders", label: "Reminders" },
];

export const CONTRACT_TYPES = [
  { value: "license", label: "Software License" },
  { value: "subscription", label: "Subscription" },
  { value: "service", label: "Service Agreement" },
  { value: "support", label: "Support Contract" },
];

export const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "CAD", label: "CAD ($)" },
];

export const REMINDER_OPTIONS = [
  { value: 60, label: "60 days before" },
  { value: 30, label: "30 days before" },
  { value: 14, label: "14 days before" },
  { value: 7, label: "7 days before" },
  { value: 3, label: "3 days before" },
  { value: 1, label: "1 day before" },
];
