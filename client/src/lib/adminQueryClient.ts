import { QueryClient } from "@tanstack/react-query";
import { adminQueryFn } from "@/lib/adminApi";

export const adminQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: adminQueryFn,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});