"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  Plus,
  Settings,
  Bell,
  Menu,
  X,
  Clock,
} from "lucide-react";

// Import Phase 2 Components
import { AddContractForm, ContractFormData } from "@/components/dashboard/add-contract-form";
import { ContractDetailView } from "@/components/dashboard/contract-detail-view";
import { EmailSettingsPanel } from "@/components/dashboard/email-settings-panel";
import { ConfirmationDialog } from "@/components/dashboard/confirmation-dialog";
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
// Shared State Context (simple version)
// ============================================
let globalContracts: Contract[] = [
  { id: "1", name: "Enterprise License", vendor: "Acme Corp", type: "license", expiryDate: "Dec 15, 2024", daysLeft: 45, status: "active", value: 24000 },
  { id: "2", name: "Support Contract", vendor: "TechStart Inc", type: "support", expiryDate: "Dec 28, 2024", daysLeft: 22, status: "expiring", value: 8400 },
  { id: "3", name: "Cloud Services", vendor: "Startup Hub", type: "subscription", expiryDate: "Nov 30, 2024", daysLeft: 5, status: "critical", value: 12000 },
  { id: "4", name: "Annual License", vendor: "Global Systems", type: "license", expiryDate: "Jan 5, 2025", daysLeft: 66, status: "active", value: 36000 },
  { id: "5", name: "Consulting Services", vendor: "DataPro Ltd", type: "service", expiryDate: "Dec 10, 2024", daysLeft: 38, status: "renewing", value: 18000 },
];

