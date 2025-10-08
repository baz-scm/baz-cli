import { useState, useEffect } from "react";
import { fetchDiscussions, Discussion } from "../lib/clients/baz";

export function useDiscussions(prId: string) {
  const [data, setData] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDiscussions(prId)
      .then((prs) => {
        // discussion with most comments first
        setData(prs.sort((a, b) => b.comments.length - a.comments.length));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
