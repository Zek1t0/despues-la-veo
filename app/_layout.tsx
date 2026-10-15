import React from "react";
import { mediaReviewEnabled } from "../src/dev/mediaReview/mode";
import "../global.css";

export default function RootLayout() {
  // Select before importing/mounting personal theme, credentials, tabs or DB bootstrap.
  if (mediaReviewEnabled()) {
    const ReviewRoot = require("../src/dev/mediaReview/ReviewRoot").default;
    return <ReviewRoot />;
  }
  const ProductionRootLayout = require("../src/components/ProductionRootLayout").default;
  return <ProductionRootLayout />;
}
