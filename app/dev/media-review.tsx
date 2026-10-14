import React from "react";
import { Text } from "react-native";
import { mediaReviewEnabled } from "../../src/dev/mediaReview/mode";

export default function MediaReviewRoute() {
  if (!mediaReviewEnabled()) return <Text>Revisión de desarrollo no habilitada.</Text>;
  const ReviewRoot = require("../../src/dev/mediaReview/ReviewRoot").default;
  return <ReviewRoot />;
}
