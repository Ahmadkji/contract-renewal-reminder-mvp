"use client";

import * as React from "react";
import { SlideOverPanel, StepIndicator } from "./slide-over-panel";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast as toastFn } from "@/hooks/use-toast";
import type { ContractFormData } from "./add-contract-form-types";
import { initialFormData } from "./add-contract-form-types";
import { STEPS } from "./add-contract-form-constants";
import { validateStep } from "./add-contract-form-validation";
import { BasicInfoStep } from "./add-contract-form-step-basic";
import { VendorStep } from "./add-contract-form-step-vendor";
import { RemindersStep } from "./add-contract-form-step-reminders";

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
  const [currentStep, setCurrentStep] = React.useState(0);
  const [formData, setFormData] = React.useState<ContractFormData>(
    editData || initialFormData
  );
  const [errors, setErrors] =
    React.useState<Partial<Record<keyof ContractFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [direction, setDirection] = React.useState<"forward" | "backward">("forward");

  // Reset form when opening
  React.useEffect(() => {
    if (open) {
      setFormData(editData || initialFormData);
      setCurrentStep(0);
      setErrors({});
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

  // Navigation
  const goToStep = (step: number) => {
    if (step < currentStep || validateStep(currentStep, formData).valid) {
      setDirection(step > currentStep ? "forward" : "backward");
      setCurrentStep(step);
    }
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1 && validateStep(currentStep, formData).valid) {
      setDirection("forward");
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setDirection("backward");
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Submit
  const handleSubmit = async () => {
    if (!validateStep(currentStep, formData).valid) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit?.(formData);
      toastFn.success(
        "Contract created",
        `"${formData.name}" has been added to your contracts.`
      );
      onOpenChange(false);
    } catch (error) {
      // FIX #14: Add specific error handling for different error types
      let errorMessage = "Please try again.";
      let errorTitle = "Failed to create contract";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Distinguish between error types for better UX
        if (errorMessage.includes('Authentication') || errorMessage.includes('Unauthorized')) {
          errorTitle = "Authentication required";
          errorMessage = "Please sign in and try again.";
        } else if (errorMessage.includes('Validation') || errorMessage.includes('required')) {
          errorTitle = "Validation error";
          errorMessage = "Please check your form data and try again.";
        } else if (errorMessage.includes('vendor contact')) {
          errorTitle = "Vendor contact error";
          errorMessage = "Could not save vendor contact. Please check the email format.";
        } else if (errorMessage.includes('reminders')) {
          errorTitle = "Reminder error";
          errorMessage = "Could not save reminders. Please try again.";
        } else if (errorMessage.includes('database') || errorMessage.includes('constraint')) {
          errorTitle = "Database error";
          errorMessage = "A database error occurred. Please try again.";
        }
      }
      
      console.error('[Contract Creation] Error:', {
        error,
        errorTitle,
        errorMessage,
        formData
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

  // Render step content
  const renderStepContent = () => {
    const content = (() => {
      switch (currentStep) {
        case 0:
          return (
            <BasicInfoStep
              formData={formData}
              errors={errors}
              updateField={updateField}
            />
          );
        case 1:
          return (
            <VendorStep
              formData={formData}
              errors={errors}
              updateField={updateField}
            />
          );
        case 2:
          return (
            <RemindersStep
              formData={formData}
              updateField={updateField}
              toggleReminderDay={toggleReminderDay}
            />
          );
        default:
          return null;
      }
    })();

    return (
      <div
        key={currentStep}
        className={`form-step-enter ${
          direction === "backward" ? "[animation-direction:reverse]" : ""
        }`}
      >
        {content}
      </div>
    );
  };

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
  );
}
