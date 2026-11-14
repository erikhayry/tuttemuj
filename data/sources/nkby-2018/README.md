# nkby-2018 place data

Copied unchanged from [erikhayry/nkby-2018](https://github.com/erikhayry/nkby-2018/tree/7ee2120cbdd5fe71dd7783f96850419d61d047f8/data)
(commit `7ee2120`, Apache-2.0).

| File | Contents |
| --- | --- |
| `geocoded-locales.json` | Street names, addresses and places with Google-geocoded coordinates |
| `locales.json` | Street names per postcode |
| `areas.json` | Names grouped by type (area, building, village, island, water) |
| `postal-areas.json` | Postal areas in the municipality |

`pnpm --filter @tuttemuj/crawler gazetteer:build` turns these, plus `../manual-places.json`,
into `data/gazetteer.json`.

Known problems: 23 names share one fallback point in the town centre, and `riksväg åtta` was
geocoded near Vaasa. The build drops those points and marks the entries with `missingLocation`
(`geocoder-fallback` or `outside-area`).

## Adding coordinates by hand

Edit `data/sources/manual-places.json` (don't edit these copied files), then rebuild and re-geocode:

```json
{ "name": "torget", "location": { "lat": 63.52, "lng": 22.53 } }
```

```sh
pnpm --filter @tuttemuj/crawler gazetteer:build
pnpm --filter @tuttemuj/crawler places:geocode
```

An entry can also set `kind`, `alternateNames` and `note`, and names that are not in the source are added.
