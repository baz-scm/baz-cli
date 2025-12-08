import { useState, useEffect, useCallback } from "react";
import {
  getDataProvider,
  PRContext,
  PullRequestDetails,
} from "../lib/providers/index.js";

export function usePullRequest(ctx: PRContext) {
  const [data, setData] = useState<PullRequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pr = await getDataProvider().fetchPRDetails(ctx);
      setData(pr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [ctx.prId, ctx.repoId, ctx.prNumber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
