"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SlideOverPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: "sm" | "md" | "lg" | "xl" | "full"
}

const widthClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-xl",
  xl: "max-w-2xl",
  full: "max-w-3xl",
}

export function SlideOverPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "lg",
}: SlideOverPanelProps) {
  // Close on escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false)
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open, onOpenChange])

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm backdrop-enter"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div
          className={cn(
            "w-screen slide-over-enter",
            widthClasses[width]
          )}
        >
          <div className="flex h-full flex-col bg-[#0a0a0a] border-l border-white/10 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                {description && (
                  <p className="mt-1 text-sm text-white/60">{description}</p>
                )}
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 dashboard-scroll">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-[#0a0a0a]">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Step indicator for multi-step forms
interface StepIndicatorProps {
  steps: { id: string; label: string }[]
  currentStep: number
  onStepClick?: (index: number) => void
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((step, index) => {
        const isActive = index === currentStep
        const isComplete = index < currentStep
        const isClickable = onStepClick && index <= currentStep

        return (
          <React.Fragment key={step.id}>
            {index > 0 && (
              <div
                className={cn(
                  "w-10 h-0.5 transition-colors duration-300",
                  isComplete ? "bg-[#22c55e]" : "bg-white/10"
                )}
              />
            )}
            <button
              onClick={() => isClickable && onStepClick?.(index)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-2 transition-all duration-200",
                isClickable && "cursor-pointer"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200",
                  isActive && "bg-[#06b6d4]/20 border-2 border-[#06b6d4] text-[#06b6d4]",
                  isComplete && "bg-[#22c55e] border-2 border-[#22c55e] text-white",
                  !isActive && !isComplete && "bg-white/5 border border-white/10 text-white/40"
                )}
              >
                {isComplete ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium transition-colors duration-200 hidden sm:block",
                  isActive && "text-white",
                  isComplete && "text-white/80",
                  !isActive && !isComplete && "text-white/40"
                )}
              >
                {step.label}
              </span>
            </button>
          </React.Fragment>
        )
      })}
    </div>
  )
}
