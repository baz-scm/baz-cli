import { useState, useEffect } from "react";
import { fetchPRs, PullRequest } from "../lib/clients/baz.js";

export function usePullRequests(repoId: string) {
  const [data, setData] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPRs(repoId)
      .then((prs) => {
        setData(prs.sort((a, b) => b.prNumber - a.prNumber));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
