import { useState, useEffect } from "react";
import { PullRequest } from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/AppModeContext.js";

export function usePullRequests() {
  const [data, setData] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    let cancelled = false;
    
    appMode.mode.dataProvider
      .fetchPRs()
      .then((prs) => {
        if (!cancelled) {
          setData(prs.sort((a, b) => b.prNumber - a.prNumber));
        }
      })
      .catch((err: Error) => {
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
  }, []);

  return { data, loading, error };
}
