import React from "react";
import { IntegrationProvider } from "../../integrations/types.js";
import OAuthFlow from "../../pages/integrations/OAuthFlow.js";
import CredentialsFlow from "../../pages/integrations/CredentialsFlow.js";

interface IntegrationFlowProps {
  provider: IntegrationProvider;
  onComplete: () => void;
}

const IntegrationFlow: React.FC<IntegrationFlowProps> = ({
  provider,
  onComplete,
}) => {
  switch (provider.integrationConfig.type) {
    case "oauth":
      return (
        <OAuthFlow
          providerName={provider.name}
          providerType={provider.type}
          getOAuthUrl={provider.integrationConfig.getOAuthUrl}
          onComplete={onComplete}
        />
      );
    case "credentials":
      return (
        <CredentialsFlow providerName={provider.name} onComplete={onComplete} />
      );
  }
};

export default IntegrationFlow;
