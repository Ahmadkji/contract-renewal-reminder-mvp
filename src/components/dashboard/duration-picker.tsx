"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Calendar, ChevronRight, Plus, Clock } from "lucide-react"

// ============================================
// Types
// ============================================
interface DurationPickerProps {
  startDate: Date | null
  endDate: Date | null
  onStartDateChange: (date: Date) => void
  onEndDateChange: (date: Date) => void
  error?: string
  onExtend?: (days: number) => void
}

interface DurationDisplay {
  years: number
  months: number
  days: number
  totalDays: number
}

// ============================================
// Utility Functions
// ============================================
function calculateDuration(start: Date, end: Date): DurationDisplay {
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const years = Math.floor(totalDays / 365)
  const remainingAfterYears = totalDays % 365
  const months = Math.floor(remainingAfterYears / 30)
  const days = remainingAfterYears % 30
  
  return { years, months, days, totalDays }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  })
}

function formatCompactDate(date: Date): string {
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric" 
  })
}

// ============================================
// Component
// ============================================
export function DurationPicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  error,
  onExtend,
}: DurationPickerProps) {
  const [isDragging, setIsDragging] = React.useState<"start" | "end" | null>(null)
  const [showStartPicker, setShowStartPicker] = React.useState(false)
  const [showEndPicker, setShowEndPicker] = React.useState(false)
  const [showQuickActions, setShowQuickActions] = React.useState(false)
  const barRef = React.useRef<HTMLDivElement>(null)
  
  // Calculate duration if both dates exist
  const duration = startDate && endDate 
    ? calculateDuration(startDate, endDate)
    : null

  // Calculate progress percentage for the bar
  const getProgress = () => {
    if (!startDate || !endDate) return 0
    const now = new Date()
    const total = endDate.getTime() - startDate.getTime()
    const elapsed = now.getTime() - startDate.getTime()
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  }

  // Handle drag interactions
  const handleMouseDown = (type: "start" | "end") => {
    setIsDragging(type)
  }

  const handleMouseUp = () => {
    setIsDragging(null)
  }

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || !startDate || !endDate) return
    
    const rect = barRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    
    // Calculate new date based on click position
    const totalTime = endDate.getTime() - startDate.getTime()
    const newTime = startDate.getTime() + (totalTime * percentage)
    const newDate = new Date(newTime)
    
    // Determine if closer to start or end
    const distToStart = Math.abs(newDate.getTime() - startDate.getTime())
    const distToEnd = Math.abs(newDate.getTime() - endDate.getTime())
    
    if (distToStart < distToEnd) {
      onStartDateChange(newDate)
    } else {
      onEndDateChange(newDate)
    }
  }

  // Extend end date
  const handleExtend = (days: number) => {
    if (endDate) {
      const newDate = new Date(endDate)
      newDate.setDate(newDate.getDate() + days)
      onEndDateChange(newDate)
      onExtend?.(days)
    }
  }

  // Show quick actions when hovering over bar
  const handleMouseEnter = () => setShowQuickActions(true)
  const handleMouseLeave = () => setShowQuickActions(false)

  return (
    <div className="space-y-4">
      {/* Duration Bar */}
      <div className="relative">
        {/* Timeline Bar */}
        <div
          ref={barRef}
          className={cn(
            "relative h-3 bg-[#1a1a1a] rounded-full cursor-pointer",
            "transition-all duration-200",
            isDragging && "ring-2 ring-[#06b6d4]/50"
          )}
          onClick={handleBarClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Progress Fill */}
          <div
            className="absolute inset-y-0 left-0 bg-[#06b6d4]/30 rounded-full"
            style={{ width: `${getProgress()}%` }}
          />
          
          {/* Start Handle */}
          {startDate && (
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-[#06b6d4] rounded-full cursor-ew-resize",
                "shadow-lg shadow-[#06b6d4]/30 transition-transform duration-150",
                "hover:scale-110 active:scale-95",
                isDragging === "start" && "scale-110 ring-2 ring-white"
              )}
              style={{ left: 0 }}
              onMouseDown={(e) => {
                e.stopPropagation()
                handleMouseDown("start")
              }}
              onMouseUp={handleMouseUp}
              onClick={(e) => {
                e.stopPropagation()
                setShowStartPicker(!showStartPicker)
              }}
            />
          )}

          {/* End Handle */}
          {endDate && (
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-[#06b6d4] rounded-full cursor-ew-resize",
                "shadow-lg shadow-[#06b6d4]/30 transition-transform duration-150",
                "hover:scale-110 active:scale-95",
                isDragging === "end" && "scale-110 ring-2 ring-white"
              )}
              style={{ right: 0 }}
              onMouseDown={(e) => {
                e.stopPropagation()
                handleMouseDown("end")
              }}
              onMouseUp={handleMouseUp}
              onClick={(e) => {
                e.stopPropagation()
                setShowEndPicker(!showEndPicker)
              }}
            />
          )}
        </div>

        {/* Date Labels */}
        <div className="flex justify-between mt-3">
          <button
            type="button"
            onClick={() => setShowStartPicker(!showStartPicker)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all",
              "hover:bg-white/5",
              startDate ? "text-white" : "text-white/40"
            )}
          >
            <Calendar className="w-4 h-4" />
            <span>{startDate ? formatCompactDate(startDate) : "Start"}</span>
          </button>

          {duration && (
            <div className="flex items-center gap-1 text-xs text-white/50">
              <Clock className="w-3 h-3" />
              <span>
                {duration.years > 0 && `${duration.years}y `}
                {duration.months > 0 && `${duration.months}m `}
                {duration.days}d
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowEndPicker(!showEndPicker)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all",
              "hover:bg-white/5",
              endDate ? "text-white" : "text-white/40"
            )}
          >
            <span>{endDate ? formatCompactDate(endDate) : "End"}</span>
            <Calendar className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Actions - Appear on hover */}
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 top-full mt-2 flex gap-2",
            "transition-all duration-200",
            showQuickActions || isDragging 
              ? "opacity-100 translate-y-0" 
              : "opacity-0 -translate-y-2 pointer-events-none"
          )}
        >
          <button
            type="button"
            onClick={() => handleExtend(30)}
            disabled={!endDate}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] border border-white/10",
              "rounded-lg text-xs text-white/70 hover:text-white hover:border-white/20",
              "transition-all duration-150",
              !endDate && "opacity-50 cursor-not-allowed"
            )}
          >
            <Plus className="w-3 h-3" />
            Extend 30 days
          </button>
          <button
            type="button"
            onClick={() => setShowEndPicker(true)}
            disabled={!startDate}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] border border-white/10",
              "rounded-lg text-xs text-white/70 hover:text-white hover:border-white/20",
              "transition-all duration-150",
              !startDate && "opacity-50 cursor-not-allowed"
            )}
          >
            <Calendar className="w-3 h-3" />
            Set exact date
          </button>
        </div>

        {/* Date Pickers - Start */}
        {showStartPicker && startDate && (
          <div className="absolute top-full left-0 mt-2 z-20">
            <MiniDatePicker
              value={startDate}
              onChange={(date) => {
                onStartDateChange(date)
                if (endDate && date >= endDate) {
                  // Auto-adjust end date
                  const newEnd = new Date(date)
                  newEnd.setFullYear(newEnd.getFullYear() + 1)
                  onEndDateChange(newEnd)
                }
              }}
              onClose={() => setShowStartPicker(false)}
              minDate={new Date()}
            />
          </div>
        )}

        {/* Date Pickers - End */}
        {showEndPicker && endDate && (
          <div className="absolute top-full right-0 mt-2 z-20">
            <MiniDatePicker
              value={endDate}
              onChange={onEndDateChange}
              onClose={() => setShowEndPicker(false)}
              minDate={startDate || new Date()}
            />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-xs text-[#ef4444] animate-shake">{error}</p>
      )}

      {/* Duration Summary */}
      {duration && (
        <div className="flex items-center gap-4 text-xs text-white/50">
          <span>{formatDate(startDate!)}</span>
          <ChevronRight className="w-3 h-3" />
          <span>{formatDate(endDate!)}</span>
        </div>
      )}
    </div>
  )
}

