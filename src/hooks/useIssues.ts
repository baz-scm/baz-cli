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
    let cancelled = false;
    
    appMode.mode.dataProvider
      .fetchDiscussions(ctx)
      .then((discussions) => {
        if (!cancelled) {
          const issues: Issue[] = discussions.map((discussion) => ({
            type: "discussion" as const,
            data: discussion,
          }));
          setData(issues);
        }
      })
      .catch((err) => {
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
  }, [ctx.prId, ctx.fullRepoName, ctx.prNumber]);

  return { data, loading, error };
}
