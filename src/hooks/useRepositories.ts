import { useState, useEffect } from "react";
import { fetchRepositories, Repository } from "../lib/clients/baz.js";

export function useRepositories() {
  const [data, setData] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepositories()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
