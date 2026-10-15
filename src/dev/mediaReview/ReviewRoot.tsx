import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppThemeProvider } from "../../theme/AppThemeProvider";
import { createReviewSession, type ReviewSession } from "./session";
import { mediaReviewEnabled } from "./mode";
import { MediaReview } from "./MediaReview";

export default function ReviewRoot() {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!mediaReviewEnabled()) return;
    let active = true, opened: ReviewSession | null = null;
    void createReviewSession({ development: __DEV__, flag: process.env.EXPO_PUBLIC_MEDIA_REVIEW }).then(value => {
      opened = value;
      if (active) setSession(value); else void value.reset();
    }).catch(value => { if (active) setError(String(value)); });
    return () => { active = false; if (opened) void opened.close(); };
  }, [revision]);
  if (!mediaReviewEnabled()) return <Text>Revisión no habilitada.</Text>;
  if (error) return <Text>TEST: no se pudo abrir la sesión. {error}</Text>;
  if (!session) return <View><Text>TEST: abriendo dos bases aisladas…</Text></View>;
  return <SafeAreaProvider>
    <AppThemeProvider persistence={session.themePersistence} fallback={<Text>TEST: tema aislado…</Text>}>
      <MediaReview session={session} onReset={async () => {
        await session.reset(); setSession(null); setRevision(value => value + 1);
      }} />
    </AppThemeProvider>
  </SafeAreaProvider>;
}
