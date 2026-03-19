"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/date-utils";
import { FileText, Calendar, CheckCircle, Mail, TrendingUp, AlertTriangle } from "lucide-react";
import { logger } from "@/lib/logger";

// ============================================
// Types
// ============================================
interface Contract {
  id: string;
  name: string;
  vendor: string;
  type: "license" | "service" | "support" | "subscription";
  startDate: string;  // ISO 8601 string from API
  endDate: string;    // ISO 8601 string from API
  expiryDate: string;
  daysLeft: number;
  status: "active" | "expiring" | "critical" | "renewing";
  value?: number;
}

interface KPICardsProps {
  contracts: Contract[];
}

interface KPICardData {
  id: string;
  label: string;
  value: number;
  trend?: string;
  status: "success" | "warning" | "info" | "danger";
  metadata?: {
    critical?: number;
    progress?: number;
    lastUpdated?: string;
  };
}

// ============================================
// Animation Utilities
// ============================================
const ANIMATIONS = {
  pulse: "animate-pulse",
  spin: "animate-spin",
  bounce: "animate-bounce",
  drawCheck: "animate-drawCheck",
  slideUp: "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
} as const;

// Add custom keyframes for waveform animation (will be injected via style)
const WAVEFORM_KEYFRAMES = `
  @keyframes waveform {
    0%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(0.6); }
  }
`;

// ============================================
// Creative Visual Components
// ============================================

// 1. Pulse Ring (wraps around icon in Zone 1)
function PulseRing({ isActive, isHovered }: { isActive: boolean; isHovered: boolean }) {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 48 48">
      {/* Outer pulsing ring */}
      <circle
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeDasharray="4 4"
        className={cn(
          "origin-center",
          isActive && (isHovered ? "animate-[spin_1s_linear_infinite]" : "animate-[spin_3s_linear_infinite]")
        )}
      />
    </svg>
  );
}

// 1.5 Activity Ring (Zone 3 for Card 1)
function ActivityRing({ health = 75, isHovered }: { health?: number; isHovered: boolean }) {
  const segments = 4;
  const filledSegments = Math.round((health / 100) * segments);
  
  return (
    <svg className="w-8 h-8" viewBox="0 0 48 48">
      <g className={cn(
        "origin-center",
        isHovered ? "animate-[spin_2s_linear_infinite]" : "animate-[spin_8s_linear_infinite]"
      )}>
        {Array.from({ length: segments }).map((_, i) => {
          const startAngle = (i * 90) - 90;
          const endAngle = startAngle + 80;
          const isFilled = i < filledSegments;
          
          const x1 = 24 + 18 * Math.cos((startAngle * Math.PI) / 180);
          const y1 = 24 + 18 * Math.sin((startAngle * Math.PI) / 180);
          const x2 = 24 + 18 * Math.cos((endAngle * Math.PI) / 180);
          const y2 = 24 + 18 * Math.sin((endAngle * Math.PI) / 180);
          
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#22c55e"
              strokeWidth="3"
              strokeLinecap="round"
              opacity={isFilled ? 1 : 0.2}
            />
          );
        })}
      </g>
    </svg>
  );
}

// 2. Heat Bar (Expiring) - Horizontal orientation
function HeatBar({ value, max = 12 }: { value: number; max?: number }) {
  const percentage = Math.min((value / max) * 100, 100);
  const bars = 6;
  
  return (
    <div className="flex items-center gap-[2px] w-full h-6">
      {Array.from({ length: bars }).map((_, i) => {
        const barThreshold = ((i + 1) / bars) * 100;
        const isFilled = percentage >= barThreshold;
        const intensity = isFilled ? 0.6 + (i / bars) * 0.4 : 0.1;
        
        return (
          <div
            key={i}
            className="h-full rounded-full transition-all duration-600 ease-out"
            style={{
              width: "14.28%",
              backgroundColor: `rgba(234, 179, 8, ${intensity})`,
              opacity: isFilled ? 1 : 0.3,
              transform: isFilled ? "scaleY(1)" : "scaleY(0.8)",
            }}
          />
        );
      })}
    </div>
  );
}

