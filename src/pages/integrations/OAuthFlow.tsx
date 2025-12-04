import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { IntegrationType, fetchIntegrations } from "../../lib/clients/baz.js";
import open from "open";

interface OAuthFlowProps {
  providerName: string;
  providerType: IntegrationType;
  getOAuthUrl: () => Promise<string>;
  onComplete: () => void;
}

type FlowStatus =
  | { state: "opening" }
  | { state: "polling" }
  | { state: "success" }
  | { state: "error"; message: string };

const OAuthFlow: React.FC<OAuthFlowProps> = ({
  providerName,
  providerType,
  getOAuthUrl,
  onComplete,
}) => {
  const [status, setStatus] = useState<FlowStatus>({ state: "opening" });

  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | null = null;
    let isMounted = true;

    const startFlow = async () => {
      try {
        const oauthUrl = await getOAuthUrl();
        await open(oauthUrl);

        if (!isMounted) return;
        setStatus({ state: "polling" });

        pollingInterval = setInterval(async () => {
          try {
            const integrations = await fetchIntegrations();
            const hasIntegration = integrations.some(
              (integration) => integration.integrationType === providerType,
            );

            if (hasIntegration && isMounted) {
              if (pollingInterval) clearInterval(pollingInterval);
              setStatus({ state: "success" });
              setTimeout(() => {
                if (isMounted) {
                  onComplete();
                }
              }, 1500);
            }
          } catch (error) {
            console.error("Error polling for integration:", error);
          }
        }, 2500);
      } catch (error) {
        if (isMounted) {
          setStatus({
            state: "error",
            message:
              error instanceof Error ? error.message : "Unknown error occurred",
          });
        }
      }
    };

    startFlow();

    return () => {
      isMounted = false;
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [providerType, getOAuthUrl, onComplete]);

  switch (status.state) {
    case "opening":
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text> Opening browser for {providerName} authentication...</Text>
          </Box>
        </Box>
      );

    case "polling":
      return (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="green">✓ Browser opened</Text>
          </Box>
          <Box>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text> Waiting for {providerName} integration to complete...</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor italic>
              Please complete the authentication in your browser
            </Text>
          </Box>
        </Box>
      );

    case "success":
      return (
        <Box flexDirection="column">
          <Text color="green" bold>
            ✓ {providerName} integration successful!
          </Text>
        </Box>
      );

    case "error":
      return (
        <Box flexDirection="column">
          <Text color="red" bold>
            ✗ Integration failed
          </Text>
          <Text color="red">{status.message}</Text>
          <Box marginTop={1}>
            <Text dimColor italic>
              Press Ctrl+C to exit
            </Text>
          </Box>
        </Box>
      );
  }
};

export default OAuthFlow;
