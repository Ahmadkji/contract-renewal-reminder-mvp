"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  CreditCard,
  Plus,
  Clock,
  X,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BILLING_ENABLED } from "@/lib/billing/mode";

interface MobileMenuProps {
  onAddClick?: () => void;
  onClose?: () => void;
}

export function MobileMenu({ onAddClick, onClose }: MobileMenuProps) {
  const pathname = usePathname();
  const { user, profile, logout, loading } = useAuth();

  // Close menu on Escape key
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home, href: "/dashboard" },
    { id: "contracts", label: "Contracts", icon: FileText, href: "/dashboard/contracts" },
    ...(BILLING_ENABLED
      ? [{ id: "billing", label: "Billing", icon: CreditCard, href: "/dashboard/billing" }]
      : []),
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
    <div
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Dashboard mobile menu"
    >
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
            <span className="font-semibold text-white">Doc Renewal</span>
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
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all min-h-[44px] ${
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
                onClose?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all min-h-[44px] text-[#a3a3a3] hover:text-white hover:bg-white/5`}
            >
              <item.icon className={`w-5 h-5 ${item.emphasized ? "text-[#06b6d4]" : ""}`} />
              <span className={item.emphasized ? "text-[#06b6d4] font-medium" : ""}>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/[0.08]">
          {!loading && user && (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {profile?.full_name?.charAt(0).toUpperCase() || user.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {profile?.full_name || user.full_name || user.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-xs text-[#a3a3a3] truncate">
                  {user.email || 'user@example.com'}
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              onClose?.();
              void logout();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
