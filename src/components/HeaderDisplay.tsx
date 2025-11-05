import React from "react";
import { Box, Text } from "ink";
import { MAIN_COLOR } from "../theme/colors.js";

const HeaderDisplay: React.FC = () => (
  <Box
    key="static-header"
    borderColor={MAIN_COLOR}
    borderStyle="round"
    flexDirection="column"
  >
    <Text>Baz CheckOut</Text>
    <Text>Review and approve your CRs with Baz's AI Code Review Agent</Text>
  </Box>
);

export default HeaderDisplay;
