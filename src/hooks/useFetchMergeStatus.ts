import { useState, useEffect } from "react";
import { getDataProvider, PRContext, MergeStatus } from "../lib/providers/index.js";

export function useFetchMergeStatus(ctx: PRContext) {
  const [data, setData] = useState<MergeStatus>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDataProvider()
      .fetchMergeStatus(ctx)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ctx.prId, ctx.repoId, ctx.prNumber]);

  return { data, loading, error };
}
