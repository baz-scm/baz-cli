import { useState, useEffect } from "react";
import { fetchSpecReviews, SpecReview } from "../lib/clients/baz.js";

export function useSpecReviews(prId: string) {
  const [data, setData] = useState<SpecReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSpecReviews(prId)
      .then((specReviews) => {
        setData(specReviews);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [prId]);

  return { data, loading, error };
}

