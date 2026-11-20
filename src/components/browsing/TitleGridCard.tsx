import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import type { EnrichedMediaMetadata } from "../../core/enrichedMediaMetadata";
import type { PersonalRating } from "../../core/personalRating";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { pressedFeedback, radius, space, type } from "../../theme/presentation";
import { MediaPoster } from "./MediaPoster";
import { PersonalRatingBadge } from "./PersonalRatingBadge";
import { getPersonalRatingPresentation } from "./personalRatingPresentation";

export type TitleGridCardProps = {
  identity?: string;
  imageProvider?: string | null;
  metadata?: EnrichedMediaMetadata;
  title: string;
  kindLabel: string;
  posterUrl?: string | null;
  onPress: () => void;
  accessibilityLabel: string;
  isPinned?: boolean;
  personalRating?: PersonalRating;
  style?: StyleProp<ViewStyle>;
};

export function TitleGridCard({
  identity,
  imageProvider = "tmdb",
  metadata,
  title,
  kindLabel,
  posterUrl,
  onPress,
  accessibilityLabel,
  isPinned = false,
  personalRating = null,
  style,
}: TitleGridCardProps) {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const ratingLabel = getPersonalRatingPresentation(personalRating)?.accessibilityLabel;
  const label = [accessibilityLabel, isPinned ? "fijado" : null, ratingLabel]
    .filter(Boolean)
    .join(". ");

  return (
    <Pressable
      accessible
      accessibilityLabel={label}
      accessibilityRole="button"
      focusable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.global.surface,
          borderColor: focused ? theme.global.accent : theme.global.border,
        },
        style,
        pressed && pressedFeedback,
      ]}
    >
      <View
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.art}
      >
        <MediaPoster
          identity={identity ?? accessibilityLabel}
          imageProvider={imageProvider}
          metadata={metadata}
          posterUrl={posterUrl}
          context="card"
          style={styles.poster}
        />
        <View style={styles.indicators}>
          <Text
            numberOfLines={1}
            style={[
              type.caption,
              styles.kind,
              {
                backgroundColor: theme.structural.imageOverlayLabel,
                color: theme.structural.onImageOverlay,
              },
            ]}
          >
            {kindLabel}
          </Text>
          {isPinned && (
            <View style={[
              styles.pin,
              {
                backgroundColor: theme.structural.imageOverlayStrong,
                borderColor: theme.structural.imageOverlayBorder,
              },
            ]}>
              <Ionicons color={theme.structural.onImageOverlay} name="diamond-outline" size={14} />
            </View>
          )}
        </View>

        <View>
          <PersonalRatingBadge value={personalRating} style={styles.rating} />
          <View style={[styles.caption, { backgroundColor: theme.structural.imageOverlayLabel }]}>
            {/* Let the platform measure two scaled lines using the real title metrics. */}
            <Text style={[styles.titleText, styles.captionMeasure]}>
              {"M\nM"}
            </Text>
            <Text numberOfLines={2} style={[styles.titleText, styles.captionContent, { color: theme.structural.onImageOverlay }]}>
              {title}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: "hidden",
  },
  art: {
    aspectRatio: 2 / 3,
    justifyContent: "space-between",
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0,
  },
  indicators: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.xs,
    justifyContent: "space-between",
    padding: space.sm,
  },
  kind: {
    flexShrink: 1,
    borderRadius: radius.control,
    overflow: "hidden",
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  pin: {
    alignItems: "center",
    borderRadius: radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xs + 2,
  },
  caption: {
    position: "relative",
    paddingVertical: space.xs,
  },
  captionMeasure: {
    opacity: 0,
  },
  captionContent: {
    position: "absolute",
    left: space.sm,
    right: space.sm,
    top: space.xs,
  },
  titleText: {
    ...type.title,
    includeFontPadding: false,
  },
  rating: {
    alignSelf: "flex-end",
    marginRight: space.sm,
    marginBottom: space.xs,
    paddingHorizontal: space.xs,
    paddingVertical: 0,
  },
});
