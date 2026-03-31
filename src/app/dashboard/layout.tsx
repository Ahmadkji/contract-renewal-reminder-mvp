"use client";

import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { MobileMenu } from "@/components/dashboard/mobile-menu";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AddContractForm } from "@/components/dashboard/add-contract-form";
import type { ContractFormData, ContractInput } from "@/types/contract";
import {
  useCreateContract,
  useDeleteContract,
  useUpdateContract,
} from "@/hooks/use-contracts";
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
import {
  DashboardUIProvider,
  useDashboardUI,
} from "@/components/dashboard/dashboard-ui-context";
import { toast } from "@/hooks/use-toast";
import { toDateOnlyString } from "@/lib/utils/date-utils";
import { AuthProvider } from "@/contexts/AuthContext";

// ============================================
// Dashboard Layout - Client Component
// ============================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds (reduced from 5 minutes)
      retry: 1,
    },
  },
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DashboardUIProvider>
          <DashboardInteractiveElements>{children}</DashboardInteractiveElements>
        </DashboardUIProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function formatContractDate(date: Date | null): string {
  if (!date) {
    throw new Error("Start date and end date are required");
  }

  const formatted = toDateOnlyString(date);

  if (!formatted) {
    throw new Error("Start date and end date are required");
  }

  return formatted;
}

function normalizeOptionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toContractPayload(data: ContractFormData): ContractInput {
  const vendorContact = normalizeOptionalString(data.vendorContact);
  const vendorEmail = normalizeOptionalString(data.vendorEmail);

  if (Boolean(vendorContact) !== Boolean(vendorEmail)) {
    throw new Error("Vendor contact and vendor email must both be provided together");
  }

  return {
    name: data.name.trim(),
    vendor: data.vendor.trim(),
    type: data.type,
    startDate: formatContractDate(data.startDate),
    endDate: formatContractDate(data.endDate),
    value: data.value,
    currency: data.currency,
    autoRenew: data.autoRenew,
    renewalTerms: data.renewalTerms.trim(),
    notes: data.notes.trim(),
    tags: data.tags.map((tag) => tag.trim()).filter(Boolean),
    vendorContact,
    vendorEmail,
    reminderDays: data.reminderDays,
    emailReminders: data.emailReminders,
    notifyEmails: data.emailReminders
      ? data.notifyEmails.map((email) => email.trim()).filter(Boolean)
      : [],
  };
}

// ============================================
// Interactive UI Elements with State Management
// ============================================
function DashboardInteractiveElements({ children }: { children: React.ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const {
    addContractOpen,
    contractDetailOpen,
    selectedContractId,
    editingContract,
    deleteConfirmOpen,
    contractToDelete,
    openAddContract,
    setAddContractOpen,
    setContractDetailOpen,
    startEditingContract,
    requestDeleteContract,
    setDeleteConfirmOpen,
    completeDeleteFlow,
  } = useDashboardUI();

  // ✅ React Query mutation for contract creation with automatic cache invalidation
  const createContract = useCreateContract();
  const updateContract = useUpdateContract();
  const deleteContract = useDeleteContract();

  const handleDeleteContract = useCallback(async () => {
    if (!contractToDelete) {
      return;
    }

    try {
      await deleteContract.mutateAsync(contractToDelete);
      completeDeleteFlow();
    } catch (error) {
      console.error("[Contract Delete] Mutation failed:", error);
      toast({
        title: "Failed to delete contract",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [completeDeleteFlow, contractToDelete, deleteContract]);

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
      
      <DashboardMainContent
        sidebarExpanded={sidebarExpanded}
        setSidebarExpanded={setSidebarExpanded}
        isMobile={isMobile}
        setIsMobile={setIsMobile}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onAddClick={openAddContract}
      >
        {children}
      </DashboardMainContent>
      
      <AddContractForm
        open={addContractOpen}
        onOpenChange={setAddContractOpen}
        editData={editingContract?.formData}
        onSubmit={async (data: ContractFormData) => {
          const payload = toContractPayload(data);

          if (editingContract) {
            await updateContract.mutateAsync({
              id: editingContract.id,
              data: payload,
            });
          } else {
            await createContract.mutateAsync(payload);
          }
        }}
      />
      
      <ContractDetailView
        open={contractDetailOpen}
        onOpenChange={setContractDetailOpen}
        contractId={selectedContractId || undefined}
        onDelete={requestDeleteContract}
        onEdit={startEditingContract}
      />
      
      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        contractId={contractToDelete}
        isDeleting={deleteContract.isPending}
        onDelete={handleDeleteContract}
      />
    </div>
  );
}

// ============================================
// Main Content with Sidebar and Header
// ============================================
function DashboardMainContent({
  children,
  sidebarExpanded,
  setSidebarExpanded,
  isMobile,
  setIsMobile,
  mobileMenuOpen,
  setMobileMenuOpen,
  onAddClick
}: {
  children: React.ReactNode;
  sidebarExpanded: boolean;
  setSidebarExpanded: (v: boolean) => void;
  isMobile: boolean;
  setIsMobile: (v: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  onAddClick: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

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
  }, [setIsMobile, setSidebarExpanded]);

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

  return (
    <div className="flex h-screen relative z-10">
      {/* Sidebar - Desktop */}
      {!isMobile && (
        <DashboardSidebar
          expanded={sidebarExpanded}
          setExpanded={setSidebarExpanded}
          onAddClick={onAddClick}
        />
      )}
      
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && isMobile && (
        <MobileMenu
          onAddClick={onAddClick}
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
        <DashboardHeader
          isMobile={isMobile}
          onMenuClick={() => setMobileMenuOpen(true)}
          onAddClick={onAddClick}
          scrolled={scrolled}
        />
        
        {/* Content Area - Children render here */}
        <div className="main-scroll-container dashboard-scroll flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// ============================================
// Delete Confirmation Dialog
// ============================================
function DeleteConfirmationDialog({
  open,
  onOpenChange,
  contractId,
  isDeleting,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string | null;
  isDeleting: boolean;
  onDelete: () => Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Contract</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this contract? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (event) => {
              event.preventDefault();
              await onDelete();
            }}
            disabled={!contractId || isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
