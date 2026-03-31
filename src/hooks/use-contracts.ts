import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import type { ContractDetail, ContractInput, ContractSummary } from "@/types/contract";

export interface ContractsResponse {
  contracts: ContractSummary[];
  total: number;
}

interface UseContractsOptions {
  search?: string;
}

function getOriginHeader(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    Origin: window.location.origin,
  };
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

async function fetchContracts(
  page: number = 1,
  limit: number = 50,
  options: UseContractsOptions = {}
): Promise<ContractsResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const normalizedSearch = options.search?.trim();
  if (normalizedSearch) {
    searchParams.set("search", normalizedSearch);
  }

  const response = await fetch(`/api/contracts?${searchParams.toString()}`, {
    cache: "no-store",
    headers: getOriginHeader(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch contracts');
  }
  
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch contracts');
  }
  
  return {
    contracts: result.data,
    total: result.pagination?.total || 0
  };
}

async function fetchContract(id: string): Promise<ContractDetail> {
  const response = await fetch(`/api/contracts/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Failed to fetch contract"));
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to fetch contract");
  }

  return result.data;
}

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const errorData = await response.json();
    if (typeof errorData?.error === "string") {
      return errorData.error;
    }
  } catch {
    logger.warn("Failed to parse contract API error response");
  }

  return fallback;
}

async function createContract(data: ContractInput): Promise<ContractDetail> {
  // ✅ Dates already formatted as YYYY-MM-DD strings from the caller
  const response = await fetch('/api/contracts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getOriginHeader(),
    },
    body: JSON.stringify(data)  // Pass through directly - dates already in correct format
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to create contract'));
  }

  const result = await response.json();
  return result.data;
}

async function updateContract({
  id,
  data,
}: {
  id: string;
  data: ContractInput;
}): Promise<ContractDetail> {
  const response = await fetch(`/api/contracts/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getOriginHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Failed to update contract"));
  }

  const result = await response.json();
  return result.data;
}

async function deleteContract(id: string): Promise<void> {
  const response = await fetch(`/api/contracts/${id}`, {
    method: "DELETE",
    headers: getOriginHeader(),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Failed to delete contract"));
  }
}

export function useContracts(
  page: number = 1,
  limit: number = 50,
  initialData?: ContractsResponse,
  options: UseContractsOptions = {}
) {
  const normalizedSearch = options.search?.trim() ?? "";

  return useQuery({
    queryKey: ["contracts", page, limit, normalizedSearch],
    queryFn: () => fetchContracts(page, limit, { search: normalizedSearch }),
    initialData,
    staleTime: 1000 * 30, // 30 seconds (reduced from 5 minutes)
  });
}

export function useContract(contractId?: string, enabled: boolean = true) {
  const normalizedContractId = contractId ?? "";

  return useQuery({
    queryKey: ["contract", normalizedContractId],
    queryFn: () => fetchContract(normalizedContractId),
    enabled: enabled && Boolean(contractId),
    staleTime: 1000 * 30,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createContract,
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

      // ✅ Automatic cache invalidation - invalidates ALL matching queries
      queryClient.invalidateQueries({ 
        queryKey: ['contracts']
      });
      
      toast({
        title: "Contract created",
        description: `"${data.name}" has been added to your contracts.`,
      });
      
      logger.info('Contract created successfully:', data);
    },
    onError: (error: Error) => {
      logger.error('Failed to create contract:', error);
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateContract,
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

      queryClient.invalidateQueries({
        queryKey: ["contracts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["contract", data.id],
      });

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
    mutationFn: deleteContract,
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

      queryClient.invalidateQueries({
        queryKey: ["contracts"],
      });
      queryClient.invalidateQueries({
        queryKey: ["contract"],
      });

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
