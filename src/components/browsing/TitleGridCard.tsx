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
import type { PersonalRating } from "../../core/personalRating";
import { titleTypeLabel } from "../../core/presentationLabels";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { PersonalRatingBadge } from "./PersonalRatingBadge";
import { PosterPlaceholder } from "./PosterPlaceholder";
import { getPersonalRatingPresentation } from "./personalRatingPresentation";

export type TitleGridCardProps = {
  title: string;
  type: TitleType;
  posterUrl?: string | null;
  onPress: () => void;
  accessibilityLabel: string;
  isPinned?: boolean;
  personalRating?: PersonalRating;
  style?: StyleProp<ViewStyle>;
};

export function TitleGridCard({
  title,
  type,
  posterUrl,
  onPress,
  accessibilityLabel,
  isPinned = false,
  personalRating = null,
  style,
}: TitleGridCardProps) {
  const { theme } = useAppTheme();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [posterUrl]);

  const showImage = Boolean(posterUrl) && !imageFailed;
  const personalRatingPresentation = getPersonalRatingPresentation(personalRating);
  const composedAccessibilityLabel = [
    accessibilityLabel,
    isPinned ? "fijado" : null,
    personalRatingPresentation?.accessibilityLabel ?? null,
  ]
    .filter((part): part is string => part !== null)
    .join(". ");

  return (
    <Pressable
      accessibilityLabel={composedAccessibilityLabel}
      accessibilityRole="button"
      focusable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.global.surfaceSecondary,
          borderColor: theme.global.border,
        },
        style,
        pressed && styles.pressed,
      ]}
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

      <View
        accessible={false}
        pointerEvents="none"
        style={[styles.badge, { backgroundColor: theme.structural.imageOverlayMedium }]}
      >
        <Text style={[styles.badgeText, { color: theme.structural.onImageOverlay }]}>
          {titleTypeLabel(type)}
        </Text>
      </View>

      {isPinned ? (
        <View
          accessible={false}
          pointerEvents="none"
          style={[
            styles.pinBadge,
            {
              backgroundColor: theme.structural.imageOverlayStrong,
              borderColor: theme.structural.imageOverlayBorder,
            },
          ]}
        >
          <Ionicons color={theme.structural.onImageOverlay} name="diamond-outline" size={14} />
        </View>
      ) : null}

      <View
        accessible={false}
        pointerEvents="none"
        style={[
          styles.titleOverlay,
          { backgroundColor: theme.structural.imageOverlay },
        ]}
      >
        <PersonalRatingBadge value={personalRating} style={styles.ratingBadge} />
        <Text
          ellipsizeMode="tail"
          numberOfLines={2}
          style={[styles.title, { color: theme.structural.onImageOverlay }]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 2 / 3,
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
    borderRadius: 999,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
    top: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  pinBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    padding: 6,
    position: "absolute",
    right: 8,
    top: 8,
  },
  titleOverlay: {
    bottom: 0,
    left: 0,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 9,
    position: "absolute",
    right: 0,
    justifyContent: "flex-end",
  },
  ratingBadge: {
    marginBottom: 5,
  },
  title: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 19,
  },
});
