import { useEffect, useState } from "react";
import {
  type PRContext,
  RepoWriteAccess,
  RepoWriteAccessReason,
} from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/AppModeContext.js";

export function useRepoWriteAccess(ctx: PRContext) {
  const [data, setData] = useState<RepoWriteAccess>({
    hasAccess: false,
    reason: RepoWriteAccessReason.MISSING_USER_INSTALLATION,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    let cancelled = false;

    appMode.mode.dataProvider
      .fetchRepoWriteAccess(ctx)
      .then((access) => {
        if (!cancelled) {
          setData(access);
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
  }, [ctx.fullRepoName]);

  return { data, loading, error };
}
