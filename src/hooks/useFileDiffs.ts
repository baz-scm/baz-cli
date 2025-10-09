import { useState, useEffect } from "react";
import { fetchFileDiffs, FileDiff } from "../lib/clients/baz";

export function useFileDiffs(prId: string, commit: string, files: string[]) {
  const [data, setData] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFileDiffs(prId, commit, files)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