// ============================================
// Dashboard Layout Component
// ============================================
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  // Phase 2: Panel States
  const [addContractOpen, setAddContractOpen] = useState(false);
  const [contractDetailOpen, setContractDetailOpen] = useState(false);
  const [emailSettingsOpen, setEmailSettingsOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setSidebarExpanded(false);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Scroll detection for header
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      setScrolled(target.scrollTop > 50);
    };

    const mainContent = document.querySelector(".main-scroll-container");
    if (mainContent) {
      mainContent.addEventListener("scroll", handleScroll);
      return () => mainContent.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // Handle sidebar action (for buttons that open panels)
  const handleSidebarAction = (action: string) => {
    switch (action) {
      case "add":
        setAddContractOpen(true);
        break;
      case "settings":
        setEmailSettingsOpen(true);
        break;
    }
  };

  // Handle contract click
  const handleContractClick = (contractId: string) => {
    setSelectedContractId(contractId);
    setContractDetailOpen(true);
  };

  // Handle add contract submit
  const handleAddContract = async (data: ContractFormData) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newContract: Contract = {
      id: Date.now().toString(),
      name: data.name,
      vendor: data.vendor,
      type: data.type,
      expiryDate: data.endDate?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || "",
      daysLeft: data.endDate ? Math.ceil((data.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0,
      status: "active",
      value: data.value,
    };
    
    globalContracts = [newContract, ...globalContracts];
    toast.success("Contract created", `"${data.name}" has been added to your contracts.`);
  };

  // Handle delete contract
  const handleDeleteContract = () => {
    if (contractToDelete) {
      globalContracts = globalContracts.filter(c => c.id !== contractToDelete);
      toast.success("Contract deleted", "The contract has been removed.");
      setDeleteConfirmOpen(false);
      setContractDetailOpen(false);
      setContractToDelete(null);
      // Force re-render of child components
      window.dispatchEvent(new CustomEvent('contracts-updated'));
    }
  };

  // Expose contract click handler globally for child components
  useEffect(() => {
    (window as any).openContractDetail = handleContractClick;
    return () => {
      delete (window as any).openContractDetail;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Dotted Background */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(circle, #334155 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.15,
        }}
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-white/60 text-sm">Loading dashboard...</span>
          </div>
        </div>
      )}

      <div className="flex h-screen relative z-10">
        {/* Sidebar - Desktop */}
        {!isMobile && (
          <Sidebar
            expanded={sidebarExpanded}
            setExpanded={setSidebarExpanded}
            onAction={handleSidebarAction}
          />
        )}

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && isMobile && (
          <MobileMenu
            onAction={handleSidebarAction}
            onClose={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content */}
        <main 
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-out ${
            !isMobile ? (sidebarExpanded ? "ml-[240px]" : "ml-16") : ""
          }`}
        >
          {/* Header */}
          <Header
            isMobile={isMobile}
            onMenuClick={() => setMobileMenuOpen(true)}
            scrolled={scrolled}
            onAddClick={() => setAddContractOpen(true)}
          />

          {/* Content Area - Children render here */}
          <div className="main-scroll-container dashboard-scroll flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Phase 2: Slide-over Panels */}
      <AddContractForm
        open={addContractOpen}
        onOpenChange={setAddContractOpen}
        onSubmit={handleAddContract}
      />

      <ContractDetailView
        open={contractDetailOpen}
        onOpenChange={setContractDetailOpen}
        contractId={selectedContractId || undefined}
        onEdit={(id) => {
          setContractDetailOpen(false);
          setSelectedContractId(null);
          toast.info("Edit contract", "Edit functionality coming soon.");
        }}
        onDelete={(id) => {
          setContractToDelete(id);
          setDeleteConfirmOpen(true);
        }}
      />

      <EmailSettingsPanel
        open={emailSettingsOpen}
        onOpenChange={setEmailSettingsOpen}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Contract"
        description="Are you sure you want to delete this contract? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteContract}
      />
    </div>
  );
}

// ============================================
// Sidebar Component
// ============================================
interface SidebarProps {
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  onAction: (action: string) => void;
}

function Sidebar({ expanded, setExpanded, onAction }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home, href: "/dashboard" },
    { id: "contracts", label: "Contracts", icon: FileText, href: "/dashboard/contracts" },
  ];

  const actionItems = [
    { id: "add", label: "Add New", icon: Plus, emphasized: true },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/dashboard/";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#0a0a0a] border-r border-white/[0.08] z-40 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        expanded ? "w-60" : "w-16"
      }`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <Link href="/" className="h-14 flex items-center px-4 border-b border-white/[0.08] hover:bg-white/[0.02] transition-colors">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <span
            className={`ml-3 font-semibold text-white whitespace-nowrap transition-all duration-300 ${
              expanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
            }`}
          >
            Renewly
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2">
          {/* Route Links */}
          {navItems.map((item, index) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-200 group relative ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-[#a3a3a3] hover:text-white hover:bg-white/5"
                }`}
                style={{ transitionDelay: `${index * 50}ms` }}
              >
                {/* Active indicator */}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white rounded-r-full" />
                )}

                <item.icon className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />

                <span
                  className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${
                    expanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Divider */}
          <div className="my-2 h-px bg-white/[0.08]" />

          {/* Action Buttons */}
          {actionItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => onAction(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-200 group relative text-[#a3a3a3] hover:text-white hover:bg-white/5`}
              style={{ transitionDelay: `${(navItems.length + index) * 50}ms` }}
            >
              <item.icon
                className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                  item.emphasized ? "w-6 h-6 text-[#06b6d4]" : ""
                } group-hover:scale-110`}
              />

              <span
                className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${
                  expanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                } ${item.emphasized ? "text-[#06b6d4] font-medium" : ""}`}
              >
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#22c55e] flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold">
              JD
            </div>
            <div
              className={`transition-all duration-300 overflow-hidden ${
                expanded ? "opacity-100 w-auto" : "opacity-0 w-0"
              }`}
            >
              <div className="text-sm font-medium text-white truncate">John Doe</div>
              <div className="text-xs text-[#a3a3a3] truncate">john@company.com</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ============================================
// Mobile Menu Component
// ============================================
interface MobileMenuProps {
  onAction: (action: string) => void;
  onClose: () => void;
}

function MobileMenu({ onAction, onClose }: MobileMenuProps) {
  const pathname = usePathname();

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home, href: "/dashboard" },
    { id: "contracts", label: "Contracts", icon: FileText, href: "/dashboard/contracts" },
  ];

  const actionItems = [
    { id: "add", label: "Add New", icon: Plus, emphasized: true },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/dashboard/";
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div 
        className="absolute left-0 top-0 bottom-0 w-64 bg-[#0a0a0a] border-r border-white/[0.08]"
        style={{
          animation: "slideInLeft 300ms ease-out forwards",
        }}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.08]">
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">Renewly</span>
          </Link>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-[#a3a3a3] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="py-4 px-2">
          {/* Route Links */}
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-[#a3a3a3] hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Divider */}
          <div className="my-2 h-px bg-white/[0.08]" />

          {/* Action Buttons */}
          {actionItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onAction(item.id);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-[#a3a3a3] hover:text-white hover:bg-white/5`}
            >
              <item.icon className={`w-5 h-5 ${item.emphasized ? "text-[#06b6d4]" : ""}`} />
              <span className={item.emphasized ? "text-[#06b6d4] font-medium" : ""}>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

// ============================================
// Header Component
// ============================================
interface HeaderProps {
  isMobile: boolean;
  onMenuClick: () => void;
  scrolled: boolean;
  onAddClick: () => void;
}

function Header({ isMobile, onMenuClick, scrolled, onAddClick }: HeaderProps) {
  const pathname = usePathname();

  // Get page title based on route
  const getPageInfo = () => {
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      return { title: "Dashboard", subtitle: "Overview of your contract renewals" };
    }
    if (pathname.startsWith("/dashboard/contracts")) {
      return { title: "Contracts", subtitle: "Manage and track all your contracts" };
    }
    return { title: "Dashboard", subtitle: "" };
  };

  const pageInfo = getPageInfo();

  return (
    <header
      className={`sticky top-0 z-30 h-14 flex items-center justify-between px-4 sm:px-6 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/[0.08]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        {isMobile && (
          <button
            onClick={onMenuClick}
            className="w-9 h-9 flex items-center justify-center text-[#a3a3a3] hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Breadcrumb */}
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <span className="text-white font-medium">{pageInfo.title}</span>
          {pathname !== "/dashboard" && pathname !== "/dashboard/" && (
            <>
              <span className="text-white/30">/</span>
              <span className="text-[#a3a3a3]">Overview</span>
            </>
          )}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Quick Add Button */}
        <button 
          onClick={onAddClick}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden md:inline">Add Contract</span>
        </button>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center text-[#a3a3a3] hover:text-white transition-colors rounded-lg hover:bg-white/5">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#22c55e] rounded-full animate-pulse" />
        </button>

        {/* User Avatar */}
        <button className="w-8 h-8 rounded-full bg-[#22c55e] flex items-center justify-center text-white text-xs font-semibold">
          JD
        </button>
      </div>
    </header>
  );
}
