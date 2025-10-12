import { useState, useEffect } from "react";
import { fetchIssues } from "../lib/clients/baz";
import { Issue } from "../issues/types";

export function useIssues(prId: string) {
  const [data, setData] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIssues(prId)
      .then((issues) => {
        setData(issues);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [prId]);

  return { data, loading, error };
}
