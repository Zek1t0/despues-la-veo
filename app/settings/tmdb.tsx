import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "../../src/theme/colors";
import { useTmdbCredential } from "../../src/providers/tmdb/credential/TmdbCredentialProvider";
import { tmdbCredentialService } from "../../src/providers/tmdb/credential/tmdbCredentialRuntime";
import {
  presentTmdbCredentialStatus,
  presentTmdbDeleteError,
  presentTmdbMutationError,
  TMDB_TOKEN_URL,
  TMDB_WEB_STORAGE_WARNING,
} from "../../src/providers/tmdb/credential/tmdbCredentialUi";

type PendingOperation = "saving" | "deleting" | "retrying-storage" | "opening-link" | null;
type Feedback = Readonly<{ message: string; tone: "success" | "error" }> | null;

function ActionButton({
  label,
  onPress,
  disabled = false,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 13,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: destructive ? colors.dangerBorder : colors.border2,
        backgroundColor: disabled ? "#303030" : destructive ? colors.danger : colors.card2,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

async function confirmCredentialRemoval(): Promise<boolean> {
  const message = "La búsqueda y los datos remotos dejarán de estar disponibles hasta configurar otro token. La Biblioteca local no se elimina.";
  if (Platform.OS === "web") return window.confirm(message);

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    Alert.alert(
      "Eliminar credencial TMDB",
      message,
      [
        { text: "Cancelar", style: "cancel", onPress: () => settle(false) },
        { text: "Eliminar", style: "destructive", onPress: () => settle(true) },
      ],
      { cancelable: true, onDismiss: () => settle(false) },
    );
  });
}

