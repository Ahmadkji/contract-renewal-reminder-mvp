"use client";

import Link from "next/link";
import {
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils/date-utils";

// ============================================
// Types & Interfaces
// ============================================
interface Contract {
  id: string;
  name: string;
  vendor: string;
  type: "license" | "service" | "support" | "subscription";
  expiryDate: string;
  daysLeft: number;
  status: "active" | "expiring" | "critical" | "renewing";
  value?: number;
}

interface TimelineItem {
  id: string;
  contractName: string;
  vendor: string;
  daysRemaining: number;
  date: string;
  status: "active" | "expiring" | "critical" | "renewing";
}

interface DashboardClientProps {
  initialContracts: Contract[];
  initialUpcoming: Contract[];
}

// ============================================
// Dashboard Client Component - Interactive UI
// ============================================
export function DashboardClient({ initialContracts, initialUpcoming }: DashboardClientProps) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);

  // Create timeline items from upcoming contracts on mount
  useEffect(() => {
    const items = initialUpcoming
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .map((contract) => ({
        id: contract.id,
        contractName: contract.name,
        vendor: contract.vendor,
        daysRemaining: contract.daysLeft,
        date: formatDate(contract.expiryDate),
        status: contract.status
      }));
    setTimelineItems(items);
  }, [initialUpcoming]);

  // Listen for contract updates
  useEffect(() => {
    const handleUpdate = () => {
      // Refresh data after contract changes
      window.location.reload();
    };
    window.addEventListener('contracts-updated', handleUpdate);
    return () => window.removeEventListener('contracts-updated', handleUpdate);
  }, []);

  const handleContractClick = useCallback((contractId: string) => {
    if ((window as any).openContractDetail) {
      (window as any).openContractDetail(contractId);
    }
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-[#a3a3a3] mt-1">
          Overview of your contract renewals
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 mt-6">
        {/* Active Contracts - 60% width */}
        <div className="lg:col-span-3">
          <ContractsList 
            contracts={contracts}
            onContractClick={handleContractClick}
          />
        </div>

        {/* Timeline - 40% width */}
        <div className="lg:col-span-2">
          <ExpiryTimeline 
            items={timelineItems}
            onItemClick={handleContractClick}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Contracts List Component
// ============================================
function ContractsList({ 
  contracts, 
  onContractClick 
}: { 
  contracts: Contract[];
  onContractClick: (id: string) => void;
}) {
  const getStatusColor = (status: Contract["status"]) => {
    switch (status) {
      case "active": return "bg-[#22c55e]";
      case "expiring": return "bg-[#eab308]";
      case "critical": return "bg-[#ef4444]";
      case "renewing": return "bg-[#3b82f6]";
      default: return "bg-[#22c55e]";
    }
  };

  const getStatusBadge = (status: Contract["status"]) => {
    switch (status) {
      case "active": return { bg: "bg-[#22c55e]/20", text: "text-[#22c55e]", label: "Active" };
      case "expiring": return { bg: "bg-[#eab308]/20", text: "text-[#eab308]", label: "Expiring" };
      case "critical": return { bg: "bg-[#ef4444]/20", text: "text-[#ef4444]", label: "Critical" };
      case "renewing": return { bg: "bg-[#3b82f6]/20", text: "text-[#3b82f6]", label: "Renewing" };
      default: return { bg: "bg-[#22c55e]/20", text: "text-[#22c55e]", label: "Active" };
    }
  };

  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Active Contracts</h2>
          <span className="px-2 py-0.5 text-xs bg-white/10 text-[#a3a3a3] rounded-full">
            {contracts.length}
          </span>
        </div>
        <Link 
          href="/dashboard/contracts"
          className="text-xs text-[#a3a3a3] hover:text-white transition-colors flex items-center gap-1"
        >
          View All
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* List */}
      <div className="divide-y divide-white/5">
        {contracts.slice(0, 5).map((contract, index) => {
          const badge = getStatusBadge(contract.status);
          return (
            <div
              key={contract.id}
              onClick={() => onContractClick(contract.id)}
              className="group p-4 hover:bg-[#1a1a1a] transition-all duration-200 cursor-pointer"
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                {/* Status Indicator */}
                <div
                  className={`w-1 h-10 rounded-full ${getStatusColor(contract.status)} transition-all duration-200 group-hover:w-1.5`}
                />

                {/* Contract Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white truncate">
                      {contract.name}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
                    <span>{contract.vendor}</span>
                    <span className="text-white/20">•</span>
                    <span>Expires: {contract.expiryDate}</span>
                  </div>
                </div>

                {/* Days Left */}
                <div className="text-right">
                  <div className="text-lg font-semibold text-white">{contract.daysLeft}</div>
                  <div className="text-[10px] text-[#a3a3a3]">days left</div>
                </div>

                {/* Action Button */}
                <button
                  className="w-8 h-8 flex items-center justify-center text-[#a3a3a3] opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onContractClick(contract.id);
                  }}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/[0.08] text-center">
        <Link 
          href="/dashboard/contracts"
          className="text-xs text-[#06b6d4] hover:text-[#06b6d4]/80 transition-colors"
        >
          View all contracts →
        </Link>
      </div>
    </div>
  );
}

// ============================================
// Expiry Timeline Component
// ============================================
function ExpiryTimeline({ 
  items,
  onItemClick 
}: { 
  items: TimelineItem[];
  onItemClick: (id: string) => void;
}) {
  const getStatusColor = (status: TimelineItem["status"]) => {
    switch (status) {
      case "active": return "bg-[#22c55e]";
      case "expiring": return "bg-[#eab308]";
      case "critical": return "bg-[#ef4444]";
      default: return "bg-[#22c55e]";
    }
  };

  const getDaysColor = (days: number) => {
    if (days < 7) return "text-[#ef4444]";
    if (days < 30) return "text-[#eab308]";
    return "text-[#a3a3a3]";
  };

  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
        <h2 className="text-sm font-semibold text-white">Upcoming Expiries</h2>
        <span className="text-xs text-[#a3a3a3]">Next 60 days</span>
      </div>

      {/* Timeline */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        <div className="relative pl-6">
          {/* Vertical Line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
 
          
          {/* Timeline Items */}
          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={item.id}
                onClick={() => onItemClick(item.id)}
                className="relative group cursor-pointer"
                style={{ transitionDelay: `${index * 50}ms` }}
              >
                {/* Node */}
                <div
                  className={`absolute left-[-22px] top-1 w-3.5 h-3.5 rounded-full ${getStatusColor(item.status)} border-2 border-[#141414] z-10 transition-transform duration-200 group-hover:scale-125`}
                />

                {/* Content */}
                <div className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-[#a3a3a3] bg-white/10 px-2 py-0.5 rounded uppercase">
                      {item.date}
                    </span>
                    <span className={`text-xs font-medium ${getDaysColor(item.daysRemaining)}`}>
                      {item.daysRemaining} days
                    </span>
                  </div>
                  <div className="text-sm font-medium text-white">{item.contractName}</div>
                  <div className="text-xs text-[#a3a3a3] mt-0.5">{item.vendor}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
