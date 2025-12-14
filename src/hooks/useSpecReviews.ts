import { useState, useEffect } from "react";
import { SpecReview } from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/AppModeContext.js";

export function useSpecReviews(prId: string) {
  const [data, setData] = useState<SpecReview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    let cancelled = false;
    
    appMode.mode.dataProvider
      .fetchSpecReviews(prId)
      .then((specReviews) => {
        if (!cancelled) {
          setData(specReviews);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
      
    return () => {
      cancelled = true;
    };
  }, [prId]);

  return { data, loading, error };
}
