"use client";

import { usePathname } from "next/navigation";
import {
  Plus,
  Menu,
} from "lucide-react";

interface HeaderProps {
  isMobile: boolean;
  onMenuClick: () => void;
  onAddClick?: () => void;
  scrolled?: boolean;
}

export function DashboardHeader({ isMobile, onMenuClick, onAddClick, scrolled }: HeaderProps) {
  const pathname = usePathname();

  // Get page title based on route
  const getPageInfo = () => {
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      return { title: "Dashboard", subtitle: "Overview of your contract renewals" };
    }
    if (pathname.startsWith("/dashboard/contracts")) {
      return { title: "Contracts", subtitle: "Manage and track all your contracts" };
    }
    if (pathname.startsWith("/dashboard/billing")) {
      return { title: "Billing", subtitle: "Manage your subscription and billing details" };
    }
    if (pathname.startsWith("/dashboard/settings")) {
      return { title: "Settings", subtitle: "Manage your account preferences" };
    }
    return { title: "Dashboard", subtitle: "Overview of your contract renewals" };
  };

  const { title, subtitle } = getPageInfo();

  return (
    <header
      className={`sticky top-0 z-30 bg-[#0a0a0a] border-b border-white/[0.08] transition-all duration-300 ${
        scrolled ? "shadow-lg" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-14 sm:min-h-16 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base sm:text-xl font-semibold text-white">{title}</h1>
            <p className="hidden sm:block text-sm text-[#a3a3a3]">{subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Add Button */}
          <button
            onClick={onAddClick}
            className={`h-10 shrink-0 items-center text-sm font-medium bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors flex focus-ring ${
              isMobile ? "w-10 px-0 justify-center" : "px-4 gap-2 justify-center"
            }`}
            aria-label="Add contract"
          >
            <Plus className="w-4 h-4" />
            {!isMobile && "Add Contract"}
          </button>
          
          {/* Mobile Menu Button */}
          {isMobile && (
            <button
                onClick={onMenuClick}
                className="w-10 h-10 flex items-center justify-center text-[#a3a3a3] hover:text-white transition-colors rounded-lg hover:bg-white/5 focus-ring"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
          )}
        </div>
      </div>
    </header>
  );
}
