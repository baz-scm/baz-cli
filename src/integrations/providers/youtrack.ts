import { IntegrationProvider } from "../types.js";

export const youtrackProvider: IntegrationProvider = {
  type: "youtrack",
  name: "YouTrack",
  isImplemented: false,
  integrationConfig: {
    type: "oauth",
    getOAuthUrl: async () => {
      throw new Error("YouTrack integration is not yet implemented");
    },
  },
};
