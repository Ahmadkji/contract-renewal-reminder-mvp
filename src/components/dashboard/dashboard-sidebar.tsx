"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  CreditCard,
  Plus,
  Clock,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  onAddClick?: () => void;
}

export function DashboardSidebar({ expanded, setExpanded, onAddClick }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home, href: "/dashboard" },
    { id: "contracts", label: "Contracts", icon: FileText, href: "/dashboard/contracts" },
    { id: "billing", label: "Billing", icon: CreditCard, href: "/dashboard/billing" },
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
          {!loading && user && (
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
          <div className="mt-2">
            <button
              type="button"
              onClick={() => void logout()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all text-red-400 hover:text-red-300 hover:bg-red-500/10 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
