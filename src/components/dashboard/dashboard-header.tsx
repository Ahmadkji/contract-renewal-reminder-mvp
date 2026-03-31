"use client";

import { usePathname } from "next/navigation";
import {
  Bell,
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
            <p className="text-sm text-[#a3a3a3]">{subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <button className="w-9 h-9 flex items-center justify-center text-[#a3a3a3] hover:text-white transition-colors rounded-lg hover:bg-white/5 focus-ring">
            <Bell className="w-5 h-5" />
          </button>
          
          {/* Add Button */}
          <button
            onClick={onAddClick}
            className="h-9 px-4 items-center gap-2 text-sm font-medium bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-all flex focus-ring"
          >
            <Plus className="w-4 h-4" />
            {isMobile ? "" : "Add Contract"}
          </button>
          
          {/* Mobile Menu Button */}
          {isMobile && (
            <button
                onClick={onMenuClick}
                className="w-9 h-9 flex items-center justify-center text-[#a3a3a3] hover:text-white transition-colors rounded-lg hover:bg-white/5 focus-ring"
              >
                <Menu className="w-5 h-5" />
              </button>
          )}
        </div>
      </div>
    </header>
  );
}
