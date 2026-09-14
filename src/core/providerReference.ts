export type ProviderReference = Readonly<{
  provider: string;
  resourceNamespace: string;
  externalId: string;
}>;

function assertCanonicalToken(value: unknown, field: "provider" | "resourceNamespace"): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error(`${field} debe ser un token canónico no vacío y sin espacios exteriores.`);
  }
  return value;
}

function assertOpaqueExternalId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("externalId debe ser un string opaco no vacío.");
  }
  return value;
}

export function createProviderReference(input: {
  provider: unknown;
  resourceNamespace: unknown;
  externalId: unknown;
}): ProviderReference {
  return Object.freeze({
    provider: assertCanonicalToken(input.provider, "provider"),
    resourceNamespace: assertCanonicalToken(input.resourceNamespace, "resourceNamespace"),
    externalId: assertOpaqueExternalId(input.externalId),
  });
}

export function providerReferencesEqual(
  left: ProviderReference,
  right: ProviderReference
): boolean {
  return left.provider === right.provider &&
    left.resourceNamespace === right.resourceNamespace &&
    left.externalId === right.externalId;
}
