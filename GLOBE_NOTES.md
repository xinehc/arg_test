# Globe data update

The continent renderer is adapted from the supplied globe-main repository as described in source comments. The map now loads the supplied `locations.tsv` directly, with 13,521 validated rows. Its `biome`, `lat`, `lon`, and `size` columns define color, coordinates, and logarithmic marker area. Every current size is 1. No synthetic location data is used. The three category paths are batched for rendering. The exact raw TSV is included unchanged.

The globe UI no longer shows explicit zoom buttons; wheel and pinch zoom remain available. The continent mask is rendered as translucent, outlined hexagonal cells, and location markers use alpha blending so overlapping samples read as density rather than opaque blobs.
The automatic globe motion now randomizes yaw, pitch, and roll on each page load. All three axes drift at slightly different randomized rates and phases, with a soft pitch bounce near the poles, so the visible path can arc diagonally instead of following a fixed horizontal orbit.
