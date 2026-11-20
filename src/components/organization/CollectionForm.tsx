import { View } from "react-native";
import { space } from "../../theme/presentation";
import React, { useRef, useState } from "react";
import { OrganizationButton, OrganizationCard, OrganizationInput } from "./OrganizationUI";
import { generateManualEntryIdentity } from "../../core/manualEntryIdentity";
import { createCollection, editCollection } from "../../storage/collectionsRepo";
import type { PersonalCollection } from "../../core/personalCollection";
export function CollectionForm({ collection, busy, run, done }: { collection?: PersonalCollection; busy: boolean; run: (action: () => Promise<void>) => Promise<boolean>; done: () => void }) {
  const [name,setName] = useState(collection?.name ?? ""), [description,setDescription] = useState(collection?.description ?? "");
  const intent = useRef(collection?.id ?? generateManualEntryIdentity().replace(/^manual-/, "collection-"));
  return <OrganizationCard>
    <OrganizationInput label="Nombre de la colección" value={name} onChangeText={setName} editable={!busy} />
    <OrganizationInput label="Descripción (opcional)" value={description} onChangeText={setDescription} multiline editable={!busy} />
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
    <OrganizationButton variant="primary" icon="checkmark-outline" label={busy ? "Guardando…" : collection ? "Guardar cambios" : "Crear colección"} disabled={busy} onPress={() => void (async () => {
      if (await run(() => collection ? editCollection(collection.id,name,description) : createCollection(intent.current,name,description))) { setName(""); setDescription(""); intent.current = generateManualEntryIdentity().replace(/^manual-/, "collection-"); done(); }
    })()} />
    <OrganizationButton variant="quiet" label="Cancelar" disabled={busy} onPress={done} />
    </View>
  </OrganizationCard>;
}
