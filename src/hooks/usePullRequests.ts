import { useState, useEffect } from "react";
import { PullRequest } from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/AppModeContext.js";

export function usePullRequests() {
  const [data, setData] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    appMode.mode.dataProvider
      .fetchPRs()
      .then((prs) => {
        setData(prs.sort((a, b) => b.prNumber - a.prNumber));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
