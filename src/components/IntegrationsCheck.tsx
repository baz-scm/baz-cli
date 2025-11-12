import React, { useState } from "react";
import { IntegrationProvider } from "../integrations/types.js";
import { getAllProviders } from "../integrations/registry.js";
import IntegrationPrompt from "./IntegrationPrompt.js";
import ProviderSelector from "./IntegrationProviderSelector.js";
import IntegrationFlow from "./IntegrationFlow.js";

interface IntegrationsCheckProps {
  onComplete: (skipped: boolean) => void;
}

type CheckState =
  | { step: "prompt" }
  | { step: "selectingProvider" }
  | { step: "integrating"; provider: IntegrationProvider }
  | { step: "complete"; skipped: boolean };

const IntegrationsCheck: React.FC<IntegrationsCheckProps> = ({
  onComplete,
}) => {
  const [state, setState] = useState<CheckState>({ step: "prompt" });

  const handlePromptSelect = (shouldIntegrate: boolean) => {
    if (shouldIntegrate) {
      setState({ step: "selectingProvider" });
    } else {
      setState({ step: "complete", skipped: true });
      onComplete(true);
    }
  };

  const handleProviderSelect = (provider: IntegrationProvider) => {
    setState({ step: "integrating", provider });
  };

  const handleIntegrationComplete = (skipped: boolean = false) => {
    setState({ step: "complete", skipped });
    onComplete(skipped);
  };

  switch (state.step) {
    case "prompt":
      return <IntegrationPrompt onSelect={handlePromptSelect} />;

    case "selectingProvider":
      return (
        <ProviderSelector
          providers={getAllProviders()}
          onSelect={handleProviderSelect}
          onSkip={handleIntegrationComplete}
        />
      );

    case "integrating":
      return (
        <IntegrationFlow
          provider={state.provider}
          onComplete={handleIntegrationComplete}
        />
      );

    case "complete":
      return null;
  }
};

export default IntegrationsCheck;
