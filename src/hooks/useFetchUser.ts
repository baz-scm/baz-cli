import { useEffect, useState } from "react";
import type { User } from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/AppModeContext.js";

export function useFetchUser() {
  const [data, setData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    appMode.mode.dataProvider
      .fetchUser()
      .then((user) => {
        setData({
          login: user.login,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
