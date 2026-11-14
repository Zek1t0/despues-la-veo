import { Platform } from "react-native";
import { providerImagePolicy, type ImageRuntime } from "../../core/mediaImagePresentation";
export function imageRuntime(): ImageRuntime {
  return { platform: Platform.OS, development: typeof __DEV__ !== "undefined" && __DEV__ };
}
export function imagePolicy(provider: string | null | undefined) { return providerImagePolicy(provider, imageRuntime()); }
