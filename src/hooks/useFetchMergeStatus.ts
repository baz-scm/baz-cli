import { useState, useEffect, useCallback } from "react";
import { PRContext, MergeStatus } from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/AppModeContext.js";

export function useFetchMergeStatus(ctx: PRContext) {
  const [data, setData] = useState<MergeStatus>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    appMode.mode.dataProvider
      .fetchMergeStatus(ctx)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ctx.prId, ctx.fullRepoName, ctx.prNumber]);

  const updateData = useCallback(
    (updater: (prev: MergeStatus | undefined) => MergeStatus | undefined) => {
      setData(updater);
    },
    [],
  );

  return { data, loading, error, updateData };
}
