import { DEFAULT_APPEARANCE_PREFERENCE } from "./appearancePreference";
import type { AppearanceCoordinatorState } from "./appearanceCoordinator";
import type { AppearancePreference } from "./types";

export type AppearanceBackupAvailability =
  | Readonly<{ status: "confirmed"; preference: AppearancePreference }>
  | Readonly<{ status: "known-default"; preference: AppearancePreference }>
  | Readonly<{ status: "unavailable"; reason: "pending" | "invalid" | "read-error" }>;

export function getAppearanceBackupAvailability(
  state: Pick<AppearanceCoordinatorState, "confirmedPersisted" | "hydrationStatus">
): AppearanceBackupAvailability {
  if (state.confirmedPersisted) {
    return { status: "confirmed", preference: state.confirmedPersisted };
  }
  if (state.hydrationStatus === "ready") {
    return { status: "known-default", preference: DEFAULT_APPEARANCE_PREFERENCE };
  }
  return {
    status: "unavailable",
    reason: state.hydrationStatus === "invalid"
      ? "invalid"
      : state.hydrationStatus === "error" ? "read-error" : "pending",
  };
}
