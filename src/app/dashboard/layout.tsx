"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  FileText,
  Plus,
  Bell,
  Menu,
  X,
  Clock,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LOADING_DELAY_MS } from "@/lib/constants";
import { logger } from "@/lib/logger";

// Import Phase 2 Components
import { AddContractForm } from "@/components/dashboard/add-contract-form";
import type { ContractFormData } from "@/components/dashboard/add-contract-form-types";
import { ContractDetailView } from "@/components/dashboard/contract-detail-view";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
// Dashboard Layout Component
// ============================================
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  // Phase 2: Panel States
  const [addContractOpen, setAddContractOpen] = useState(false);
  const [contractDetailOpen, setContractDetailOpen] = useState(false);
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

  // Auth check - redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), LOADING_DELAY_MS);
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

  // Handle contract click
  const handleContractClick = (contractId: string) => {
    setSelectedContractId(contractId);
    setContractDetailOpen(true);
  };

  // Expose openContractDetail for child pages
  useEffect(() => {
    (window as any).openContractDetail = (contractId: string) => {
      setSelectedContractId(contractId);
      setContractDetailOpen(true);
    };
    
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
            onAddClick={() => setAddContractOpen(true)}
          />
        )}

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && isMobile && (
          <MobileMenu
            onAddClick={() => setAddContractOpen(true)}
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
            onAddClick={() => setAddContractOpen(true)}
            scrolled={scrolled}
          />

          {/* Content Area - Children render here */}
          <div className="main-scroll-container dashboard-scroll flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      <AddContractForm
        open={addContractOpen}
        onOpenChange={setAddContractOpen}
        onSubmit={async (data: ContractFormData) => {
          // ✅ Call API to save to Supabase
          logger.info('Submitting contract data:', data);
          
          // Convert Date objects to YYYY-MM-DD format for database compatibility
          // FIX: Use date-only format to match database schema expectations
          const formatDate = (date: Date | null): string | null => {
            if (!date) return null;
            // Extract date components in local timezone to preserve user's intended date
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };
          
          const response = await fetch('/api/contracts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...data,
              startDate: formatDate(data.startDate),
              endDate: formatDate(data.endDate)
            })
          });

          logger.info('Response status:', response.status);

          if (!response.ok) {
            // Read response as text first to see what we're getting
            const responseText = await response.text();
            let errorMessage = 'Failed to create contract';
            
            // FIX: Handle empty or malformed responses properly
            if (!responseText || responseText.trim() === '') {
              // Empty response body - use status-based error message
              errorMessage = `Server error (${response.status})`;
              console.error('[Contract Creation] Empty error response:', {
                status: response.status,
                statusText: response.statusText
              });
            } else {
              // Try to parse and extract meaningful error
              try {
                const errorData = JSON.parse(responseText);
                if (errorData && typeof errorData === 'object' && Object.keys(errorData).length > 0) {
                  // Extract error from structured response
                  errorMessage = errorData.error || errorData.details || errorData.message || errorMessage;
                  console.error('[Contract Creation] API error:', {
                    status: response.status,
                    error: errorData
                  });
                } else {
                  // Valid JSON but empty or unexpected structure
                  errorMessage = `Server error (${response.status})`;
                  console.error('[Contract Creation] Malformed error response:', {
                    status: response.status,
                    body: responseText
                  });
                }
              } catch {
                // Not valid JSON
                errorMessage = `Server error (${response.status}): ${responseText || response.statusText}`;
                console.error('[Contract Creation] Non-JSON error response:', {
                  status: response.status,
                  statusText: response.statusText,
                  body: responseText
                });
              }
            }
            
            throw new Error(errorMessage);
          }
          
          // Then dispatch event to refresh UI
          window.dispatchEvent(new CustomEvent('contracts-updated'));
        }}
      />

      <ContractDetailView
        open={contractDetailOpen}
        onOpenChange={setContractDetailOpen}
        contractId={selectedContractId || undefined}
        onDelete={(id) => {
          setContractToDelete(id);
          setDeleteConfirmOpen(true);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contract? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (contractToDelete) {
                try {
                  const response = await fetch(`/api/contracts/${contractToDelete}`, {
                    method: 'DELETE',
                  });

                  if (response.ok) {
                    setDeleteConfirmOpen(false);
                    setContractDetailOpen(false);
                    setContractToDelete(null);
                    window.dispatchEvent(new CustomEvent('contracts-updated'));
                    toast({
                      title: "Contract deleted",
                      description: "Your contract has been successfully deleted.",
                    });
                  } else {
                    const errorData = await response.json();
                    toast({
                      title: "Error",
                      description: errorData.error || "Failed to delete contract",
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  console.error('Error deleting contract:', error);
                  toast({
                    title: "Error",
                    description: "Failed to delete contract",
                    variant: "destructive",
                  });
                }
              }
            }} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================
// Sidebar Component
// ============================================
interface SidebarProps {
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  onAddClick?: () => void;
}

function Sidebar({ expanded, setExpanded, onAddClick }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home, href: "/dashboard" },
    { id: "contracts", label: "Contracts", icon: FileText, href: "/dashboard/contracts" },
  ];

  const actionItems = [
    { id: "add", label: "Add New", icon: Plus, emphasized: true, action: "add" },
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
              onClick={onAddClick}
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
          {/* User Profile */}
          {user && (
            <div className="flex items-center gap-3 mb-3">
              {/* Avatar with initials */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {user.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              
              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {user.full_name || user.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-xs text-[#a3a3a3] truncate">
                  {user.email || 'user@example.com'}
                </div>
              </div>
            </div>
          )}
          
          {/* Logout Button */}
          <form action={logout} className="mt-2">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all text-red-400 hover:text-red-300 hover:bg-red-500/10 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

// ============================================
// Mobile Menu Component
// ============================================
interface MobileMenuProps {
  onAddClick?: () => void;
  onClose: () => void;
}

function MobileMenu({ onAddClick, onClose }: MobileMenuProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home, href: "/dashboard" },
    { id: "contracts", label: "Contracts", icon: FileText, href: "/dashboard/contracts" },
  ];

  const actionItems = [
    { id: "add", label: "Add New", icon: Plus, emphasized: true, action: "add" },
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
                onAddClick?.();
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
  onAddClick?: () => void;
  scrolled: boolean;
}

function Header({ isMobile, onMenuClick, onAddClick, scrolled }: HeaderProps) {
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
      </div>
    </header>
  );
}