"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle, Info, AlertCircle, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type ConfirmVariant = "danger" | "warning" | "info" | "success"

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  onConfirm: () => void
  onCancel?: () => void
  loading?: boolean
}

const variantConfig = {
  danger: {
    icon: AlertCircle,
    iconColor: "text-[#ef4444]",
    iconBg: "bg-[#ef4444]/15",
    confirmClass: "bg-[#ef4444] hover:bg-[#dc2626] text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-[#eab308]",
    iconBg: "bg-[#eab308]/15",
    confirmClass: "bg-[#eab308] hover:bg-[#ca8a04] text-black",
  },
  info: {
    icon: Info,
    iconColor: "text-[#3b82f6]",
    iconBg: "bg-[#3b82f6]/15",
    confirmClass: "bg-[#3b82f6] hover:bg-[#2563eb] text-white",
  },
  success: {
    icon: CheckCircle,
    iconColor: "text-[#22c55e]",
    iconBg: "bg-[#22c55e]/15",
    confirmClass: "bg-[#22c55e] hover:bg-[#16a34a] text-white",
  },
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmationDialogProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#141414] border-white/10 text-white max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0", config.iconBg)}>
              <Icon className={cn("w-6 h-6", config.iconColor)} />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-lg font-semibold text-white mb-2">
                {title}
              </AlertDialogTitle>
              {description && (
                <AlertDialogDescription className="text-sm text-white/70">
                  {description}
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex gap-3 sm:justify-end">
          <AlertDialogCancel 
            onClick={handleCancel}
            className="bg-transparent border border-white/10 text-white hover:bg-white/5 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              config.confirmClass,
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Hook for easier usage
export function useConfirmationDialog() {
  const [state, setState] = React.useState<{
    open: boolean
    config: Omit<ConfirmationDialogProps, "open" | "onOpenChange" | "onConfirm">
    resolve: ((value: boolean) => void) | null
  }>({
    open: false,
    config: {
      title: "",
      description: "",
    },
    resolve: null,
  })

  const confirm = React.useCallback(
    (config: Omit<ConfirmationDialogProps, "open" | "onOpenChange" | "onConfirm">): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          open: true,
          config,
          resolve,
        })
      })
    },
    []
  )

  const handleConfirm = React.useCallback(() => {
    state.resolve?.(true)
    setState((prev) => ({ ...prev, open: false, resolve: null }))
  }, [state.resolve])

  const handleCancel = React.useCallback(() => {
    state.resolve?.(false)
    setState((prev) => ({ ...prev, open: false, resolve: null }))
  }, [state.resolve])

  const dialog = React.useMemo(
    () => (
      <ConfirmationDialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) handleCancel()
        }}
        {...state.config}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [state, handleConfirm, handleCancel]
  )

  return { confirm, dialog }
}
