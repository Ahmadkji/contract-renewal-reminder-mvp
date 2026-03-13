"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Calendar, ChevronDown } from "lucide-react"

// ============================================
// Form Field Wrapper
// ============================================
interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  helper?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, required, error, helper, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="block text-sm font-medium text-white/80">
        {label}
        {required && <span className="text-[#ef4444] ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-[#ef4444]">{error}</p>
      )}
      {helper && !error && (
        <p className="text-xs text-white/50">{helper}</p>
      )}
    </div>
  )
}

// ============================================
// Text Input
// ============================================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  icon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
            {icon}
          </div>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "w-full h-10 px-3 bg-[#0a0a0a] border rounded-lg text-white text-sm transition-all duration-200",
            "placeholder:text-white/30",
            "hover:border-white/20",
            "focus:outline-none focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20",
            error ? "border-[#ef4444]" : "border-white/10",
            icon && "pl-10",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
Input.displayName = "Input"

// ============================================
// Textarea
// ============================================
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full min-h-[100px] px-3 py-3 bg-[#0a0a0a] border rounded-lg text-white text-sm transition-all duration-200 resize-y",
          "placeholder:text-white/30",
          "hover:border-white/20",
          "focus:outline-none focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20",
          error ? "border-[#ef4444]" : "border-white/10",
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

// ============================================
// Select Dropdown
// ============================================
interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  error?: boolean
  disabled?: boolean
  className?: string
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select...",
  error,
  disabled,
  className,
}: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const selectRef = React.useRef<HTMLDivElement>(null)

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div ref={selectRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "w-full h-10 px-3 bg-[#0a0a0a] border rounded-lg text-sm text-left flex items-center justify-between transition-all duration-200",
          "hover:border-white/20",
          "focus:outline-none focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20",
          error ? "border-[#ef4444]" : "border-white/10",
          disabled && "opacity-50 cursor-not-allowed",
          !selectedOption && "text-white/40"
        )}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown className={cn(
          "w-4 h-4 text-white/40 transition-transform duration-200",
          open && "transform rotate-180"
        )} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-[#141414] border border-white/10 rounded-lg shadow-xl overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange?.(option.value)
                  setOpen(false)
                }}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left hover:bg-white/5 transition-colors",
                  option.value === value ? "text-[#06b6d4] bg-[#06b6d4]/10" : "text-white"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Date Picker
// ============================================
interface DatePickerProps {
  value?: Date
  onChange?: (date: Date) => void
  placeholder?: string
  error?: boolean
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  error,
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [viewDate, setViewDate] = React.useState(value || new Date())
  const pickerRef = React.useRef<HTMLDivElement>(null)

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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
    onChange?.(newDate)
    setOpen(false)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      today.getDate() === day &&
      today.getMonth() === viewDate.getMonth() &&
      today.getFullYear() === viewDate.getFullYear()
    )
  }

  const isSelected = (day: number) => {
    if (!value) return false
    return (
      value.getDate() === day &&
      value.getMonth() === viewDate.getMonth() &&
      value.getFullYear() === viewDate.getFullYear()
    )
  }

  return (
    <div ref={pickerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "w-full h-10 px-3 bg-[#0a0a0a] border rounded-lg text-sm text-left flex items-center justify-between transition-all duration-200",
          "hover:border-white/20",
          "focus:outline-none focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20",
          error ? "border-[#ef4444]" : "border-white/10",
          disabled && "opacity-50 cursor-not-allowed",
          !value && "text-white/40"
        )}
      >
        <span>{value ? formatDate(value) : placeholder}</span>
        <Calendar className="w-4 h-4 text-white/40" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-[#141414] border border-white/10 rounded-lg shadow-xl p-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 text-white/60 hover:text-white"
            >
              ←
            </button>
            <span className="text-sm font-medium text-white">
              {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 text-white/60 hover:text-white"
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
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={cn(
                    "w-8 h-8 text-sm rounded flex items-center justify-center transition-colors",
                    isSelected(day)
                      ? "bg-[#06b6d4] text-white"
                      : isToday(day)
                      ? "bg-white/10 text-white"
                      : "text-white/80 hover:bg-white/5"
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Currency Input
// ============================================
interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: number
  onChange?: (value: number) => void
  error?: boolean
}

export function CurrencyInput({ value, onChange, error, className, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState(
    value ? value.toLocaleString() : ""
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, "")
    const numValue = parseFloat(rawValue) || 0
    setDisplayValue(rawValue)
    onChange?.(numValue)
  }

  return (
    <div className={cn("relative", className)}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        className={cn(
          "w-full h-10 pl-7 pr-3 bg-[#0a0a0a] border rounded-lg text-white text-sm transition-all duration-200",
          "placeholder:text-white/30",
          "hover:border-white/20",
          "focus:outline-none focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20",
          error ? "border-[#ef4444]" : "border-white/10"
        )}
        {...props}
      />
    </div>
  )
}

// ============================================
// Toggle Switch
// ============================================
interface ToggleProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  label?: string
  description?: string
}

export function Toggle({ checked, onChange, disabled, label, description }: ToggleProps) {
  return (
    <label className={cn(
      "flex items-center gap-3",
      disabled && "opacity-50 cursor-not-allowed"
    )}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={cn(
          "relative w-11 h-6 rounded-full transition-colors duration-200",
          checked ? "bg-[#06b6d4]" : "bg-white/10"
        )}
      >
        <span
          className={cn(
            "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200",
            checked && "transform translate-x-5"
          )}
        />
      </button>
      {(label || description) && (
        <div>
          {label && <span className="text-sm text-white">{label}</span>}
          {description && <p className="text-xs text-white/50">{description}</p>}
        </div>
      )}
    </label>
  )
}

// ============================================
// Color Picker
// ============================================
const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"
]

interface ColorPickerProps {
  value?: string
  onChange?: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange?.(color)}
          className={cn(
            "w-8 h-8 rounded-lg border-2 transition-all duration-200",
            value === color ? "border-white scale-110" : "border-transparent hover:scale-105"
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}
