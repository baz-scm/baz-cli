import { useState, useEffect } from "react";
import {
  fetchLatestConversation,
  LatestConversation,
} from "../lib/clients/baz.js";
import { IssueType } from "../models/chat.js";

export function useLatestConversation(
  prId: string,
  conversationType: IssueType,
) {
  const [data, setData] = useState<LatestConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestConversation(prId, conversationType)
      .then((conversation) => {
        setData(conversation);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [prId, conversationType]);

  return { data, loading, error };
}
