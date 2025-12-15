import { useState, useEffect, useCallback } from "react";
import { PRContext, PullRequestDetails } from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/AppModeContext.js";

export function usePullRequest(ctx: PRContext) {
  const [data, setData] = useState<PullRequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pr = await appMode.mode.dataProvider.fetchPRDetails(ctx);
      setData(pr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [ctx.prId, ctx.fullRepoName, ctx.prNumber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const updateData = useCallback(
    (
      updater: (prev: PullRequestDetails | null) => PullRequestDetails | null,
    ) => {
      setData(updater);
    },
    [],
  );

  return { data, loading, error, refetch, updateData };
}