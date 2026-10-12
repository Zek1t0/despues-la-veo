import { useEffect, useRef, useState } from "react";
import type { ProviderSearchResult } from "../../providers/providerContracts";
import type { ResolvedSearchCategory, SearchCategoryId, SearchSource } from "./searchCategories";

export type SearchRequestScope = Readonly<{
  query: string;
  category: SearchCategoryId;
  source: SearchSource;
  retry: number;
  configurationGeneration?: number;
}>;
export type SearchRequestIdentity = SearchRequestScope & Readonly<{ sequence: number }>;

export function sameSearchScope(a: SearchRequestScope | null, b: SearchRequestScope | null): boolean {
  return a !== null && b !== null && a.query === b.query && a.category === b.category &&
    a.source === b.source && a.retry === b.retry && a.configurationGeneration === b.configurationGeneration;
}

export function sameSearchRequest(a: SearchRequestIdentity | null, b: SearchRequestIdentity | null): boolean {
  return sameSearchScope(a, b) && a?.sequence === b?.sequence;
}

type SearchState = Readonly<{
  identity: SearchRequestIdentity | null;
  items: readonly ProviderSearchResult[];
  loading: boolean;
  error: unknown;
}>;
const EMPTY: SearchState = { identity: null, items: [], loading: false, error: null };

/** UI lifecycle only. No provider credentials, error ontology, or network registry. */
export function useCategorySearch(input: Readonly<{
  query: string;
  selected: ResolvedSearchCategory | null;
  ready: boolean;
  retry: number;
  tmdbGeneration?: number;
}>) {
  const query = input.query.trim();
  const [debounced, setDebounced] = useState("");
  const [state, setState] = useState<SearchState>(EMPTY);
  const sequence = useRef(0);
  const active = useRef<SearchRequestIdentity | null>(null);
  const category = input.selected?.category.id;
  const source = input.selected?.category.source;
  const capability = input.selected?.capability;
  // This exception belongs only to TMDB, never to credential-free sources.
  const generation = source === "tmdb" ? input.tmdbGeneration : undefined;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const requestSequence = ++sequence.current;
    active.current = null;
    setState(EMPTY);
    if (!query || query !== debounced || !input.ready || !category || !source || !capability) return;
    const identity: SearchRequestIdentity = {
      query, category, source, retry: input.retry, sequence: requestSequence,
      ...(source === "tmdb" ? { configurationGeneration: generation } : {}),
    };
    active.current = identity;
    let live = true;
    const isCurrent = () => live && sameSearchRequest(identity, active.current);
    setState({ identity, items: [], loading: true, error: null });
    void (async () => {
      try {
        const items = await capability.search(query);
        if (isCurrent()) setState({ identity, items, loading: false, error: null });
      } catch (error) {
        if (isCurrent()) setState({ identity, items: [], loading: false, error });
      }
    })();
    return () => { live = false; active.current = null; };
  }, [query, debounced, category, source, capability, input.ready, input.retry, generation]);

  const scope: SearchRequestScope | null = category && source ? {
    query, category, source, retry: input.retry,
    ...(source === "tmdb" ? { configurationGeneration: generation } : {}),
  } : null;
  // Hide stale data during render, before effect cleanup, including category/config changes.
  const visible = Boolean(query && query === debounced && input.ready && sameSearchScope(state.identity, scope));
  return { ...(visible ? state : EMPTY), debounceSettled: query === debounced, query };
}
