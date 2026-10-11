# CLAUDE.md

Guidance for Claude Code (and any other contributor) working in this repository.

## What this project is

An **external Gladys Assistant integration** for Edmonton public transit
(ETS, Edmonton Transit Service: buses and LRT). It runs as a Docker container
next to a Gladys instance, talks to Gladys through the official SDK
(`@gladysassistant/integration-sdk`), and publishes **read-only** devices:
one per watched stop, one for the line status (LRT Capital, Metro and Valley
lines).

Not affiliated with ETS nor the City of Edmonton. Data: the ETS static GTFS,
GTFS-Realtime TripUpdates and service alerts (City of Edmonton open data,
keyless; the static GTFS ships as a stop table in `gtfs/`), and Transitous
(keyless: the LRT timetable, the direction of the departures, stop
descriptions). **No key anywhere.**

**Inactive shared code.** Edmonton has no docked bike share (`NETWORK.bike` is
null): `src/api/bikes.js` and `src/devices/bikeStation.js` stay, unused, to
keep the code identical to the sister repositories (they are tested in
gladys-translink and gladys-ttc), and so do the `stopFeed` and `lineAlerts`
paths of the TTC and the `tidyAlerts` hook of Calgary.
`NETWORK.realtime.keyless` hides every key setting, button and message.

**Design goal: usable by somebody who is not technical.** Nothing to type to
start: the house location (`location: true`) gives the suggested stops and
stations, there is no key, and the connection status line (`src/status.js`)
always says what to do next. Keep it that way: every new setting needs a
default that works, and every failure a message that says what to do.

**Sister integrations.** `gladys-translink` (Vancouver), `gladys-octranspo`
(Ottawa), `gladys-rtc-quebec` (Québec), `gladys-ttc` (Toronto),
`gladys-calgary-transit` (Calgary) and `gladys-edmonton-transit` (Edmonton)
share this code base, derived from `gladys-stm` (Montréal). Everything that
names the network lives in `src/network.js`, its data in `gtfs/`, its texts
in the manifest and the docs: the rest of the code is identical in the six
repositories, and a fix to it belongs in the six (and in gladys-stm when it
applies there).

## Commands

```bash
npm ci
npm test               # node --test, no framework, no network access
npm run lint           # eslint
npm run format         # prettier --write .
npm run format:check   # what CI checks
npm run update-stops   # regenerate gtfs/ from the ETS static GTFS (network)
npx github:GladysAssistant/integration-store .   # store admission checks
```

Run `npm test`, `npm run lint` and `npm run format:check` before every commit:
CI (`.github/workflows/ci.yml`) runs the three. The CI minutes are counted:
batch the pushes (one push a day at most, unless asked otherwise).

## Layout

```
index.js                      SDK wiring only: handlers, connect, status
src/network.js                the network: operator, feeds, key, lines, bike share
src/config.js                 defaults, type coercion, watch-list mini-syntax, request estimate
src/api/http.js               fetch with timeout and User-Agent
src/api/stops.js              the stop table (gtfs/): code → stop_ids, search, nearby, route labels
src/api/gtfsRealtime.js       minimal GTFS-Realtime decoder (watched stops only; alerts)
src/api/realtime.js           operator feeds (key or open): departures, feed caches, errors
src/api/lines.js              line status from the service alerts (GTFS-RT or translated JSON)
src/api/bikes.js              bike share GBFS client, per-cycle cache, station search
src/api/transitous.js         Transitous: departures of a stop code, descriptions
src/status.js                 the connection status line: what the user must do next
src/devices/index.js          device registry (typed + suggested + created) + manifest actions
src/devices/suggestions.js    the stops and bike stations closest to the house
src/devices/stop.js           one device per watched stop
src/devices/lineStatus.js     the line status device
src/devices/bikeStation.js    one device per watched bike station
src/devices/pollSchedule.js   drops the poll ticks inside the configured interval
src/devices/stateCache.js     drops the states that did not move since the last read
src/devices/publish.js        publishes only to the features the created device has
src/devices/readings.js       last reading per device, shared with the widgets
src/devices/refreshLoop.js    the container's own ticker over the created devices
src/scenes/triggers.js        scene events, computed between two polls of a device
src/scenes/actions.js         scene actions: a fresh read handed to the scene
src/widgets/index.js          dashboard widgets
scripts/update-stops.mjs      generates gtfs/ from the static GTFS (ZIP + CSV, no dependency)
gtfs/                         the stop table, shipped with the image
test/                         node:test suites; helpers: fake SDK, fetch stub, GTFS-RT encoder, fixtures
docs/en.md, docs/fr.md        user documentation (re-hosted by Gladys)
gladys-assistant-integration.json   the store manifest
```

Keep the separation: `index.js` holds no transit logic, `src/api/` only reads
the sources, `src/devices/` only turns a reading into features, `src/scenes/`
and `src/widgets/` only turn a blueprint's `read` into events, outputs and
cards.

## Data sources: what is known and how

