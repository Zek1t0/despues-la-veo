import React, { useEffect, useState } from "react";
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors } from "../../theme/colors";
import { PosterPlaceholder } from "./PosterPlaceholder";

export type TagCollageItem = {
  id: string;
  posterUrl?: string | null;
};

export type TagCollageProps = {
  items: readonly TagCollageItem[];
  style?: StyleProp<ViewStyle>;
};

function isValidPosterUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function CollageCell({ item }: { item?: TagCollageItem }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [item?.id, item?.posterUrl]);

  const posterUrl = item?.posterUrl;
  const showImage = isValidPosterUrl(posterUrl) && !imageFailed;

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      pointerEvents="none"
      style={styles.cell}
    >
      {showImage ? (
        <Image
          accessible={false}
          onError={() => setImageFailed(true)}
          resizeMode="cover"
          source={{ uri: posterUrl }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <PosterPlaceholder style={StyleSheet.absoluteFillObject} />
      )}
    </View>
  );
}

export function TagCollage({ items, style }: TagCollageProps) {
  const cells = Array.from({ length: 4 }, (_, index) => items[index]);

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.collage, style]}
    >
      {cells.map((item, index) => (
        <CollageCell item={item} key={item ? `${item.id}-${item.posterUrl ?? "none"}` : `empty-${index}`} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  collage: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.card2,
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "hidden",
  },
  cell: {
    backgroundColor: colors.card2,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    height: "50%",
    overflow: "hidden",
    position: "relative",
    width: "50%",
  },
});
