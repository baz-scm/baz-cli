import { IntegrationProvider } from "../types.js";
import { env } from "../../lib/env-schema.js";
import { fetchOAuthState } from "../../lib/clients/baz.js";

export const linearProvider: IntegrationProvider = {
  type: "linear",
  name: "Linear",
  isImplemented: true,
  integrationConfig: {
    type: "oauth",
    getOAuthUrl: async () => {
      const { state } = await fetchOAuthState("linear");
      const redirectUri = `${env.BAZ_BASE_URL}/settings/linear-callback`;
      const params = new URLSearchParams({
        client_id: env.LINEAR_CLIENT_ID,
        state,
        scope: "read",
        response_type: "code",
        redirect_uri: redirectUri,
      });
      return `https://linear.app/oauth/authorize?${params.toString()}`;
    },
  },
};
