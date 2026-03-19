"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  Plus,
  Clock,
  X,
} from "lucide-react";

interface MobileMenuProps {
  onAddClick?: () => void;
  onClose?: () => void;
}

export function MobileMenu({ onAddClick, onClose }: MobileMenuProps) {
  const pathname = usePathname();

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
                onClose?.();
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
