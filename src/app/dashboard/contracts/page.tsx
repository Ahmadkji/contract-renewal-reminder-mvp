"use client";

import {
  FileText,
  Search,
  MoreHorizontal,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ANIMATION_DELAY_MS } from "@/lib/constants";
import { useContracts } from "@/hooks/use-contracts";
import { useDashboardUI } from "@/components/dashboard/dashboard-ui-context";
import type { ContractSummary } from "@/types/contract";

type ContractFilterStatus = "all" | ContractSummary["status"];

interface ContractsToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filterStatus: ContractFilterStatus;
  onFilterStatusChange: (value: ContractFilterStatus) => void;
}

function getStatusColor(status: ContractSummary["status"]) {
  switch (status) {
    case "active":
      return "bg-[#22c55e]";
    case "expiring":
      return "bg-[#eab308]";
    case "critical":
      return "bg-[#ef4444]";
    case "renewing":
      return "bg-[#3b82f6]";
    default:
      return "bg-[#22c55e]";
  }
}

function getStatusBadge(status: ContractSummary["status"]) {
  switch (status) {
    case "active":
      return { bg: "bg-[#22c55e]/20", text: "text-[#22c55e]", label: "Active" };
    case "expiring":
      return { bg: "bg-[#eab308]/20", text: "text-[#eab308]", label: "Expiring" };
    case "critical":
      return { bg: "bg-[#ef4444]/20", text: "text-[#ef4444]", label: "Critical" };
    case "renewing":
      return { bg: "bg-[#3b82f6]/20", text: "text-[#3b82f6]", label: "Renewing" };
    default:
      return { bg: "bg-[#22c55e]/20", text: "text-[#22c55e]", label: "Active" };
  }
}

function getTypeLabel(type: ContractSummary["type"]) {
  switch (type) {
    case "license":
      return "License";
    case "service":
      return "Service";
    case "support":
      return "Support";
    case "subscription":
      return "Subscription";
    default:
      return type;
  }
}

function formatValue(value?: number) {
  if (!value) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ContractsPage() {
  const { openContractDetail } = useDashboardUI();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<ContractFilterStatus>("all");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, error } = useContracts(1, 50, undefined, {
    search: debouncedSearchQuery,
  });

  const filteredContracts = useMemo(() => {
    const contracts = data?.contracts ?? [];
    if (filterStatus === "all") {
      return contracts;
    }

    return contracts.filter((contract) => contract.status === filterStatus);
  }, [data?.contracts, filterStatus]);

  const hasActiveFilters = debouncedSearchQuery.length > 0 || filterStatus !== "all";

  const handleContractClick = useCallback(
    (contractId: string) => {
      openContractDetail(contractId);
    },
    [openContractDetail]
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="text-center text-[#a3a3a3]">Loading contracts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="text-center text-red-400">
          Failed to load contracts. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
          Contracts
        </h1>
        <p className="text-sm text-[#a3a3a3] mt-1">
          Manage and track all your contracts
        </p>
      </div>

      <ContractsToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
      />

      <ContractsTable
        contracts={filteredContracts}
        onContractClick={handleContractClick}
        hasActiveFilters={hasActiveFilters}
      />
    </div>
  );
}

function ContractsToolbar({
  searchQuery,
  onSearchQueryChange,
  filterStatus,
  onFilterStatusChange,
}: ContractsToolbarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), ANIMATION_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`flex flex-col sm:flex-row gap-4 mb-6 transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3]" />
        <input
          type="text"
          placeholder="Search contracts..."
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          className="w-full h-10 pl-10 pr-4 bg-[#141414] border border-white/[0.08] rounded-lg text-sm text-white placeholder-[#a3a3a3] focus:outline-none focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20 transition-all"
        />
      </div>

      <div className="flex items-center gap-2">
        <select
          value={filterStatus}
          onChange={(event) =>
            onFilterStatusChange(event.target.value as ContractFilterStatus)
          }
          className="h-10 px-3 bg-[#141414] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-[#06b6d4] transition-all"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring</option>
          <option value="critical">Critical</option>
          <option value="renewing">Renewing</option>
        </select>
      </div>
    </div>
  );
}

function ContractsTable({
  contracts,
  onContractClick,
  hasActiveFilters,
}: {
  contracts: ContractSummary[];
  onContractClick: (id: string) => void;
  hasActiveFilters: boolean;
}) {
  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-xl overflow-hidden">
      <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/[0.08] text-xs font-medium text-[#a3a3a3] uppercase tracking-wider">
        <div className="col-span-4">Contract</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-2">Value</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2 text-right">Days Left</div>
      </div>

      <div className="divide-y divide-white/5">
        {contracts.map((contract, index) => {
          const badge = getStatusBadge(contract.status);

          return (
            <div
              key={contract.id}
              onClick={() => onContractClick(contract.id)}
              className="group grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 p-4 hover:bg-[#1a1a1a] transition-all duration-200 cursor-pointer"
              style={{ transitionDelay: `${index * 30}ms` }}
            >
              <div className="col-span-4 flex items-center gap-3">
                <div
                  className={`w-1 h-10 rounded-full ${getStatusColor(contract.status)} transition-all duration-200 group-hover:w-1.5`}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {contract.name}
                  </div>
                  <div className="text-xs text-[#a3a3a3] truncate">
                    {contract.vendor}
                  </div>
                </div>
              </div>

              <div className="col-span-2 flex items-center">
                <span className="text-sm text-[#a3a3a3]">
                  {getTypeLabel(contract.type)}
                </span>
              </div>

              <div className="col-span-2 flex items-center">
                <span className="text-sm text-white font-medium">
                  {formatValue(contract.value)}
                </span>
              </div>

              <div className="col-span-2 flex items-center">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}
                >
                  {badge.label}
                </span>
              </div>

              <div className="col-span-2 flex items-center justify-between sm:justify-end gap-2">
                <div className="text-right">
                  <div className="text-lg font-semibold text-white">
                    {contract.daysLeft}
                  </div>
                  <div className="text-[10px] text-[#a3a3a3]">days left</div>
                </div>
                <button
                  className="w-8 h-8 flex items-center justify-center text-[#a3a3a3] opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-white/10"
                  onClick={(event) => {
                    event.stopPropagation();
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

      {contracts.length === 0 && (
        <div className="p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-white/5 flex items-center justify-center">
            <FileText className="w-6 h-6 text-[#a3a3a3]" />
          </div>
          <p className="text-sm text-[#a3a3a3] mb-4">
            {hasActiveFilters
              ? "No contracts matched your search/filter"
              : "No contracts found"}
          </p>
        </div>
      )}

      {contracts.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.08] flex items-center justify-between">
          <span className="text-xs text-[#a3a3a3]">
            Showing {contracts.length} contracts
          </span>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-white transition-colors disabled:opacity-50"
              disabled
            >
              Previous
            </button>
            <button
              className="px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-white transition-colors disabled:opacity-50"
              disabled
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
