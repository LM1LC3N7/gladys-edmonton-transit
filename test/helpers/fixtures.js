// -----------------------------------------------------------------------------
// Payloads shared by the suites. The Transitous ones follow
// api.transitous.org (trimmed to the fields the integration reads); the
// alerts are GTFS-Realtime, encoded by the test encoder.
//
// Stops are network landmarks of the stop table (gtfs/stops.json), where the
// stop code is the stop_id:
//   1321   100 Street & 102 Avenue                 (routes 523, 411)
//   1064   101 Street & 103 Avenue                 (routes 9, 900X)
//   18761  Churchill Station, LRT platform         (timetable only)
//   18762  Churchill Station, the other platform   (timetable only)
// Route ids are the short names with their zeros ("009" is the 9); the LRT
// lines are 021R (Capital), 022R (Metro), 023R (Valley).
// -----------------------------------------------------------------------------

import { NETWORK } from '../../src/network.js';
import { encodeFeed } from './gtfsRealtimeEncoder.js';

// --- Service alerts ------------------------------------------------------------

/** The route_id of a line of NETWORK.lines. */
export const routeOf = (lineId) => NETWORK.lines.find((line) => line.id === lineId).routeIds[0];

/** An alert about a whole line, the way ETS writes them. */
export function lineAlert(
  lineId,
  text = 'Capital Line: no train service between two stations.',
  extra = {},
) {
  return {
    effect: 1, // NO_SERVICE
    severity: 3,
    informedEntities: [{ agencyId: '1', routeId: routeOf(lineId) }],
    headerText: [{ text, language: 'en' }],
    ...extra,
  };
}

/** An alerts feed, encoded. */
export function alertsFeed(alerts = [], timestamp = 1_760_100_000) {
  return encodeFeed({
    timestamp,
    entities: alerts.map((alert, index) => ({ id: `alert-${index}`, alert })),
  });
}

// --- Transitous ---------------------------------------------------------------

/**
 * /v5/stoptimes for one stop: departures `minutes` from `now` (ms). The
 * default route is the 22, leaving from 100 Street & 102 Avenue.
 */
export function stopTimesPayload(now, entries) {
  const iso = (ms) => new Date(ms).toISOString();
  const prefix = NETWORK.transitousPrefix;
  return {
    stopTimes: entries.map(
      (
        {
          minutes,
          routeId = '523',
          shortName = '523',
          headsign = 'Downtown',
          stopId = '1321',
          delayMinutes = 0,
          cancelled = false,
          realTime = false,
          pickupType = 'NORMAL',
        },
        index,
      ) => ({
        place: {
          name: '100 Street & 102 Avenue',
          stopId: `${prefix}${stopId}`,
          departure: iso(now + (minutes + delayMinutes) * 60_000),
          scheduledDeparture: iso(now + minutes * 60_000),
          pickupType,
        },
        realTime,
        headsign,
        tripId: `20261011_04:31_${prefix}T${index}`,
        routeId: `${prefix}${routeId}`,
        routeShortName: shortName,
        cancelled,
        tripCancelled: false,
      }),
    ),
  };
}
