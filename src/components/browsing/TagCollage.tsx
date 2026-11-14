import { MediaPoster } from "./MediaPoster";
import type { EnrichedMediaMetadata } from "../../core/enrichedMediaMetadata";
import React from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useAppTheme } from "../../theme/AppThemeProvider";

export type TagCollageItem = {
  id: string;
  imageProvider?: string | null;
  metadata?: EnrichedMediaMetadata;
  posterUrl?: string | null;
};

export type TagCollageProps = {
  items: readonly TagCollageItem[];
  style?: StyleProp<ViewStyle>;
};

function CollageCell({
  item,
  surfaceColor,
  borderColor,
}: {
  item?: TagCollageItem;
  surfaceColor: string;
  borderColor: string;
}) {

  const posterUrl = item?.posterUrl;

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      pointerEvents="none"
      style={[
        styles.cell,
        { backgroundColor: surfaceColor, borderColor },
      ]}
    >
      <MediaPoster identity={item?.id ?? "empty"} imageProvider={item?.imageProvider ?? null} metadata={item?.metadata}
        posterUrl={posterUrl} context="card" style={StyleSheet.absoluteFillObject} />
    </View>
  );
}

export function TagCollage({ items, style }: TagCollageProps) {
  const { theme } = useAppTheme();
  const cells = Array.from({ length: 4 }, (_, index) => items[index]);

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.collage,
        { backgroundColor: theme.global.surfaceSecondary },
        style,
      ]}
    >
      {cells.map((item, index) => (
        <CollageCell
          borderColor={theme.global.border}
          item={item}
          key={item ? `${item.id}-${item.posterUrl ?? "none"}` : `empty-${index}`}
          surfaceColor={theme.global.surfaceSecondary}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  collage: {
    aspectRatio: 16 / 9,
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "hidden",
  },
  cell: {
    borderWidth: StyleSheet.hairlineWidth,
    height: "50%",
    overflow: "hidden",
    position: "relative",
    width: "50%",
  },
});
