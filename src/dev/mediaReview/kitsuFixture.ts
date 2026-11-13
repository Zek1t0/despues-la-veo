import { createKitsuClient } from "../../providers/kitsu/client";

/** Owned TEST records. This injected transport never delegates to fetch or follows a URL. */
export function createReviewKitsuClient(offline: boolean) {
  const records = ["TV", "movie", "OVA", "ONA", "special", "music", "unknown"].map((subtype, index) => ({
    type: "anime", id: String(index + 1), attributes: { canonicalTitle: `TEST Faro de papel · ${subtype}`,
      subtype, startDate: "2020-01-01", synopsis: "Historia sintética original para revisar el flujo Kitsu. Sin datos de catálogo real." },
  }));
  return createKitsuClient({ fetchImplementation: async (url: RequestInfo | URL) => {
    if (offline) throw new Error("TEST offline");
    const parsed = new URL(String(url));
    const id = /\/anime\/([1-9][0-9]*)$/.exec(parsed.pathname)?.[1];
    const query = parsed.searchParams.get("filter[text]")?.toLocaleLowerCase("es") ?? "";
    const selected = id ? records.find(record => record.id === id) : undefined;
    return new Response(JSON.stringify({ data: id ? selected ?? null : records.filter(record => record.attributes.canonicalTitle.toLocaleLowerCase("es").includes(query)) }), {
      status: id && !selected ? 404 : 200, headers: { "Content-Type": "application/vnd.api+json" },
    });
  } });
}
