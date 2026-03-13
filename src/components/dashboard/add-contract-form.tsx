"use client"

import * as React from "react"
import { SlideOverPanel, StepIndicator } from "./slide-over-panel"
import { FormField, Input, Textarea, Select, DatePicker, CurrencyInput, Toggle, ColorPicker } from "./form-inputs"
import { cn } from "@/lib/utils"
import { FileText, Building2, Bell, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"
import { toast as toastFn } from "@/hooks/use-toast"

// ============================================
// Types
// ============================================
export interface ContractFormData {
  // Step 1: Basic Info
  name: string
  type: "license" | "service" | "support" | "subscription"
  startDate: Date | null
  endDate: Date | null
  
  // Step 2: Vendor & Terms
  vendor: string
  vendorContact: string
  vendorEmail: string
  value: number
  currency: string
  autoRenew: boolean
  renewalTerms: string
  
  // Step 3: Reminders & Notes
  reminderDays: number[]
  emailReminders: boolean
  notifyEmails: string[]
  notes: string
  tags: string[]
  color: string
}

const initialFormData: ContractFormData = {
  name: "",
  type: "subscription",
  startDate: null,
  endDate: null,
  vendor: "",
  vendorContact: "",
  vendorEmail: "",
  value: 0,
  currency: "USD",
  autoRenew: false,
  renewalTerms: "",
  reminderDays: [30, 14, 7],
  emailReminders: true,
  notifyEmails: [],
  notes: "",
  tags: [],
  color: "#06b6d4",
}

const STEPS = [
  { id: "basic", label: "Basic Info" },
  { id: "vendor", label: "Vendor & Terms" },
  { id: "reminders", label: "Reminders" },
]

const CONTRACT_TYPES = [
  { value: "license", label: "Software License" },
  { value: "subscription", label: "Subscription" },
  { value: "service", label: "Service Agreement" },
  { value: "support", label: "Support Contract" },
]

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "CAD", label: "CAD ($)" },
]

const REMINDER_OPTIONS = [
  { value: 60, label: "60 days before" },
  { value: 30, label: "30 days before" },
  { value: 14, label: "14 days before" },
  { value: 7, label: "7 days before" },
  { value: 3, label: "3 days before" },
  { value: 1, label: "1 day before" },
]

// ============================================
// Component
// ============================================
interface AddContractFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (data: ContractFormData) => Promise<void>
  editData?: ContractFormData
}

export function AddContractForm({ open, onOpenChange, onSubmit, editData }: AddContractFormProps) {
  const [currentStep, setCurrentStep] = React.useState(0)
  const [formData, setFormData] = React.useState<ContractFormData>(editData || initialFormData)
  const [errors, setErrors] = React.useState<Partial<Record<keyof ContractFormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [direction, setDirection] = React.useState<"forward" | "backward">("forward")

  // Reset form when opening
  React.useEffect(() => {
    if (open) {
      setFormData(editData || initialFormData)
      setCurrentStep(0)
      setErrors({})
    }
  }, [open, editData])

  // Update form field
  const updateField = <K extends keyof ContractFormData>(field: K, value: ContractFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // Validate current step
  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof ContractFormData, string>> = {}

    if (step === 0) {
      if (!formData.name.trim()) newErrors.name = "Contract name is required"
      if (!formData.startDate) newErrors.startDate = "Start date is required"
      if (!formData.endDate) newErrors.endDate = "End date is required"
      if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
        newErrors.endDate = "End date must be after start date"
      }
    } else if (step === 1) {
      if (!formData.vendor.trim()) newErrors.vendor = "Vendor name is required"
      if (formData.vendorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.vendorEmail)) {
        newErrors.vendorEmail = "Invalid email format"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Navigation
  const goToStep = (step: number) => {
    if (step < currentStep || validateStep(currentStep)) {
      setDirection(step > currentStep ? "forward" : "backward")
      setCurrentStep(step)
    }
  }

  const goNext = () => {
    if (currentStep < STEPS.length - 1 && validateStep(currentStep)) {
      setDirection("forward")
      setCurrentStep(prev => prev + 1)
    }
  }

  const goBack = () => {
    if (currentStep > 0) {
      setDirection("backward")
      setCurrentStep(prev => prev - 1)
    }
  }

  // Submit
  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return

    setIsSubmitting(true)
    try {
      await onSubmit?.(formData)
      toastFn.success("Contract created", `"${formData.name}" has been added to your contracts.`)
      onOpenChange(false)
    } catch (error) {
      toastFn.error("Failed to create contract", "Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle reminder day
  const toggleReminderDay = (day: number) => {
    const current = formData.reminderDays
    if (current.includes(day)) {
      updateField("reminderDays", current.filter(d => d !== day))
    } else {
      updateField("reminderDays", [...current, day].sort((a, b) => b - a))
    }
  }

  // Render step content
  const renderStepContent = () => {
    const content = (() => {
      switch (currentStep) {
        case 0:
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

              <FormField label="Contract Type" required>
                <Select
                  options={CONTRACT_TYPES}
                  value={formData.type}
                  onChange={(value) => updateField("type", value as ContractFormData["type"])}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
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

              <FormField label="Color Tag" helper="Choose a color to identify this contract">
                <ColorPicker
                  value={formData.color}
                  onChange={(color) => updateField("color", color)}
                />
              </FormField>
            </div>
          )

        case 1:
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
          )

        case 2:
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
                  helper="Separate multiple emails with commas"
                >
                  <Input
                    placeholder="e.g., team@company.com, finance@company.com"
                    value={formData.notifyEmails.join(", ")}
                    onChange={(e) => updateField("notifyEmails", 
                      e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                    )}
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
          )

        default:
          return null
      }
    })()

    return (
      <div
        key={currentStep}
        className={cn(
          "form-step-enter",
          direction === "backward" && "[animation-direction:reverse]"
        )}
      >
        {content}
      </div>
    )
  }

  return (
    <SlideOverPanel
      open={open}
      onOpenChange={onOpenChange}
      title={editData ? "Edit Contract" : "Add New Contract"}
      description="Fill in the contract details below"
      width="lg"
      footer={
        <>
          {currentStep > 0 && (
            <button
              type="button"
              onClick={goBack}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-2 px-5 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-[#22c55e] text-white text-sm font-medium rounded-lg hover:bg-[#16a34a] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Contract
                </>
              )}
            </button>
          )}
        </>
      }
    >
      <StepIndicator steps={STEPS} currentStep={currentStep} onStepClick={goToStep} />
      {renderStepContent()}
    </SlideOverPanel>
  )
}
