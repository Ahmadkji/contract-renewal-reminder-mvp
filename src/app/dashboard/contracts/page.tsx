"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  Download,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ============================================
// Types
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

// ============================================
// Mock Data
// ============================================
const MOCK_CONTRACTS: Contract[] = [
  { id: "1", name: "Enterprise License", vendor: "Acme Corp", type: "license", expiryDate: "Dec 15, 2024", daysLeft: 45, status: "active", value: 24000 },
  { id: "2", name: "Support Contract", vendor: "TechStart Inc", type: "support", expiryDate: "Dec 28, 2024", daysLeft: 22, status: "expiring", value: 8400 },
  { id: "3", name: "Cloud Services", vendor: "Startup Hub", type: "subscription", expiryDate: "Nov 30, 2024", daysLeft: 5, status: "critical", value: 12000 },
  { id: "4", name: "Annual License", vendor: "Global Systems", type: "license", expiryDate: "Jan 5, 2025", daysLeft: 66, status: "active", value: 36000 },
  { id: "5", name: "Consulting Services", vendor: "DataPro Ltd", type: "service", expiryDate: "Dec 10, 2024", daysLeft: 38, status: "renewing", value: 18000 },
  { id: "6", name: "Software Maintenance", vendor: "TechCorp", type: "support", expiryDate: "Feb 15, 2025", daysLeft: 107, status: "active", value: 9600 },
  { id: "7", name: "Cloud Storage Pro", vendor: "CloudSpace", type: "subscription", expiryDate: "Jan 20, 2025", daysLeft: 81, status: "active", value: 4800 },
  { id: "8", name: "Security Suite", vendor: "SecureNet", type: "license", expiryDate: "Dec 5, 2024", daysLeft: 15, status: "expiring", value: 15000 },
];

// ============================================
// Contracts Page Content
// ============================================
export default function ContractsPageContent() {
  const [contracts, setContracts] = useState<Contract[]>(MOCK_CONTRACTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [visible, setVisible] = useState(false);

  // Animation
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Listen for contract updates
  useEffect(() => {
    const handleUpdate = () => {
      // In a real app, this would refetch data
      console.log("Contracts updated");
    };
    window.addEventListener('contracts-updated', handleUpdate);
    return () => window.removeEventListener('contracts-updated', handleUpdate);
  }, []);

  // Handle contract click - calls the global function from layout
  const handleContractClick = (contractId: string) => {
    if ((window as any).openContractDetail) {
      (window as any).openContractDetail(contractId);
    }
  };

  // Filter contracts
  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          contract.vendor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "all" || contract.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
          Contracts
        </h1>
        <p className="text-sm text-[#a3a3a3] mt-1">
          Manage and track all your contracts
        </p>
      </div>

      {/* Toolbar */}
      <div className={`flex flex-col sm:flex-row gap-4 mb-6 transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3]" />
          <input
            type="text"
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-[#141414] border border-white/[0.08] rounded-lg text-sm text-white placeholder-[#a3a3a3] focus:outline-none focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20 transition-all"
          />
        </div>

        {/* Filter & Export */}
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 px-3 bg-[#141414] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-[#06b6d4] transition-all"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring</option>
            <option value="critical">Critical</option>
            <option value="renewing">Renewing</option>
          </select>

          <button className="h-10 px-4 bg-[#141414] border border-white/[0.08] rounded-lg text-sm text-[#a3a3a3] hover:text-white hover:border-white/20 transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Contracts Table */}
      <ContractsTable 
        contracts={filteredContracts}
        visible={visible}
        onContractClick={handleContractClick}
      />
    </div>
  );
}

// ============================================
// Contracts Table Component
// ============================================
function ContractsTable({ 
  contracts, 
  visible,
  onContractClick 
}: { 
  contracts: Contract[];
  visible: boolean;
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

  const getTypeLabel = (type: Contract["type"]) => {
    switch (type) {
      case "license": return "License";
      case "service": return "Service";
      case "support": return "Support";
      case "subscription": return "Subscription";
      default: return type;
    }
  };

  const formatValue = (value?: number) => {
    if (!value) return "-";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div
      className={`bg-[#141414] border border-white/[0.08] rounded-xl overflow-hidden transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: "100ms" }}
    >
      {/* Table Header */}
      <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/[0.08] text-xs font-medium text-[#a3a3a3] uppercase tracking-wider">
        <div className="col-span-4">Contract</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-2">Value</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2 text-right">Days Left</div>
      </div>

      {/* Table Body */}
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
              {/* Contract Info */}
              <div className="col-span-4 flex items-center gap-3">
                <div
                  className={`w-1 h-10 rounded-full ${getStatusColor(contract.status)} transition-all duration-200 group-hover:w-1.5`}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{contract.name}</div>
                  <div className="text-xs text-[#a3a3a3] truncate">{contract.vendor}</div>
                </div>
              </div>

              {/* Type */}
              <div className="col-span-2 flex items-center">
                <span className="text-sm text-[#a3a3a3]">{getTypeLabel(contract.type)}</span>
              </div>

              {/* Value */}
              <div className="col-span-2 flex items-center">
                <span className="text-sm text-white font-medium">{formatValue(contract.value)}</span>
              </div>

              {/* Status */}
              <div className="col-span-2 flex items-center">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
              </div>

              {/* Days Left */}
              <div className="col-span-2 flex items-center justify-between sm:justify-end gap-2">
                <div className="text-right">
                  <div className="text-lg font-semibold text-white">{contract.daysLeft}</div>
                  <div className="text-[10px] text-[#a3a3a3]">days left</div>
                </div>
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

      {/* Empty State */}
      {contracts.length === 0 && (
        <div className="p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-white/5 flex items-center justify-center">
            <FileText className="w-6 h-6 text-[#a3a3a3]" />
          </div>
          <p className="text-sm text-[#a3a3a3] mb-4">No contracts found</p>
        </div>
      )}

      {/* Footer */}
      {contracts.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.08] flex items-center justify-between">
          <span className="text-xs text-[#a3a3a3]">
            Showing {contracts.length} contracts
          </span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-white transition-colors disabled:opacity-50" disabled>
              Previous
            </button>
            <button className="px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-white transition-colors disabled:opacity-50" disabled>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
