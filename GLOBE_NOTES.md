# Globe data update

The continent renderer is adapted from the supplied globe-main repository as described in source comments. The map now loads the supplied `locations.tsv` directly, with 13,521 validated rows. Its `biome`, `lat`, `lon`, and `size` columns define color, coordinates, and logarithmic marker area. Every current size is 1. No synthetic location data is used. The three category paths are batched for rendering. The exact raw TSV is included unchanged.