// 3. Step Dots (Renewals) with staggered animation on load
function StepDots({ progress, isHovered }: { progress: number; isHovered: boolean }) {
  const [mounted, setMounted] = React.useState(false);
  const steps = 4;
  const completedSteps = Math.round((progress / 100) * steps);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);
  
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: steps }).map((_, i) => (
        <React.Fragment key={i}>
          <div
            className={cn(
              "w-3 h-3 rounded-full transition-all duration-300",
              i < completedSteps
                ? "bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                : "bg-white/20",
              i === completedSteps && isHovered && "animate-pulse",
              !mounted && "opacity-0"
            )}
            style={{
              transitionDelay: mounted ? `${i * 100}ms` : undefined,
            }}
          />
          {i < steps - 1 && (
            <div
              className={cn(
                "w-4 h-[2px] transition-all duration-300",
                i < completedSteps ? "bg-[#22c55e]" : "bg-white/20",
                !mounted && "opacity-0"
              )}
              style={{
                transitionDelay: mounted ? `${i * 100 + 50}ms` : undefined,
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// 4. Waveform (Emails) - Continuous animation
function Waveform({ isHovered }: { isHovered: boolean }) {
  const bars = [4, 7, 5, 8, 6, 9, 5, 7, 4, 6];
  
  return (
    <div className="relative flex items-end gap-[2px] h-6 overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(59,130,246,0.1)] to-transparent pointer-events-none" />
      
      {bars.map((height, i) => (
        <div
          key={i}
          className={cn(
            "w-[3px] bg-[#3b82f6] rounded-full",
            isHovered ? "animate-pulse" : "animate-[waveform_2s_ease-in-out_infinite]"
          )}
          style={{
            height: `${height * 3}px`,
            opacity: 0.3 + (i % 3) * 0.25,
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// Number Slide Animation
// ============================================
function NumberSlide({ value }: { value: number }) {
  const [prevValue, setPrevValue] = React.useState(value);
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (prevValue !== value) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setPrevValue(value);
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [value, prevValue]);

  return (
    <div className="relative overflow-hidden h-7">
      <div
        className={cn(
          "absolute inset-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isAnimating ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        )}
      >
        {prevValue}
      </div>
      <div
        className={cn(
          "absolute inset-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isAnimating ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ============================================
// Segment Component (Three-Zone Layout)
// ============================================
interface SegmentProps {
  data: KPICardData;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (hovered: boolean) => void;
  onClick: () => void;
}

function Segment({ data, isHovered, isSelected, onHover, onClick }: SegmentProps) {
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);
  
  const getIcon = () => {
    switch (data.id) {
      case "active":
        return <FileText className="w-5 h-5" />;
      case "expiring":
        return <AlertTriangle className="w-5 h-5" />;
      case "renewals":
        // Custom checkmark with draw animation (400ms)
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path
              d="M8 12l3 3 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="24"
              strokeDashoffset={mounted ? 0 : 24}
              style={{
                transition: 'stroke-dashoffset 400ms ease-out',
              }}
            />
          </svg>
        );
      case "emails":
        return <Mail className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case "success": return "#22c55e";
      case "warning": return "#eab308";
      case "info": return "#3b82f6";
      case "danger": return "#ef4444";
      default: return "#ffffff";
    }
  };

  const getVisualElement = () => {
    switch (data.id) {
      case "active":
        return <ActivityRing health={75} isHovered={isHovered} />;
      case "expiring":
        return <HeatBar value={data.value} />;
      case "renewals":
        return <StepDots progress={data.metadata?.progress || 75} isHovered={isHovered} />;
      case "emails":
        return <Waveform isHovered={isHovered} />;
      default:
        return null;
    }
  };

  const statusColor = getStatusColor();

  return (
    <div
      className={cn(
        "relative flex items-center h-[72px] cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "border-r border-white/[0.06]",
        isHovered && "bg-white/[0.02]",
        isSelected && "bg-white/[0.04]"
      )}
      style={{
        width: isHovered ? "calc(25% + 10% / 4)" : "25%",
        flexShrink: isHovered ? 0 : 1
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
    >
      {/* Zone 1: Icon + Status Indicator (48px fixed) */}
      <div className="w-[48px] h-full flex items-center justify-center relative overflow-hidden">
        {/* Background tint */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `${statusColor}02` }}
        />
        
        {/* Pulse Ring (wraps around icon for active card) */}
        {data.id === "active" && <PulseRing isActive={true} isHovered={isHovered} />}
        
        {/* Icon - bleeds to edge */}
        <div className="relative z-10" style={{ color: statusColor }}>
          {getIcon()}
        </div>
        
        {/* Pulsing status dot */}
        <div
          className={cn(
            "absolute bottom-2 right-2 w-2 h-2 rounded-full",
            "animate-pulse"
          )}
          style={{
            backgroundColor: statusColor,
            animationDuration: isHovered ? "1s" : "2s",
          }}
        />
        
        {/* Critical badge for expiring */}
        {data.id === "expiring" && data.metadata?.critical && data.metadata.critical > 0 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#ef4444] rounded-full flex items-center justify-center text-[8px] font-bold text-white animate-bounce">
            {data.metadata.critical}
          </div>
        )}
      </div>

      {/* Zone 2: Stacked Data (flex-1) */}
      <div className="flex-1 h-full flex flex-col justify-start pt-2 px-3 relative">
        {/* Number - touches top */}
        <div className="text-[28px] font-bold text-white leading-none">
          <NumberSlide value={data.value} />
        </div>
        
        {/* Label - directly below number, no gap */}
        <div className="text-[10px] uppercase tracking-wider text-white/60">
          {data.label}
        </div>
        
        {/* Trend micro-text - right-aligned to zone */}
        {data.trend && (
          <div className="absolute right-3 bottom-2 text-[10px] text-[#22c55e] flex items-center gap-1">
            {data.trend.startsWith("●") && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            )}
            {data.trend.startsWith("↑") && <TrendingUp className="w-2.5 h-2.5" />}
            <span>{data.trend.replace("↑", "").replace("●", "").trim()}</span>
          </div>
        )}
      </div>

      {/* Zone 3: Visual Element (flex-1) */}
      <div className="flex-1 h-full flex items-center justify-center pr-4 relative">
        {/* Quarter Indicator for renewals */}
        {data.id === "renewals" && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] text-white/40 font-bold">
            Q1
          </div>
        )}
        
        {/* Momentum Line for renewals */}
        {data.id === "renewals" && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-[1px] bg-gradient-to-r from-transparent via-[#22c55e] to-transparent transform -rotate-15" />
        )}
        
        {getVisualElement()}
      </div>

      {/* Last updated micro-text (shows on hover) */}
      {isHovered && data.metadata?.lastUpdated && (
        <div className="absolute bottom-1 left-3 text-[8px] text-white/30">
          Last updated: {data.metadata.lastUpdated}
        </div>
      )}
    </div>
  );
}

// ============================================
// Detail Panel (Expanded State)
// ============================================
interface DetailPanelProps {
  data: KPICardData;
  isOpen: boolean;
}

function DetailPanel({ data, isOpen }: DetailPanelProps) {
  if (!isOpen) return null;

  // Generate sparkline data points (6 months)
  const sparklineData = Array.from({ length: 6 }, () => Math.floor(Math.random() * 50) + 20);
  const maxVal = Math.max(...sparklineData);
  const minVal = Math.min(...sparklineData);
  const range = maxVal - minVal || 1;

  return (
    <div className="w-full bg-[#0a0a0a] border-t border-white/[0.08] animate-slideDownPanel">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
            {data.label} Details
          </h3>
          <div className="text-xs text-white/40">
            Last updated: {data.metadata?.lastUpdated || "Just now"}
          </div>
        </div>
        
        {/* Sparkline chart */}
        <div className="mb-4 h-16 relative">
          <svg className="w-full h-full" viewBox="0 0 300 60" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              points={sparklineData.map((val, i) => {
                const x = (i / (sparklineData.length - 1)) * 300;
                const y = 60 - ((val - minVal) / range) * 50;
                return `${x},${y}`;
              }).join(" ")}
            />
          </svg>
        </div>
        
        {/* Mini cards breakdown */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {["SaaS", "Services", "Licenses", "Other"].map((type, i) => (
            <div
              key={type}
              className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center"
            >
              <div className="text-lg font-bold text-white">{Math.floor(Math.random() * 10) + 1}</div>
              <div className="text-[10px] text-white/40 uppercase">{type}</div>
            </div>
          ))}
        </div>
        
        {/* Additional metrics */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Top vendor: AWS</span>
          <span className="text-white/40">Next expiry: 14 days</span>
          <span className="text-[#22c55e]">Trend: ↗ 12%</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Horizontal KPI Cards Component
// ============================================
function HorizontalKPICards({ data, onSegmentClick }: { data: KPICardData[]; onSegmentClick?: (segmentId: string) => void }) {
  const [hoveredSegment, setHoveredSegment] = React.useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = React.useState<string | null>(null);

  const handleSegmentClick = (segmentId: string) => {
    setSelectedSegment(selectedSegment === segmentId ? null : segmentId);
    onSegmentClick?.(segmentId);
  };

  return (
    <div className="w-full bg-[#141414] border border-white/[0.08] rounded-xl overflow-hidden">
      {/* Horizontal Bar */}
      <div className="flex h-[72px]">
        {data.map((segment) => (
          <Segment
            key={segment.id}
            data={segment}
            isHovered={hoveredSegment === segment.id}
            isSelected={selectedSegment === segment.id}
            onHover={(hovered) => setHoveredSegment(hovered ? segment.id : null)}
            onClick={() => handleSegmentClick(segment.id)}
          />
        ))}
      </div>

      {/* Detail Panel */}
      {selectedSegment && (
        <DetailPanel
          data={data.find((d) => d.id === selectedSegment)!}
          isOpen={!!selectedSegment}
        />
      )}
    </div>
  );
}

// ============================================
// Mobile Compact Version
// ============================================
function MobileHorizontalKPI({ data }: { data: KPICardData[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "#22c55e";
      case "warning": return "#eab308";
      case "info": return "#3b82f6";
      case "danger": return "#ef4444";
      default: return "#ffffff";
    }
  };

  return (
    <div className="overflow-x-auto -mx-4 px-4 pb-2">
      <div className="flex gap-2">
        {data.map((segment) => (
          <div
            key={segment.id}
            className="flex-shrink-0 w-[80px] h-[64px] bg-[#141414] border border-white/[0.08] rounded-xl flex flex-col items-center justify-center px-2"
            style={{
              backgroundColor: segment.id === "expiring" && segment.value > 10 ? "#1a1505" : undefined,
            }}
          >
            {/* Number + Trend (no icons per spec) */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-lg font-bold text-white">{segment.value}</span>
              
              {/* Micro trend indicator */}
              {segment.trend && (
                <span className="text-[10px] text-[#22c55e]">↑</span>
              )}
              
              {/* Critical badge */}
              {segment.id === "expiring" && segment.metadata?.critical && segment.metadata.critical > 0 && (
                <span className="w-3 h-3 bg-[#ef4444] rounded-full text-[6px] flex items-center justify-center text-white">
                  {segment.metadata.critical}
                </span>
              )}
            </div>
            
            {/* Label */}
            <span className="text-[9px] text-white/40 uppercase tracking-wider">
              {segment.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Export Main Component
// ============================================
export function KPICards({ contracts }: KPICardsProps) {
  const activeCount = contracts.filter(c => c.status === "active").length;
  const expiringCount = contracts.filter(c => c.daysLeft <= 30 && c.daysLeft > 7).length;
  const criticalCount = contracts.filter(c => c.daysLeft <= 7).length;
  const totalExpiring = expiringCount + criticalCount;
  const renewalsCount = 48;
  const emailCount = 284;

  const kpiData: KPICardData[] = [
    {
      id: "active",
      label: "Active",
      value: activeCount,
      trend: "+12% vs last",
      status: "success",
      metadata: {
        lastUpdated: "2m ago",
      },
    },
    {
      id: "expiring",
      label: "Expiring",
      value: totalExpiring,
      trend: "⚠ 3 critical",
      status: "warning",
      metadata: {
        critical: criticalCount,
        lastUpdated: "5m ago",
      },
    },
    {
      id: "renewals",
      label: "Renewals",
      value: renewalsCount,
      trend: "↑ 8 more vs Q4",
      status: "success",
      metadata: {
        progress: 75,
        lastUpdated: "1h ago",
      },
    },
    {
      id: "emails",
      label: "Emails",
      value: emailCount,
      trend: "● healthy",
      status: "info",
      metadata: {
        lastUpdated: "30s ago",
      },
    },
  ];

  const handleSegmentClick = (segmentId: string) => {
    logger.info("Segment clicked:", segmentId);
    // Handle analytics, navigation, etc.
  };

  return (
    <div className="w-full">
      {/* Desktop: Horizontal Bar */}
      <div className="hidden lg:block">
        <HorizontalKPICards data={kpiData} onSegmentClick={handleSegmentClick} />
      </div>
      
      {/* Mobile: Horizontal Scroll */}
      <div className="lg:hidden">
        <MobileHorizontalKPI data={kpiData} />
      </div>
    </div>
  );
}
