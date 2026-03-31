"use client";

import Link from "next/link";
import {
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";
import { useCallback } from "react";
import { useContracts } from "@/hooks/use-contracts";
import { useDashboardUI } from "@/components/dashboard/dashboard-ui-context";
import type { ContractSummary } from "@/types/contract";

// ============================================
// Types & Interfaces
// ============================================
interface DashboardClientProps {
  initialContracts: ContractSummary[];
}

// ============================================
// Dashboard Client Component - Interactive UI
// ============================================
export function DashboardClient({ initialContracts }: DashboardClientProps) {
  const { openContractDetail } = useDashboardUI();
  const { data } = useContracts(1, 5, {
    contracts: initialContracts,
    total: initialContracts.length,
  });
  const contracts = data?.contracts ?? initialContracts;

  const handleContractClick = useCallback((contractId: string) => {
    openContractDetail(contractId);
  }, [openContractDetail]);

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
      <div className="mt-6">
        <ContractsList 
          contracts={contracts}
          onContractClick={handleContractClick}
        />
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
  contracts: ContractSummary[];
  onContractClick: (id: string) => void;
}) {
  const getStatusColor = (status: ContractSummary["status"]) => {
    switch (status) {
      case "active": return "bg-[#22c55e]";
      case "expiring": return "bg-[#eab308]";
      case "critical": return "bg-[#ef4444]";
      case "renewing": return "bg-[#3b82f6]";
      default: return "bg-[#22c55e]";
    }
  };

  const getStatusBadge = (status: ContractSummary["status"]) => {
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
                    <span>Expires: {contract.expiryDate ?? "-"}</span>
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
