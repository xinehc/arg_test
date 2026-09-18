import { el } from "./common.mjs?v=code-cleanup-1";
export function showMetadata(profile) {
  const panel = document.getElementById("metadata-panel"),
    status = document.getElementById("metadata-status");
  panel.hidden = false;
  const list = el("dl", "metadata-grid");
  const labels = {
    scientific_name: "Scientific name",
    biome: "Biome",
    geo_loc_name: "Location",
    collection_date: "Collection date",
    lat_lon: "Latitude / longitude",
    published: "Publication date",
    base: "Total bases",
    bases: "Total bases",
    spot: "Total spots",
    spots: "Total spots",
    spot_length: "Spot length",
    platform: "Sequencing platform",
    library_source: "Library source",
    library_selection: "Library selection",
  };
  const hiddenFields = new Set([
    "accession",
    "project",
    "sample",
    "genome",
    "copy",
    "abundance",
    "type",
    "subtype",
  ]);
  const fieldOrder = [
    "scientific_name",
    "biome",
    "collection_date",
    "geo_loc_name",
    "lat_lon",
    "published",
    "base",
    "spot",
    "spot_length",
    "platform",
    "library_source",
    "library_selection",
  ];
  const rank = (name) => {
    const index = fieldOrder.indexOf(name.trim().toLowerCase());
    return index < 0 ? 8.5 : index;
  };
  const metadata = profile.metadata
    .filter(([name]) => !hiddenFields.has(name.trim().toLowerCase()))
    .sort(([a], [b]) => rank(a) - rank(b));
  for (const [name, value] of metadata) {
    const key = name.trim().toLowerCase(),
      raw = value.trim();
    const formatted =
      ["base", "bases", "spot", "spots"].includes(key) && /^\d+$/.test(raw)
        ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        : value;
    const label =
      labels[key] ||
      name
        .trim()
        .replaceAll("_", " ")
        .replace(/^./, (letter) => letter.toUpperCase());
    const item = el("div");
    item.append(
      el("dt", "", label),
      el("dd", "", formatted === "" ? "—" : formatted),
    );
    list.append(item);
  }
  document.getElementById("metadata-fields").replaceChildren(list);
  status.textContent = metadata.length
    ? "Additional fields from this profile, shown as supplied."
    : "No additional metadata fields are available.";
}
