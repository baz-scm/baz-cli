import { useState, useEffect } from "react";
import { PRContext, MergeStatus } from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/AppModeContext.js";

export function useFetchMergeStatus(ctx: PRContext) {
  const [data, setData] = useState<MergeStatus>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    let cancelled = false;
    
    appMode.mode.dataProvider
      .fetchMergeStatus(ctx)
      .then((status) => {
        if (!cancelled) {
          setData(status);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
      
    return () => {
      cancelled = true;
    };
  }, [ctx.prId, ctx.fullRepoName, ctx.prNumber]);

  return { data, loading, error };
}
