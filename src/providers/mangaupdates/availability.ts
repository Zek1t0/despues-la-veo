/** Enable only after the complete physical Android acceptance is recorded in Section 8.3.
 * No environment flag or desktop HTTP result can enable product availability.
 */
export const MANGAUPDATES_ANDROID_VALIDATED: boolean = true;

export function mangaUpdatesAvailability(platform: string) {
  const productionEnabled = platform === "android" && MANGAUPDATES_ANDROID_VALIDATED;
  return Object.freeze({
    productionEnabled,
    reason: productionEnabled ? "native-validated" : platform === "web" ? "browser-cors-blocked" : "native-validation-pending",
  });
}
