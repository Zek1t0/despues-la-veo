/** Local development is authorized; public release still requires M/T review.
 * __DEV__ is replaced by Expo for builds, not an EXPO_PUBLIC/environment toggle.
 * Missing runtime marker (including Node regressions) fails closed.
 */
export function kitsuAvailability(platform: string) {
  const developmentEnabled = typeof __DEV__ !== "undefined" && __DEV__ &&
    (platform === "web" || platform === "android");
  return Object.freeze({ enabled: developmentEnabled, developmentEnabled, productionEnabled: false,
    metadata: "pending", technical: "pending", artwork: "omit" } as const);
}
