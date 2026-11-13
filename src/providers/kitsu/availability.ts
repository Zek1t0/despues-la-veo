/** No environment switch: activation requires reviewed official evidence and platform acceptance. */
export function kitsuAvailability(_platform: string) {
  return Object.freeze({ productionEnabled: false, metadata: "pending", technical: "pending", artwork: "omit" } as const);
}
