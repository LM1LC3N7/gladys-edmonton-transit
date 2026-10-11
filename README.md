# Gladys ETS Edmonton

External integration for [Gladys Assistant](https://gladysassistant.com) that
brings Edmonton public transit into your smart home:

- **next ETS departures in real time** for every bus stop, and the timetable
  of the LRT platforms;
- **status of the LRT lines** (Capital, Metro and Valley), from the ETS
  service alerts.

**Nothing to configure, no key, no account:** the integration reads the
location of the house from Gladys and offers the closest stops in the
Discover tab, named the way people know them ("ETS – 100 Street & 102 Avenue
(411 → Downtown | Macewan, 523 → Downtown)").

Unofficial: not affiliated with Edmonton Transit Service nor the City of
Edmonton.

User documentation: [français](docs/fr.md) · [English](docs/en.md).

## What you get in Gladys

| Kind                  | Content                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Devices               | one per stop (minutes to wait, route, summary), one for the LRT (status + message per line) |
| Dashboard widgets     | departures board, LRT line status                                                           |
| Scene triggers        | departure approaching (1–15 min), line disrupted / restored / notice                        |
| Scene actions         | read the next departures of a stop, read the status of a line                               |
| Configuration buttons | find a stop by name                                                                         |

Requires Gladys **5.1.0** or later.

## How it works

- **The stop table** (`gtfs/stops.json`, `gtfs/routes.json`) is generated from
  the ETS static GTFS by `npm run update-stops` and ships with the image. The
  feed is regional: only the ETS stops are kept. It answers the stop search
  and the "near my home" suggestions without any request, and marks the LRT
  platforms, which the real time does not cover.
- **Departures**: the ETS GTFS-Realtime TripUpdates (open, no key), read once
  a minute for every watched stop at once, for the buses;
  [Transitous](https://transitous.org/sources/) (the timetable, every 2
  minutes) for the LRT platforms. Transitous also gives the direction of each
  departure.
- **Line status**: the ETS GTFS-Realtime service alerts.

## Development

```bash
npm install
npm test               # node --test, no network access
npm run lint           # ESLint
npm run format:check   # Prettier, as the CI runs it
npm run update-stops   # regenerate gtfs/ from the ETS static GTFS
npx github:GladysAssistant/integration-store .   # store admission checks
```

The project follows the official
[integration template](https://github.com/GladysAssistant/integration-template-js):
Node 22+, ES modules, the Gladys SDK as the only runtime dependency, a Docker
image published to GHCR by the Release workflow. It shares its code with
[gladys-stm](https://github.com/LM1LC3N7/gladys-stm),
[gladys-translink](https://github.com/LM1LC3N7/gladys-translink),
[gladys-octranspo](https://github.com/LM1LC3N7/gladys-octranspo),
[gladys-rtc-quebec](https://github.com/LM1LC3N7/gladys-rtc-quebec),
[gladys-ttc](https://github.com/LM1LC3N7/gladys-ttc) and
[gladys-calgary-transit](https://github.com/LM1LC3N7/gladys-calgary-transit):
the network lives in `src/network.js`. See [CLAUDE.md](CLAUDE.md) for the
architecture and the conventions.

### Publishing a version

1. In GitHub: **Actions → Release → Run workflow**. Choose **minor** for the
   first release (0.0.0 → 0.1.0), then patch / minor / major. It bumps the
   version everywhere, rolls the changelog, tags, builds the multi-arch image
   (`linux/amd64`, `linux/arm64`) and creates the GitHub Release.
2. The first time only: make the GHCR package **public**
   (`github.com/LM1LC3N7/gladys-edmonton-transit/pkgs/container/gladys-edmonton-transit`
   → Package settings → Change visibility). The store refuses an image it
   cannot pull.
3. Add the topic `gladys-assistant-integration` to the repository: the store
   indexer picks the integration up within the hour.

## Data and licences

- Stop list, real time and alerts: Edmonton Transit Service data published by
  the City of Edmonton, under the
  [City of Edmonton Open Data Terms of Use](https://data.edmonton.ca/stories/s/City-of-Edmonton-Open-Data-Terms-of-Use/msh8-if28).
- LRT timetable and directions: [Transitous](https://transitous.org/sources/)
  (free community service; the integration sends a User-Agent naming it,
  caches every description and never reads departures more than every two
  minutes).
- Code: Apache License 2.0. Parts of `src/devices/` are adapted from
  [prohand/gladys-transport-commun-lyonnais](https://github.com/prohand/gladys-transport-commun-lyonnais)
  (Apache-2.0), see [NOTICE](NOTICE).
