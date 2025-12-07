import { useState, useEffect } from "react";
import { getDataProvider, PullRequest } from "../lib/providers/index.js";

export function usePullRequests() {
  const [data, setData] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDataProvider()
      .fetchPRs()
      .then((prs) => {
        setData(prs.sort((a, b) => b.prNumber - a.prNumber));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
