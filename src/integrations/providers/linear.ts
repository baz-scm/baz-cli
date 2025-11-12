import { IntegrationProvider } from "../types.js";

export const linearProvider: IntegrationProvider = {
  type: "linear",
  name: "Linear",
  isImplemented: false,
  integrationConfig: {
    type: "oauth",
    getOAuthUrl: async () => {
      throw new Error("Linear integration is not yet implemented");
    },
  },
};
