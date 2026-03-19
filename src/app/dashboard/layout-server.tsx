"use client";

import { useState, useEffect } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { MobileMenu } from "@/components/dashboard/mobile-menu";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
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
// Client Component for Interactive Dashboard
// ============================================
function DashboardInteractive({ children }: { children: React.ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  // Handle contract click
  const handleContractClick = (contractId: string) => {
    setSelectedContractId(contractId);
    setContractDetailOpen(true);
  };

  // Handle delete contract
  const handleDeleteContract = () => {
    if (contractToDelete) {
      toast.success("Contract deleted", "The contract has been removed.");
      setDeleteConfirmOpen(false);
      setContractDetailOpen(false);
      setContractToDelete(null);
      // Force re-render of child components
      window.dispatchEvent(new CustomEvent('contracts-updated'));
    }
  };

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
      
      <div className="flex h-screen relative z-10">
        {/* Sidebar - Desktop */}
        {!isMobile && (
          <DashboardSidebar
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
          <DashboardHeader
            isMobile={isMobile}
            onMenuClick={() => setMobileMenuOpen(true)}
            onAddClick={() => setAddContractOpen(true)}
          />
          
          {/* Content Area - Children render here */}
          <div className="main-scroll-container dashboard-scroll flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      
      {/* Modals */}
      <AddContractForm
        open={addContractOpen}
        onOpenChange={setAddContractOpen}
        onSubmit={async (data: ContractFormData) => {
          // FIX #1: Transform Date objects to ISO date strings (YYYY-MM-DD format)
          const payload = {
            ...data,
            startDate: data.startDate?.toISOString().split('T')[0],
            endDate: data.endDate?.toISOString().split('T')[0],
          };

          // FIX #19 & #20: Add retry logic with timeout and exponential backoff
          const maxRetries = 3;
          const timeoutMs = 30000; // 30 seconds
          let lastError: Error | null = null;

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

              const response = await fetch('/api/contracts', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Origin': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
              });

              clearTimeout(timeoutId);

              if (!response.ok) {
                const errorData = await response.json();
                // FIX #3: Add detailed error logging for debugging
                console.error('[Contract Creation] API Error:', {
                  status: response.status,
                  error: errorData,
                  payload,
                  attempt
                });
                
                // Don't retry on 4xx errors (client errors)
                if (response.status >= 400 && response.status < 500) {
                  throw new Error(errorData.error || 'Failed to create contract');
                }
                
                throw new Error(errorData.error || 'Failed to create contract');
              }

              // Success - dispatch event and exit
              window.dispatchEvent(new CustomEvent('contracts-updated'));
              return;
            } catch (error) {
              lastError = error instanceof Error ? error : new Error('Unknown error');
              
              console.warn(`[Contract Creation] Attempt ${attempt} failed:`, {
                error: lastError.message,
                payload
              });
              
              // Don't retry on last attempt
              if (attempt === maxRetries) {
                throw lastError;
              }

              // Don't retry on client errors (4xx)
              if (lastError.message.includes('Failed to create contract') &&
                  !lastError.message.includes('timeout') &&
                  !lastError.message.includes('network')) {
                throw lastError;
              }

              // Wait before retry (exponential backoff: 1s, 2s, 4s)
              const backoffDelay = 1000 * Math.pow(2, attempt - 1);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
          }

          // This should never be reached, but TypeScript needs it
          throw lastError || new Error('Failed to create contract');
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
            <AlertDialogAction onClick={handleDeleteContract} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================
// Server Component Dashboard Layout
// ============================================
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardInteractive>
      {children}
    </DashboardInteractive>
  );
}
