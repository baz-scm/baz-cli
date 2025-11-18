import { useState, useEffect, useCallback } from "react";
import { fetchPRDetails, PullRequestDetails } from "../lib/clients/baz.js";

export function usePullRequest(prId: string) {
  const [data, setData] = useState<PullRequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pr = await fetchPRDetails(prId);
      setData(pr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [prId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
