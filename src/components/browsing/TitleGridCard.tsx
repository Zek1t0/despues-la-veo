import React, { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import type { TitleType } from "../../core/savedTitle";
import { titleTypeLabel } from "../../core/presentationLabels";
import { colors } from "../../theme/colors";
import { PosterPlaceholder } from "./PosterPlaceholder";

export type TitleGridCardProps = {
  title: string;
  type: TitleType;
  posterUrl?: string | null;
  onPress: () => void;
  accessibilityLabel: string;
  isPinned?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function TitleGridCard({
  title,
  type,
  posterUrl,
  onPress,
  accessibilityLabel,
  isPinned = false,
  style,
}: TitleGridCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [posterUrl]);

  const showImage = Boolean(posterUrl) && !imageFailed;

  return (
    <Pressable
      accessibilityLabel={isPinned ? `${accessibilityLabel}, fijado` : accessibilityLabel}
      accessibilityRole="button"
      focusable
      onPress={onPress}
      style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
    >
      {showImage ? (
        <Image
          accessible={false}
          onError={() => setImageFailed(true)}
          resizeMode="cover"
          source={{ uri: posterUrl! }}
          style={styles.poster}
        />
      ) : (
        <PosterPlaceholder style={styles.poster} />
      )}

      <View accessible={false} pointerEvents="none" style={styles.badge}>
        <Text style={styles.badgeText}>{titleTypeLabel(type)}</Text>
      </View>

      {isPinned ? (
        <View accessible={false} pointerEvents="none" style={styles.pinBadge}>
          <Ionicons color={colors.text} name="pin" size={12} />
          <Text numberOfLines={1} style={styles.pinBadgeText}>
            Fijado
          </Text>
        </View>
      ) : null}

      <View accessible={false} pointerEvents="none" style={styles.titleOverlay}>
        <Text ellipsizeMode="tail" numberOfLines={2} style={styles.title}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 2 / 3,
    backgroundColor: colors.card2,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  pressed: {
    opacity: 0.82,
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0,
  },
  badge: {
    backgroundColor: "rgba(11, 11, 11, 0.82)",
    borderRadius: 999,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
    top: 8,
  },
  badgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
  },
  pinBadge: {
    alignItems: "center",
    backgroundColor: "rgba(11, 11, 11, 0.9)",
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 4,
    maxWidth: "52%",
    paddingHorizontal: 7,
    paddingVertical: 4,
    position: "absolute",
    right: 8,
    top: 8,
  },
  pinBadgeText: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "800",
  },
  titleOverlay: {
    backgroundColor: "rgba(11, 11, 11, 0.78)",
    bottom: 0,
    left: 0,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 9,
    position: "absolute",
    right: 0,
    justifyContent: "flex-end",
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 19,
  },
});
