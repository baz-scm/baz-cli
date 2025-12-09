import { useState, useEffect } from "react";
import { useAppMode } from "../lib/config/AppModeContext.js";
import type { PRContext, FileDiff } from "../lib/providers/index.js";

export function useFileDiffs(ctx: PRContext, commit: string, files: string[]) {
  const [data, setData] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    appMode.mode.dataProvider
      .fetchFileDiffs(ctx, commit, files)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ctx, commit, files]);

  return { data, loading, error };
}
