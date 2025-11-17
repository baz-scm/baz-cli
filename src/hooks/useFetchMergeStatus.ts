import { useState, useEffect } from "react";
import { fetchMergeStatus, MergeStatus } from "../lib/clients/baz.js";

export function useFetchMergeStatus(prId: string) {
  const [data, setData] = useState<MergeStatus>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMergeStatus(prId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [prId]);

  return { data, loading, error };
}
