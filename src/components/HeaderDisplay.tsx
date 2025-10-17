import React from "react";
import { Box, Text } from "ink";

const HeaderDisplay: React.FC = () => (
  <Box
    key="static-header"
    borderColor="#191970"
    borderStyle="round"
    flexDirection="column"
  >
    <Text>Baz CheckOut</Text>
    <Text>Review and approve your CRs with Baz's AI Code Review Agent</Text>
  </Box>
);

export default HeaderDisplay;
