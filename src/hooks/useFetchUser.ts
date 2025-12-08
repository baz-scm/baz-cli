import { useEffect, useState } from "react";
import { getDataProvider, User } from "../lib/providers/index.js";

export function useFetchUser() {
  const [data, setData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDataProvider()
      .fetchUser()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