export default function TmdbSettingsScreen() {
  const { snapshot, retryInitialization } = useTmdbCredential();
  const [candidate, setCandidate] = useState("");
  const [hidden, setHidden] = useState(true);
  const [pending, setPending] = useState<PendingOperation>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saveRetryable, setSaveRetryable] = useState(false);
  const mountedRef = useRef(true);
  const operationRef = useRef<PendingOperation>(null);
  const status = presentTmdbCredentialStatus(snapshot);
  const operationPending = pending !== null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const beginOperation = (operation: Exclude<PendingOperation, null>): boolean => {
    if (operationRef.current !== null) return false;
    operationRef.current = operation;
    setPending(operation);
    return true;
  };

  const finishOperation = () => {
    operationRef.current = null;
    if (mountedRef.current) setPending(null);
  };

  const saveCandidate = async () => {
    if (candidate.trim() === "" || snapshot.status === "storage-error") return;
    if (!beginOperation("saving")) return;
    setFeedback(null);
    setSaveRetryable(false);
    try {
      await tmdbCredentialService.save(candidate);
      if (!mountedRef.current) return;
      setCandidate("");
      setFeedback({ message: "Token guardado y comprobado correctamente.", tone: "success" });
    } catch (error) {
      if (!mountedRef.current) return;
      const presented = presentTmdbMutationError(error);
      setSaveRetryable(presented.retryable);
      setFeedback(presented.message ? { message: presented.message, tone: "error" } : null);
    } finally {
      finishOperation();
    }
  };

  const retryStorage = async () => {
    if (!beginOperation("retrying-storage")) return;
    setFeedback(null);
    try {
      await retryInitialization();
    } catch {
      if (mountedRef.current) {
        setFeedback({ message: "Todavía no pudimos acceder a la configuración. Podés volver a reintentar.", tone: "error" });
      }
    } finally {
      finishOperation();
    }
  };

  const openTokenPage = async () => {
    if (!beginOperation("opening-link")) return;
    setFeedback(null);
    try {
      const supported = await Linking.canOpenURL(TMDB_TOKEN_URL);
      if (!supported) throw new Error("unsupported");
      await Linking.openURL(TMDB_TOKEN_URL);
    } catch {
      if (mountedRef.current) {
        setFeedback({ message: "No pudimos abrir la página de TMDB. Intentá nuevamente desde tu navegador.", tone: "error" });
      }
    } finally {
      finishOperation();
    }
  };

  const removeCredential = async () => {
    if (snapshot.status !== "configured" || !beginOperation("deleting")) return;
    if (!(await confirmCredentialRemoval()) || !mountedRef.current) {
      finishOperation();
      return;
    }
    setFeedback(null);
    try {
      await tmdbCredentialService.delete();
      if (!mountedRef.current) return;
      setCandidate("");
      setSaveRetryable(false);
      setFeedback({ message: "La credencial TMDB fue eliminada.", tone: "success" });
    } catch (error) {
      if (!mountedRef.current) return;
      const message = presentTmdbDeleteError(error);
      setFeedback(message ? { message, tone: "error" } : null);
    } finally {
      finishOperation();
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 16, width: "100%", maxWidth: 720, alignSelf: "center" }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.muted, lineHeight: 21 }}>
          La búsqueda y los datos remotos usan TMDB. Tu Biblioteca local continúa funcionando aunque no configures un token.
        </Text>
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontWeight: "700" }}>
          Estado: {status.label}
        </Text>
      </View>

      {Platform.OS === "web" && (
        <View accessibilityRole="alert" style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.danger }}>
          <Text style={{ color: colors.text, lineHeight: 20 }}>{TMDB_WEB_STORAGE_WARNING}</Text>
        </View>
      )}

      {snapshot.status === "storage-error" && (
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.muted }}>No pudimos acceder a la configuración guardada. Esto es distinto de no tener un token configurado.</Text>
          <ActionButton
            label={pending === "retrying-storage" ? "Reintentando acceso..." : "Reintentar acceso a la configuración"}
            onPress={retryStorage}
            disabled={operationPending}
          />
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text nativeID="tmdb-token-label" style={{ color: colors.text, fontWeight: "800" }}>API Read Access Token de TMDB</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}>
          <TextInput
            accessibilityLabel="API Read Access Token de TMDB"
            accessibilityLabelledBy="tmdb-token-label"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!operationPending}
            onChangeText={(value) => {
              if (operationRef.current === null) {
                setCandidate(value);
                setFeedback(null);
                setSaveRetryable(false);
              }
            }}
            onSubmitEditing={() => void saveCandidate()}
            placeholder="Pegá tu token"
            placeholderTextColor={colors.subtle}
            secureTextEntry={hidden}
            value={candidate}
            style={{ flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border2, borderRadius: 12 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Mostrar token" : "Ocultar token"}
            disabled={operationPending}
            onPress={() => setHidden((value) => !value)}
            style={{ minWidth: 88, minHeight: 48, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.border2 }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>{hidden ? "Mostrar" : "Ocultar"}</Text>
          </Pressable>
        </View>
        <Text style={{ color: colors.subtle }}>El token guardado nunca se muestra ni se completa en este campo.</Text>
      </View>

      <ActionButton label={pending === "opening-link" ? "Abriendo TMDB..." : "Obtener token"} onPress={openTokenPage} disabled={operationPending} />
      <ActionButton
        label={pending === "saving" ? "Comprobando..." : saveRetryable ? "Reintentar guardar y comprobar" : "Guardar y comprobar"}
        onPress={saveCandidate}
        disabled={operationPending || candidate.trim() === "" || snapshot.status === "storage-error"}
      />

      {pending === "saving" && (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ color: colors.muted }}>Validando y guardando...</Text>
        </View>
      )}
      {!!feedback && (
        <Text accessibilityRole={feedback.tone === "error" ? "alert" : undefined} accessibilityLiveRegion="polite" style={{ color: feedback.tone === "error" ? "#f4b8b8" : colors.text, lineHeight: 21 }}>
          {feedback.message}
        </Text>
      )}

      {snapshot.status === "configured" && (
        <View style={{ marginTop: 8, gap: 8 }}>
          <Text style={{ color: colors.muted }}>Podés reemplazar la credencial escribiendo una nueva arriba. La actual seguirá activa hasta que la nueva se valide y guarde correctamente.</Text>
          <ActionButton label={pending === "deleting" ? "Eliminando..." : "Eliminar credencial"} onPress={removeCredential} disabled={operationPending} destructive />
        </View>
      )}
    </ScrollView>
  );
}
