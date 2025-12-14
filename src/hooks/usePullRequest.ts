import { useState, useEffect } from "react";
import { PRContext, PullRequestDetails } from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/AppModeContext.js";

export function usePullRequest(ctx: PRContext) {
  const [data, setData] = useState<PullRequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    let cancelled = false;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const pr = await appMode.mode.dataProvider.fetchPRDetails(ctx);
        if (!cancelled) {
          setData(pr);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, [ctx.prId, ctx.fullRepoName, ctx.prNumber]);

  const refetch = async () => {
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
  };

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
