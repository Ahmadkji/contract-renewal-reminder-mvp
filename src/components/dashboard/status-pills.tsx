"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// ============================================
// Types
// ============================================
export type ContractStatus = "active" | "expiring" | "expired" | "archive"

interface StatusPillsProps {
  value: ContractStatus
  onChange: (status: ContractStatus) => void
  disabled?: boolean
  className?: string
}

// ============================================
// Configuration
// ============================================
const STATUS_CONFIG: Record<ContractStatus, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  description: string
}> = {
  active: {
    label: "Active",
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "rgba(34, 197, 94, 0.3)",
    description: "Contract is currently active",
  },
  expiring: {
    label: "Expiring",
    color: "#eab308",
    bgColor: "rgba(234, 179, 8, 0.15)",
    borderColor: "rgba(234, 179, 8, 0.3)",
    description: "Contract expires within 30 days",
  },
  expired: {
    label: "Expired",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    description: "Contract has expired",
  },
  archive: {
    label: "Archive",
    color: "#737373",
    bgColor: "rgba(115, 115, 115, 0.15)",
    borderColor: "rgba(115, 115, 115, 0.3)",
    description: "Contract has been archived",
  },
}

// ============================================
// Component
// ============================================
export function StatusPills({
  value,
  onChange,
  disabled,
  className,
}: StatusPillsProps) {
  const statuses: ContractStatus[] = ["active", "expiring", "expired", "archive"]

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => {
          const config = STATUS_CONFIG[status]
          const isActive = value === status

          return (
            <button
              key={status}
              type="button"
              disabled={disabled}
              onClick={() => onChange(status)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-lg",
                "border transition-all duration-150 ease-out",
                "hover:scale-[1.02] active:scale-[0.98]",
                isActive
                  ? "border-transparent"
                  : "border-white/10 bg-transparent hover:border-white/20",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              style={{
                backgroundColor: isActive ? config.bgColor : "transparent",
              }}
            >
              {/* Status Dot */}
              <span
                className={cn(
                  "w-2 h-2 rounded-full transition-transform duration-150",
                  isActive && "animate-pulse"
                )}
                style={{ backgroundColor: config.color }}
              />
              
              {/* Label */}
              <span
                className="text-sm font-medium whitespace-nowrap"
                style={{ color: isActive ? config.color : "rgba(255, 255, 255, 0.6)" }}
              >
                {config.label}
              </span>

              {/* Active Indicator Line */}
              {isActive && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5"
                  style={{ backgroundColor: config.color }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Description */}
      <p className="text-xs text-white/50 min-h-[16px]">
        {STATUS_CONFIG[value].description}
      </p>
    </div>
  )
}

// ============================================
// Compact Version (for inline use)
// ============================================
interface CompactStatusPillsProps {
  value: ContractStatus
  onChange?: (status: ContractStatus) => void
  className?: string
}

export function CompactStatusPills({
  value,
  onChange,
  className,
}: CompactStatusPillsProps) {
  const statuses: ContractStatus[] = ["active", "expiring", "expired", "archive"]

  return (
    <div className={cn("inline-flex gap-1", className)}>
      {statuses.map((status) => {
        const config = STATUS_CONFIG[status]
        const isActive = value === status

        return (
          <button
            key={status}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(status)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md",
              "text-xs font-medium transition-all duration-150",
              isActive
                ? "bg-white/10"
                : "hover:bg-white/5",
              !onChange && "cursor-default"
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            <span style={{ color: isActive ? config.color : "rgba(255, 255, 255, 0.5)" }}>
              {config.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================
// Status Badge (Read-only)
// ============================================
interface StatusBadgeProps {
  status: ContractStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
        "text-xs font-medium border",
        className
      )}
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
        color: config.color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  )
}

// ============================================
// Utility: Get Status Config
// ============================================
export function getStatusConfig(status: ContractStatus) {
  return STATUS_CONFIG[status]
}

export default StatusPills