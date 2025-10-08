import { useState } from "react";
import { postDiscussionReply, updateDiscussionState } from "../lib/clients/baz";

export function useDiscussionActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replyDiscussion = async (
    discussionId: string,
    replyText: string,
    prId: string,
  ) => {
    setLoading(true);
    try {
      await postDiscussionReply(discussionId, replyText, prId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resolveDiscussion = async (discussionId: string) => {
    setLoading(true);
    try {
      await updateDiscussionState(discussionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { replyDiscussion, resolveDiscussion, loading, error };
}
