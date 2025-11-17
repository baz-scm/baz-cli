import { useEffect, useState } from "react";
import { fetchUser, User } from "../lib/clients/baz.js";

export function useFetchUser() {
  const [data, setData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUser()
      .then((user) => {
        const firstLogin = user.user_logins?.[0];
        setData({
          login: firstLogin?.login,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
