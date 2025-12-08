import { useState, useEffect } from "react";
import { PRContext } from "../lib/providers/index.js";
import { useAppMode } from "../lib/config/AppModeContext.js";
import { Issue } from "../issues/types.js";

export function useIssues(ctx: PRContext) {
  const [data, setData] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appMode = useAppMode();

  useEffect(() => {
    appMode.mode.dataProvider
      .fetchDiscussions(ctx)
      .then((discussions) => {
        const issues: Issue[] = discussions.map((discussion) => ({
          type: "discussion" as const,
          data: discussion,
        }));
        setData(issues);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ctx.prId, ctx.repoId, ctx.prNumber]);

  return { data, loading, error };
}
