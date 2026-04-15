"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

// ============================================
// Slide Over Panel
// ============================================
interface SlideOverPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: "sm" | "md" | "lg" | "xl" | "2xl"
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
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const widthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
    "2xl": "max-w-4xl",
  }

  if (!mounted) {
    return null
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm transition-all duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[130] mx-auto flex max-h-[92vh] w-full flex-col bg-[#0a0a0a] shadow-2xl transform-gpu transition-all duration-300 ease-out",
          "border-t border-white/10 rounded-t-2xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:w-[95vw]",
          widthClasses[width],
          open
            ? "translate-y-0 opacity-100 sm:-translate-y-1/2 sm:scale-100"
            : "translate-y-full opacity-0 pointer-events-none sm:-translate-y-[45%] sm:scale-95"
        )}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {description && (
              <p className="text-sm text-white/50">{description}</p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center gap-3 h-14 px-6 border-t border-white/10 bg-[#0a0a0a]">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body
  )
}

// ============================================
// Step Indicator
// ============================================
interface Step {
  id: string
  label: string
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (step: number) => void
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <button
            type="button"
            onClick={() => onStepClick?.(index)}
            disabled={index > currentStep}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
              index === currentStep
                ? "bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/30"
                : index < currentStep
                ? "bg-white/10 text-white border border-white/10"
                : "text-white/40 border border-transparent cursor-not-allowed"
            )}
          >
            <span
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-xs",
                index === currentStep
                  ? "bg-[#06b6d4] text-white"
                  : index < currentStep
                  ? "bg-[#22c55e] text-white"
                  : "bg-white/10 text-white/40"
              )}
            >
              {index < currentStep ? "✓" : index + 1}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </button>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "flex-1 h-px mx-2",
                index < currentStep ? "bg-[#06b6d4]/30" : "bg-white/10"
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
