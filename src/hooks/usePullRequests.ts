import { useState, useEffect, useCallback } from "react";
import { PullRequest } from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/AppModeContext.js";

export function usePullRequests() {
  const [data, setData] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    const fetchPRs = async () => {
      setLoading(true);
      setError(null);
      try {
        const prs = await appMode.mode.dataProvider.fetchPRs();
        setData(prs.sort((a, b) => b.prNumber - a.prNumber));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchPRs();
  }, [appMode.mode.dataProvider]);

  const updateData = useCallback(
    (updater: (prev: PullRequest[]) => PullRequest[]) => {
      setData(updater);
    },
    [],
  );

  return { data, loading, error, updateData };
}
