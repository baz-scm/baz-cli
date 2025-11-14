import { useState, useEffect } from "react";
import { fetchPRDetails, PullRequestDetails } from "../lib/clients/baz.js";

export function usePullRequest(prId: string) {
  const [data, setData] = useState<PullRequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPRDetails(prId)
      .then((pr) => {
        setData(pr);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [prId]);

  return { data, loading, error };
}