- **The feeds** are served by `gtfs.edmonton.ca/TMGTFSRealTimeWebService`
  (`GTFS/gtfs.zip`, `TripUpdate/TripUpdates.pb`, `Alert/Alerts.pb`), keyless.
  They answer HTTP 406 to a strict `Accept: application/x-protobuf` (their
  type is `application/protocol-buffer`): `readFeed` accepts any type.
- **Stop codes**: the number on the sign is the GTFS `stop_code`, equal to the
  `stop_id` for the ETS stops (4 digits, 5 for the LRT platforms). The static
  GTFS is regional: St. Albert, Strathcona County, Spruce Grove, Fort
  Saskatchewan, Beaumont and Leduc list their stops too, behind a letter
  ("A0001", "S1001") and often with the code of an ETS stop.
  `NETWORK.gtfs.keepStop` keeps the stop_ids made of digits only (checked on
  the static GTFS of 2026-10: 5,326 codes). Stations (`Q…`, no code) and
  entrances (`E…`) are left out: an LRT platform is a stop of its own, one per
  direction ("Churchill Station": 18761, 18762). `gtfs/stops.json` holds
  `[code, name, lat, lon, ids, query]`, and a 7th element `1` on the 65 LRT
  platforms (`NETWORK.gtfs.scheduleOnlyRoutes`, see below).
- **Routes**: `route_id` equals the short name, with its zeros ("009" is the
  9, "001A" the 1A); the LRT lines are 021R (short name "Capital"), 022R
  ("Metro") and 023R ("Valley"). The buses of the neighbours calling at ETS
  stops are in the feeds too (St. Albert 201…).
- **Real time**: GTFS-Realtime TripUpdates, ~1.2 MB, buses only: **the LRT is
  not in them** (2026-10), so its platforms read the Transitous timetable
  (`scheduleOnly`). Same stop_ids, trip_ids and route_ids as the static
  GTFS; delays given. A trip on a detour comes twice: as itself, and as a
  TripUpdate whose descriptor has only a `modified_trip` (trip
  modifications, field 7), without a route. The decoder names it by its
  `affected_trip_id`, and `departuresFromFeed` keeps one departure per trip
  and stop. `direction_id` holds odd values (6): unused.
- **The decoder** (`src/api/gtfsRealtime.js`) was cross-checked against the
  official `gtfs-realtime-bindings` 2.2.0 in both directions. Re-run such a
  check if you touch the wire-format code.
- **Line status**: GTFS-Realtime alerts, standard: an effect (mostly DETOUR,
  STOP_MOVED), a severity, an English header. An alert counts for a line when
  it names its route_id (021R, 022R, 023R) without a stop. No LRT alert was
  seen when this was written: check the route_id an LRT alert names when one
  comes.
- **Transitous**: ids are `ca-Edmonton-Transit-Service_<stop_id>`; it has ETS
  real time for the buses (`realTime: true`), the timetable for the LRT.
  Headsigns repeat the route ("9 Southgate"): `tidyHeadsign` drops it.
  Usage policy: open-source non-commercial, User-Agent with a contact, stay
  light — keep the caches and the 120 s floor (`MIN_SCHEDULE_POLL_FREQUENCY`).

## Conventions

- ES modules, Node >= 22, no runtime dependency besides the SDK. Do not add
  one without a strong reason (the 256 MB sandbox is why the GTFS-RT decoder is
  hand-written).
- Prettier decides formatting; ESLint decides the rest.
- Comments explain **why**, in full sentences, in English.
- Every user-visible string in the manifest, actions and widgets is bilingual
  (`{ en, fr }`); text features follow the `language` setting.
- **External ids, feature keys, manifest keys are forever**: Gladys keys the
  devices, their history, the scenes and the dashboards on them. The line ids
  of `src/network.js` (`capital`, `metro`, `valley`) are feature keys.
- **Created devices** are rebuilt from their params (`stop_code`, `routes`,
  `station_id`): never rename those params.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json` / the manifest, nor the `docker_image` tag, by hand.
- **Changelog**: every user-visible change adds a line under
  `## [Unreleased]` in `CHANGELOG.md`.
- **Never commit a personal stop**: use network landmarks in examples and
  tests (stops 1321, 100 Street & 102 Avenue, and 1064, 101 Street & 103
  Avenue; Churchill LRT platforms 18761 and 18762; Churchill Square as the
  house).
- Tests never touch the network: `test/helpers/stubFetch.js` routes `fetch`.
  They do read the real `gtfs/` table: a regeneration that drops a landmark
  shows there.

## Roadmap ideas

- Real time for the LRT, if ETS adds it to the TripUpdates (the platforms
  would leave `scheduleOnlyRoutes`).
- The stops of the regional neighbours (St. Albert, Strathcona County…),
  which the same feeds cover: they would need their own prefix to keep the
  codes apart.
- Winnipeg, with the same code base.
- Ask the Transitous team for an explicit OK before the integration gets many
  users (their policy asks to be contacted for heavy use).
- Screenshots in the user documentation.
