import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { ActionPanel, ConfirmAction } from "../../components/ActionPanel";
import { Screen } from "../../components/Screen";
import {
  OrganizationButton, OrganizationCard, OrganizationError, OrganizationInput,
  OrganizationOption, OrganizationStatus, OrganizationText,
} from "../../components/organization/OrganizationUI";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { APPEARANCE_PALETTE_CATALOG } from "../../theme/palettes";
import { space, type } from "../../theme/presentation";
import { WebThemeSynchronizer } from "../../theme/WebThemeSynchronizer";

export function S1Gallery({ onBack }: { onBack?: () => void }) {
  const { theme, preference, setPalette, setScheme } = useAppTheme();
  const [panel, setPanel] = useState<"palette" | "menu" | "confirm" | "delay" | "failure" | null>(null);
  const [selected, setSelected] = useState(true);
  const [feedback, setFeedback] = useState("");
  const paletteTrigger = useRef<View>(null);
  const menuTrigger = useRef<View>(null);
  const confirmTrigger = useRef<View>(null);
  const currentPalette = APPEARANCE_PALETTE_CATALOG.find(palette => palette.id === preference.palette);
  const close = () => setPanel(null);
  const confirmFixture = panel === "delay" || panel === "failure" ? panel : "confirm";
  function confirmExample() {
    if (confirmFixture === "confirm") {
      setFeedback("Ejemplo eliminado.");
      return;
    }
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (confirmFixture === "failure") {
          reject(new Error("Rechazo TEST"));
          return;
        }
        setFeedback("Ejemplo eliminado después de la demora.");
        resolve();
      }, 1800);
    });
  }
  return <Screen topOwner="screen" contentContainerStyle={{ gap: space.xl }}>
    <WebThemeSynchronizer theme={theme} />
    <View style={{ gap: space.sm }}>
      {onBack && <OrganizationButton label="Volver a revisión de medios" variant="quiet" onPress={onBack} />}
      <Text accessibilityRole="header" style={[type.screen, { color: theme.global.textPrimary }]}>TEST · Galería S1</Text>
      <OrganizationText muted>Componentes compartidos de DespuésLaVeo</OrganizationText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <OrganizationButton label="Claro" selected={preference.scheme === "light"} onPress={() => void setScheme("light")} />
        <OrganizationButton label="Oscuro" selected={preference.scheme === "dark"} onPress={() => void setScheme("dark")} />
        <OrganizationButton label="Sistema" selected={preference.scheme === "system"} onPress={() => void setScheme("system")} />
        <OrganizationButton label={`Paleta: ${currentPalette?.displayName}`} expanded={panel === "palette"}
          icon="chevron-down" buttonRef={paletteTrigger} onPress={() => setPanel("palette")} />
      </View>
    </View>
    <OrganizationCard>
      <Text accessibilityRole="header" style={[type.editorial, { color: theme.global.textPrimary }]}>Tu próximo capítulo</Text>
      <OrganizationText heading prominent>Tipografía y superficies</OrganizationText>
      <Text style={[type.body, { color: theme.global.textPrimary }]}>Cuerpo de texto. Las secciones tienen espacio para títulos largos y texto ampliado.</Text>
      <Text style={[type.caption, { color: theme.global.textSecondary, fontWeight: "400" }]}>Metadatos · Anime · 2024</Text>
      <OrganizationCard elevated>
        <OrganizationText muted>Superficie elevada</OrganizationText>
        <OrganizationButton label="Ver opciones de la tarjeta" onPress={() => setFeedback("Opción de tarjeta seleccionada.")} />
      </OrganizationCard>
    </OrganizationCard>
    <View style={{ gap: space.md }}>
      <OrganizationText heading prominent>Acciones y filtros</OrganizationText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <OrganizationButton label="Guardar ejemplo" variant="primary" onPress={() => setFeedback("Ejemplo guardado.")} />
        <OrganizationButton label="Ver detalle" onPress={() => setFeedback("Detalle de ejemplo.")} />
        <OrganizationButton label="Limpiar ejemplo" variant="quiet" onPress={() => setFeedback("")} />
        <OrganizationButton label="Opción no disponible" disabled onPress={() => {}} />
        <OrganizationButton label="En curso" selected={selected} onPress={() => setSelected(!selected)} />
        <OrganizationButton label="Terminados" selected={!selected} onPress={() => setSelected(!selected)} />
        <OrganizationButton label="Más opciones" icon="ellipsis-horizontal" iconOnly
          expanded={panel === "menu"} buttonRef={menuTrigger} onPress={() => setPanel("menu")} />
        <OrganizationButton label="Eliminar ejemplo" variant="danger" buttonRef={confirmTrigger}
          onPress={() => { setFeedback(""); setPanel("confirm"); }} />
      </View>
      {!!feedback && <Text accessibilityLiveRegion="polite" style={[type.body, { color: theme.global.textPrimary }]}>{feedback}</Text>}
    </View>
    <View style={{ gap: space.md }}>
      <OrganizationText heading prominent>Campos</OrganizationText>
      <OrganizationInput label="Título de ejemplo" placeholder="Escribí para revisar el foco" />
      <OrganizationInput label="Título requerido" placeholder="Sin completar" error="Ingresá un título." />
    </View>
    <View style={{ gap: space.lg }}>
      <OrganizationText heading prominent>Estados</OrganizationText>
      <OrganizationStatus kind="loading" title="Cargando títulos…" />
      <OrganizationStatus kind="empty" title="Todavía no hay títulos" detail="Los títulos guardados aparecen acá." />
      <OrganizationError error="No pudimos leer los títulos." retry={() => setFeedback("Lectura de ejemplo reintentada.")} />
      <OrganizationStatus kind="restricted" title="Catálogo no disponible" detail="Esta fuente requiere configuración." />
    </View>
    <ActionPanel title="Elegir paleta" visible={panel === "palette"} onClose={close} triggerRef={paletteTrigger}>
      <View>
        {APPEARANCE_PALETTE_CATALOG.map(palette => <OrganizationOption key={palette.id} label={palette.displayName}
          selected={preference.palette === palette.id} onPress={() => void setPalette(palette.id)} />)}
      </View>
    </ActionPanel>
    <ActionPanel title="Más opciones" visible={panel === "menu"} onClose={close} triggerRef={menuTrigger}>
      <OrganizationText>Acciones contextuales del ejemplo.</OrganizationText>
      <View>
        <OrganizationOption label="Copiar título" icon="copy-outline" onPress={() => { close(); setFeedback("Opción de ejemplo seleccionada."); }} />
        <OrganizationOption label="Probar confirmación demorada" icon="time-outline" onPress={() => setPanel("delay")} />
        <OrganizationOption label="Probar rechazo recuperable" icon="alert-circle-outline" onPress={() => setPanel("failure")} />
      </View>
    </ActionPanel>
    <ConfirmAction title="Confirmar eliminación" message="Se eliminará solo el ejemplo TEST."
      confirmLabel="Confirmar eliminación del ejemplo" visible={panel === "confirm" || panel === "delay" || panel === "failure"} onClose={close}
      triggerRef={confirmFixture === "confirm" ? confirmTrigger : menuTrigger} onConfirm={confirmExample} />
  </Screen>;
}
