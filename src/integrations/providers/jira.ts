import { IntegrationProvider } from "../types.js";
import { env } from "../../lib/env-schema.js";
import { fetchOAuthState } from "../../lib/clients/baz.js";

export const jiraProvider: IntegrationProvider = {
  type: "jira",
  name: "Jira",
  isImplemented: true,
  integrationConfig: {
    type: "oauth",
    getOAuthUrl: async () => {
      const { state } = await fetchOAuthState("jira");
      const params = new URLSearchParams({
        client_id: env.JIRA_CLIENT_ID,
        state,
        scope: "read:jira-work offline_access",
        audience: "api.atlassian.com",
        response_type: "code",
        prompt: "consent",
      });
      return `https://auth.atlassian.com/authorize?${params.toString()}`;
    },
  },
};
