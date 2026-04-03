import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import type { ContractDetail, ContractSummary } from "@/types/contract";
import type { ContractInput } from "@/types/contract";

export interface ContractsResponse {
  contracts: ContractSummary[];
  total: number;
}

interface UseContractsOptions {
  search?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  pagination?: {
    total: number;
  };
  error?: string;
}

async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(input, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }

  return payload as ApiResponse<T>;
}

function sortContractsByEndDate(contracts: ContractSummary[]): ContractSummary[] {
  return [...contracts].sort((left, right) => {
    if (left.endDate && right.endDate) {
      return left.endDate.localeCompare(right.endDate);
    }
    if (left.endDate) {
      return -1;
    }
    if (right.endDate) {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });
}

function getQueryLimit(queryKey: readonly unknown[], fallback: number): number {
  if (queryKey.length >= 3 && typeof queryKey[2] === "number") {
    return queryKey[2];
  }

  return fallback;
}

function getQueryPage(queryKey: readonly unknown[], fallback: number): number {
  if (queryKey.length >= 2 && typeof queryKey[1] === "number") {
    return queryKey[1];
  }

  return fallback;
}

function patchContractsQueries(
  queryClient: QueryClient,
  updater: (
    current: ContractsResponse,
    context: {
      limit: number;
      page: number;
      queryKey: readonly unknown[];
    }
  ) => ContractsResponse
) {
  const queries = queryClient.getQueriesData<ContractsResponse>({
    queryKey: ["contracts"],
  });

  queries.forEach(([queryKey, current]) => {
    if (!current || !Array.isArray(queryKey)) {
      return;
    }

    const limit = getQueryLimit(queryKey, current.contracts.length);
    const page = getQueryPage(queryKey, 1);
    queryClient.setQueryData<ContractsResponse>(
      queryKey,
      updater(current, { limit, page, queryKey })
    );
  });
}

export function useContracts(
  page = 1,
  limit = 50,
  initialData?: ContractsResponse,
  options: UseContractsOptions = {}
) {
  const normalizedSearch = options.search?.trim() ?? "";

  return useQuery({
    queryKey: ["contracts", page, limit, normalizedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (normalizedSearch) {
        params.set("search", normalizedSearch);
      }

      const response = await apiRequest<ContractSummary[]>(
        `/api/contracts?${params.toString()}`
      );

      return {
        contracts: response.data ?? [],
        total: response.pagination?.total ?? (response.data?.length ?? 0),
      };
    },
    initialData,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    meta: {
      subscribeToStore: true,
    },
  });
}

export function useContract(contractId?: string, enabled: boolean = true) {
  const normalizedContractId = contractId ?? "";

  return useQuery({
    queryKey: ["contract", normalizedContractId],
    queryFn: async () => {
      const response = await apiRequest<ContractDetail>(
        `/api/contracts/${normalizedContractId}`
      );

      if (!response.data) {
        throw new Error('Contract not found')
      }

      return response.data;
    },
    enabled: enabled && Boolean(contractId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useMvpStoreSubscription() {
  useEffect(() => undefined, []);
}

export function useCreateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ContractInput) => {
      const response = await apiRequest<ContractDetail>("/api/contracts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.data) {
        throw new Error("Failed to create contract");
      }

      return response.data;
    },
    onSuccess: (data) => {
      patchContractsQueries(queryClient, (current, { limit, page }) => {
        const total = current.total + 1;

        if (page !== 1) {
          return {
            ...current,
            total,
          };
        }

        return {
          ...current,
          contracts: sortContractsByEndDate([
            data,
            ...current.contracts.filter((contract) => contract.id !== data.id),
          ]).slice(0, limit),
          total,
        };
      });

      queryClient.setQueryData<ContractDetail>(["contract", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["contracts"] });

      toast({
        title: "Contract created",
        description: `"${data.name}" has been added to your contracts.`,
      });

      logger.info("Contract created successfully:", data);
    },
    onError: (error: Error) => {
      logger.error("Failed to create contract:", error);
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ContractInput }) => {
      const response = await apiRequest<ContractDetail>(`/api/contracts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });

      if (!response.data) {
        throw new Error("Failed to update contract");
      }

      return response.data;
    },
    onSuccess: (data) => {
      patchContractsQueries(queryClient, (current, { limit }) => {
        const contracts = current.contracts.map((contract) =>
          contract.id === data.id ? { ...contract, ...data } : contract
        );

        return {
          ...current,
          contracts: sortContractsByEndDate(contracts).slice(0, limit),
        };
      });

      queryClient.setQueryData<ContractDetail>(["contract", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract", data.id] });

      toast({
        title: "Contract updated",
        description: `"${data.name}" has been updated.`,
      });

      logger.info("Contract updated successfully:", data);
    },
    onError: (error: Error) => {
      logger.error("Failed to update contract:", error);
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest<null>(`/api/contracts/${id}`, {
        method: "DELETE",
      });

      return id;
    },
    onSuccess: (_, deletedId) => {
      patchContractsQueries(queryClient, (current, { limit }) => ({
        ...current,
        contracts: current.contracts
          .filter((contract) => contract.id !== deletedId)
          .slice(0, limit),
        total: Math.max(0, current.total - 1),
      }));

      queryClient.removeQueries({
        queryKey: ["contract", deletedId],
      });

      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract"] });

      toast({
        title: "Contract deleted",
        description: "The contract has been removed.",
      });

      logger.info("Contract deleted successfully");
    },
    onError: (error: Error) => {
      logger.error("Failed to delete contract:", error);
    },
  });
}