// ============================================
// Mini Date Picker Component
// ============================================
interface MiniDatePickerProps {
  value: Date
  onChange: (date: Date) => void
  onClose: () => void
  minDate?: Date
}

function MiniDatePicker({ value, onChange, onClose, minDate }: MiniDatePickerProps) {
  const [viewDate, setViewDate] = React.useState(value)
  const pickerRef = React.useRef<HTMLDivElement>(null)

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay()
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }

  const selectDate = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    if (minDate && newDate < minDate) return
    onChange(newDate)
    onClose()
  }

  const isSelected = (day: number) => {
    return (
      value.getDate() === day &&
      value.getMonth() === viewDate.getMonth() &&
      value.getFullYear() === viewDate.getFullYear()
    )
  }

  const isDisabled = (day: number) => {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    return minDate && date < minDate
  }

  return (
    <div
      ref={pickerRef}
      className="bg-[#141414] border border-white/10 rounded-xl shadow-xl p-3 w-64 animate-in fade-in-0 slide-in-from-top-2 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 text-white/60 hover:text-white transition-colors"
        >
          ←
        </button>
        <span className="text-sm font-medium text-white">
          {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 text-white/60 hover:text-white transition-colors"
        >
          →
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((day) => (
          <div key={day} className="w-8 h-6 text-center text-xs text-white/40">
            {day}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="w-8 h-8" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const disabled = isDisabled(day)
          return (
            <button
              key={day}
              type="button"
              onClick={() => selectDate(day)}
              disabled={disabled}
              className={cn(
                "w-8 h-8 text-sm rounded flex items-center justify-center transition-colors",
                disabled && "text-white/20 cursor-not-allowed",
                !disabled && !isSelected(day) && "text-white/80 hover:bg-white/5",
                isSelected(day) && "bg-[#06b6d4] text-white"
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default DurationPicker