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
// Server Component Dashboard Layout
// ============================================
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayoutClient>
      {children}
    </DashboardLayoutClient>
  );
}

// ============================================
// Client Component for Interactive Elements
// ============================================
function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <DashboardStateProvider>
      <DashboardUI>
        {children}
      </DashboardUI>
    </DashboardStateProvider>
  );
}

// ============================================
// State Provider
// ============================================
function DashboardStateProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardStateWrapper>{children}</DashboardStateWrapper>
    </>
  );
}

function DashboardStateWrapper({ children }: { children: React.ReactNode }) {
  // This component handles all client-side state
  return <DashboardInteractiveElements>{children}</DashboardInteractiveElements>;
}

// ============================================
// Interactive UI Elements
// ============================================
function DashboardInteractiveElements({ children }: { children: React.ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [addContractOpen, setAddContractOpen] = useState(false);
  const [contractDetailOpen, setContractDetailOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);

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
      
      <DashboardMainContent>
        {children}
      </DashboardMainContent>
      
      <AddContractForm
        open={addContractOpen}
        onOpenChange={setAddContractOpen}
        onSubmit={async (data: ContractFormData) => {
          // FIX: Transform Date objects to ISO date strings (YYYY-MM-DD format)
          const payload = {
            ...data,
            startDate: data.startDate?.toISOString().split('T')[0],
            endDate: data.endDate?.toISOString().split('T')[0],
          };

          // Add retry logic with timeout and exponential backoff
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
                // FIX: Handle empty or malformed responses properly
                const responseText = await response.text();
                let errorMessage = 'Failed to create contract';
                
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

              // Success - dispatch event and exit
              window.dispatchEvent(new CustomEvent('contracts-updated'));
              return;
            } catch (error) {
              lastError = error instanceof Error ? error : new Error('Unknown error');
              
              // Don't retry on last attempt or 4xx errors
              if (attempt === maxRetries) {
                throw lastError;
              }

              // Don't retry on client errors or abort
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

          // This should never be reached
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
      
      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        contractId={contractToDelete}
      />
    </div>
  );
}

function DashboardMainContent({ children }: { children: React.ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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

  return (
    <div className="flex h-screen relative z-10">
      {/* Sidebar - Desktop */}
      {!isMobile && (
        <DashboardSidebar
          expanded={sidebarExpanded}
          setExpanded={setSidebarExpanded}
          onAddClick={() => {}}
        />
      )}
      
      {/* Mobile Menu Overlay */}
      {false && isMobile && (
        <MobileMenu
          onAddClick={() => {}}
          onClose={() => {}}
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
          onMenuClick={() => {}}
          onAddClick={() => {}}
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
function DeleteConfirmationDialog({ open, onOpenChange, contractId }: { open: boolean; onOpenChange: (v: boolean) => void; contractId: string | null }) {
  const handleDelete = () => {
    if (contractId) {
      window.dispatchEvent(new CustomEvent('contracts-updated'));
      onOpenChange(false);
    }
  };

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
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================
// Dashboard UI
// ============================================
function DashboardUI({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      <DashboardSidebar expanded={false} setExpanded={() => {}} />
      <MobileMenu onAddClick={() => {}} onClose={() => {}} />
      
      <main className="flex h-screen relative z-10">
        <DashboardHeader isMobile={false} onMenuClick={() => {}} onAddClick={() => {}} scrolled={false} />
        
        <div className="dashboard-scroll flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
      
      <AddContractForm open={false} onOpenChange={() => {}} />
      <ContractDetailView open={false} onOpenChange={() => {}} />
      <DeleteConfirmationDialog open={false} onOpenChange={() => {}} contractId={null} />
    </div>
  );
}
