"use client";

import * as React from "react";
import { parseDate } from "@/lib/utils/date-utils";
import type { ContractDetail, ContractFormData } from "@/types/contract";

type EditingContractState = {
  id: string;
  formData: ContractFormData;
};

interface DashboardUIContextValue {
  addContractOpen: boolean;
  contractDetailOpen: boolean;
  selectedContractId: string | null;
  editingContract: EditingContractState | null;
  deleteConfirmOpen: boolean;
  contractToDelete: string | null;
  openAddContract: () => void;
  setAddContractOpen: (open: boolean) => void;
  openContractDetail: (contractId: string) => void;
  setContractDetailOpen: (open: boolean) => void;
  startEditingContract: (contract: ContractDetail) => void;
  requestDeleteContract: (contractId: string) => void;
  setDeleteConfirmOpen: (open: boolean) => void;
  clearDeleteRequest: () => void;
  completeDeleteFlow: () => void;
}

const DashboardUIContext = React.createContext<DashboardUIContextValue | null>(
  null
);

function toEditFormData(contract: ContractDetail): ContractFormData {
  return {
    name: contract.name,
    vendor: contract.vendor,
    type: contract.type,
    startDate: parseDate(contract.startDate),
    endDate: parseDate(contract.endDate),
    value: contract.value ?? 0,
    currency: contract.currency || "USD",
    autoRenew: contract.autoRenew ?? false,
    renewalTerms: contract.renewalTerms ?? "",
    notes: contract.notes ?? "",
    tags: contract.tags ?? [],
    vendorContact: contract.vendorContact ?? "",
    vendorEmail: contract.vendorEmail ?? "",
    reminderDays:
      contract.reminderDays && contract.reminderDays.length > 0
        ? contract.reminderDays
        : [30, 14, 7],
    emailReminders: contract.emailReminders ?? true,
    notifyEmails: contract.notifyEmails ?? [],
  };
}

export function DashboardUIProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [addContractOpenState, setAddContractOpenState] = React.useState(false);
  const [contractDetailOpenState, setContractDetailOpenState] =
    React.useState(false);
  const [selectedContractId, setSelectedContractId] = React.useState<string | null>(
    null
  );
  const [editingContract, setEditingContract] =
    React.useState<EditingContractState | null>(null);
  const [deleteConfirmOpenState, setDeleteConfirmOpenState] =
    React.useState(false);
  const [contractToDelete, setContractToDelete] = React.useState<string | null>(
    null
  );

  const openAddContract = React.useCallback(() => {
    setEditingContract(null);
    setAddContractOpenState(true);
  }, []);

  const setAddContractOpen = React.useCallback((open: boolean) => {
    setAddContractOpenState(open);
    if (!open) {
      setEditingContract(null);
    }
  }, []);

  const openContractDetail = React.useCallback((contractId: string) => {
    setSelectedContractId(contractId);
    setContractDetailOpenState(true);
  }, []);

  const setContractDetailOpen = React.useCallback((open: boolean) => {
    setContractDetailOpenState(open);
    if (!open) {
      setSelectedContractId(null);
    }
  }, []);

  const startEditingContract = React.useCallback((contract: ContractDetail) => {
    setEditingContract({
      id: contract.id,
      formData: toEditFormData(contract),
    });
    setContractDetailOpenState(false);
    setSelectedContractId(null);
    setAddContractOpenState(true);
  }, []);

  const requestDeleteContract = React.useCallback((contractId: string) => {
    setContractToDelete(contractId);
    setDeleteConfirmOpenState(true);
  }, []);

  const setDeleteConfirmOpen = React.useCallback((open: boolean) => {
    setDeleteConfirmOpenState(open);
    if (!open) {
      setContractToDelete(null);
    }
  }, []);

  const clearDeleteRequest = React.useCallback(() => {
    setDeleteConfirmOpenState(false);
    setContractToDelete(null);
  }, []);

  const completeDeleteFlow = React.useCallback(() => {
    setDeleteConfirmOpenState(false);
    setContractToDelete(null);
    setContractDetailOpenState(false);
    setSelectedContractId(null);
  }, []);

  const value = React.useMemo<DashboardUIContextValue>(
    () => ({
      addContractOpen: addContractOpenState,
      contractDetailOpen: contractDetailOpenState,
      selectedContractId,
      editingContract,
      deleteConfirmOpen: deleteConfirmOpenState,
      contractToDelete,
      openAddContract,
      setAddContractOpen,
      openContractDetail,
      setContractDetailOpen,
      startEditingContract,
      requestDeleteContract,
      setDeleteConfirmOpen,
      clearDeleteRequest,
      completeDeleteFlow,
    }),
    [
      addContractOpenState,
      clearDeleteRequest,
      completeDeleteFlow,
      contractDetailOpenState,
      contractToDelete,
      deleteConfirmOpenState,
      editingContract,
      openAddContract,
      openContractDetail,
      requestDeleteContract,
      selectedContractId,
      setAddContractOpen,
      setContractDetailOpen,
      setDeleteConfirmOpen,
      startEditingContract,
    ]
  );

  return (
    <DashboardUIContext.Provider value={value}>
      {children}
    </DashboardUIContext.Provider>
  );
}

export function useDashboardUI() {
  const context = React.useContext(DashboardUIContext);

  if (!context) {
    throw new Error("useDashboardUI must be used within DashboardUIProvider");
  }

  return context;
}
