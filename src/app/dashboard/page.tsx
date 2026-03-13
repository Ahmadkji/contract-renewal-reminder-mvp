"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Files,
  Calendar,
  CheckCircle,
  Mail,
  MoreHorizontal,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
  status: "active" | "expiring" | "critical";
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
];

const TIMELINE_ITEMS: TimelineItem[] = [
  { id: "1", contractName: "Cloud Services", vendor: "Startup Hub", daysRemaining: 5, date: "Nov 30", status: "critical" },
  { id: "2", contractName: "Support Contract", vendor: "TechStart Inc", daysRemaining: 22, date: "Dec 28", status: "expiring" },
  { id: "3", contractName: "Enterprise License", vendor: "Acme Corp", daysRemaining: 45, date: "Dec 15", status: "active" },
  { id: "4", contractName: "Consulting Services", vendor: "DataPro Ltd", daysRemaining: 38, date: "Dec 10", status: "active" },
  { id: "5", contractName: "Annual License", vendor: "Global Systems", daysRemaining: 66, date: "Jan 5", status: "active" },
];

// ============================================
// Dashboard Page Content
// ============================================
export default function DashboardPageContent() {
  const [contracts, setContracts] = useState<Contract[]>(MOCK_CONTRACTS);
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

      {/* Stats Cards */}
      <StatsCards visible={visible} contracts={contracts} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 mt-6">
        {/* Active Contracts - 60% width */}
        <div className="lg:col-span-3">
          <ContractsList 
            contracts={contracts}
            visible={visible}
            onContractClick={handleContractClick}
          />
        </div>

        {/* Timeline - 40% width */}
        <div className="lg:col-span-2">
          <ExpiryTimeline 
            items={TIMELINE_ITEMS}
            visible={visible}
            onItemClick={handleContractClick}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Stats Cards Component
// ============================================
function StatsCards({ visible, contracts }: { visible: boolean; contracts: Contract[] }) {
  const stats = [
    {
      icon: Files,
      label: "Active Contracts",
      value: contracts.length.toString(),
      trend: "+3",
      trendUp: true,
      iconBg: "bg-white/10",
      iconColor: "text-white",
    },
    {
      icon: Calendar,
      label: "Expiring This Month",
      value: contracts.filter(c => c.daysLeft <= 30).length.toString(),
      subtext: "Require attention",
      iconBg: "bg-[#eab308]/20",
      iconColor: "text-[#eab308]",
      alert: true,
    },
    {
      icon: CheckCircle,
      label: "Renewals Processed",
      value: "12",
      progress: 75,
      iconBg: "bg-[#22c55e]/20",
      iconColor: "text-[#22c55e]",
    },
    {
      icon: Mail,
      label: "Email Alerts Sent",
      value: "48",
      statusDot: true,
      iconBg: "bg-[#3b82f6]/20",
      iconColor: "text-[#3b82f6]",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`bg-[#141414] border border-white/[0.08] rounded-xl p-4 transition-all duration-500 hover:border-white/20 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: `${index * 100}ms` }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
              <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
            </div>
            {stat.trend && (
              <span
                className={`text-xs font-medium flex items-center gap-0.5 ${
                  stat.trendUp ? "text-[#22c55e]" : "text-[#ef4444]"
                }`}
              >
                {stat.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {stat.trend}
              </span>
            )}
            {stat.alert && <AlertCircle className="w-4 h-4 text-[#eab308]" />}
            {stat.statusDot && (
              <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse" />
            )}
          </div>

          <div className="text-2xl font-semibold text-white mb-0.5">{stat.value}</div>
          <div className="text-xs text-[#a3a3a3]">{stat.label}</div>

          {stat.progress !== undefined && (
            <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#22c55e] rounded-full transition-all duration-1000"
                style={{ width: `${stat.progress}%` }}
              />
            </div>
          )}

          {stat.subtext && (
            <div className="mt-1 text-[10px] text-[#eab308]">{stat.subtext}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// Contracts List Component
// ============================================
function ContractsList({ 
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

  return (
    <div
      className={`bg-[#141414] border border-white/[0.08] rounded-xl overflow-hidden transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
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
  visible,
  onItemClick 
}: { 
  items: TimelineItem[];
  visible: boolean;
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
    <div
      className={`bg-[#141414] border border-white/[0.08] rounded-xl overflow-hidden transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: "100ms" }}
    >
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
