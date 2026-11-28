import React from "react";
import { Platform } from "react-native";
import { mediaReviewEnabled } from "../src/dev/mediaReview/mode";
import "../global.css";

export default function RootLayout() {
  // Select before importing/mounting personal theme, credentials, tabs or DB bootstrap.
  if (mediaReviewEnabled()) {
    const ReviewRoot = require("../src/dev/mediaReview/ReviewRoot").default;
    if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.pathname === "/dev/granular-review") {
      if (new URLSearchParams(window.location.search).get("backup")==="1") {
        const BackupReview = require("../src/dev/mediaReview/GranularBackupReview").default;
        return <ReviewRoot><BackupReview /></ReviewRoot>;
      }
      const GranularReview = require("../src/dev/mediaReview/GranularReview").default;
      return <ReviewRoot><GranularReview /></ReviewRoot>;
    }
    return <ReviewRoot />;
  }
  const ProductionRootLayout = require("../src/components/ProductionRootLayout").default;
  return <ProductionRootLayout />;
}
