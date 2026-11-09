import { useMemo, useState } from "react";

// Every identity/URL transition owns its errors, including A to B to A.
export function usePosterImageError(identity: string | undefined, posterUrl: string | null | undefined) {
  const request = useMemo(() => ({}), [identity, posterUrl]);
  const [state, setState] = useState({ request, failed: false });
  if (state.request !== request) setState({ request, failed: false });
  return {
    imageFailed: state.request === request && state.failed,
    onImageError: () => setState(current =>
      current.request === request ? { request, failed: true } : current),
  };
}
