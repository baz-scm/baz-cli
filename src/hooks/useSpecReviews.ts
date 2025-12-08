import { useState, useEffect } from "react";
import { SpecReview } from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/AppModeContext.js";

export function useSpecReviews(prId: string) {
  const [data, setData] = useState<SpecReview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    appMode.mode.dataProvider
      .fetchSpecReviews(prId)
      .then((specReviews) => {
        setData(specReviews);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [prId]);

  return { data, loading, error };
}
