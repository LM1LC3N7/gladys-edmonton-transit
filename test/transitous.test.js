// -----------------------------------------------------------------------------
// Transitous client: departures of a stop code, route labels, descriptions.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearTransitousCache,
  describeStop,
  formatRoutes,
  gtfsId,
  knownStop,
  scheduledDepartures,
  stopTimes,
  tidyHeadsign,
  TransitousError,
} from '../src/api/transitous.js';
import { distanceMeters } from '../src/api/stops.js';
import { stopTimesPayload } from './helpers/fixtures.js';
import { restoreFetch, stubFetch } from './helpers/stubFetch.js';

const HOME = { lat: 53.544, lon: -113.489 };
const NOW = Date.UTC(2026, 9, 11, 16, 0, 0);

beforeEach(() => clearTransitousCache());
afterEach(() => restoreFetch());

test('Transitous ids give back the GTFS ids', () => {
  assert.equal(gtfsId('ca-Edmonton-Transit-Service_18761'), '18761');
  assert.equal(gtfsId('20261011_08:32_ca-Edmonton-Transit-Service_76051039'), '76051039');
  assert.equal(gtfsId(undefined), '');
});

test('a stop code is asked by its GTFS id, with a User-Agent', async () => {
  const calls = stubFetch({ '/v5/stoptimes': stopTimesPayload(NOW, [{ minutes: 3 }]) });
  await stopTimes('1321');
  assert.match(calls[0].url, /stopId=ca-Edmonton-Transit-Service_1321&n=10/);
  assert.match(calls[0].headers['User-Agent'], /^gladys-edmonton-transit\/.*github\.com/);
  // An LRT platform is asked for itself.
  await stopTimes('18761');
  assert.match(calls[1].url, /stopId=ca-Edmonton-Transit-Service_18761&n=10/);
  await assert.rejects(stopTimes('00000'), TransitousError);
});

test('the departures: route labels from the table, other bays and termini dropped', async () => {
  stubFetch({
    '/v5/stoptimes': stopTimesPayload(NOW, [
      { minutes: 3 },
      {
        minutes: 7,
        routeId: '411',
        shortName: '411',
        headsign: 'Downtown | Macewan',
        delayMinutes: 2,
      },
      // Transitous may answer for a group of stops: the other side of the
      // street is another sign.
      { minutes: 8, stopId: '5833' },
      { minutes: 9, cancelled: true },
      { minutes: 10, pickupType: 'NOT_ALLOWED' },
      // A route the table does not know: the short name, without its zeros.
      {
        minutes: 11,
        routeId: 'new',
        shortName: '0R5',
        headsign: 'Mount Royal U',
        realTime: true,
      },
    ]),
  });
  const departures = await stopTimes('1321');
  assert.deepEqual(
    departures.map(({ route, headsign, delaySeconds, realtime }) => [
      route,
      headsign,
      delaySeconds,
      realtime,
    ]),
    [
      ['523', 'Downtown', 0, false],
      ['411', 'Downtown | Macewan', 120, false],
      ['R5', 'Mount Royal U', 0, true],
    ],
  );
});

test('headsigns lose the route they repeat', () => {
  assert.equal(tidyHeadsign('3 Main/To Marine Dr Station', '3'), 'Main/To Marine Dr Station');
  assert.equal(tidyHeadsign('Canada Line To YVR-Airport', 'Canada Line'), 'YVR-Airport');
  assert.equal(tidyHeadsign('Mount Royal U', '99'), 'Mount Royal U');
  assert.equal(tidyHeadsign('99', '99'), '99');
  assert.equal(tidyHeadsign('Hospital ~ Hôpital', '45'), 'Hospital / Hôpital');
  assert.equal(tidyHeadsign('East - 114 Queens Quay East towards Carlaw', '114'), 'Carlaw');
  // ETS repeats the route: "9 Southgate". Capitals stay (no title casing).
  assert.equal(tidyHeadsign('9 Southgate', '9'), 'Southgate');
  assert.equal(tidyHeadsign('900X Lewis Farms Super Express', '900X'), 'Lewis Farms Super Express');
  assert.equal(tidyHeadsign('UBC', '99'), 'UBC');
});

test('scheduled departures have the shape of the real-time board', async () => {
  stubFetch({
    '/v5/stoptimes': stopTimesPayload(NOW, [
      { minutes: -5 },
      { minutes: 4, routeId: '411', shortName: '411', headsign: 'Downtown | Macewan' },
      { minutes: 2 },
    ]),
  });
  const board = await scheduledDepartures({ id: '1321', routes: [] }, { now: NOW });
  assert.deepEqual(
    board.map(({ route, minutes, realtime, headsign }) => [route, minutes, realtime, headsign]),
    [
      ['523', 2, false, 'Downtown'],
      ['411', 4, false, 'Downtown | Macewan'],
    ],
  );
  const filtered = await scheduledDepartures({ id: '1321', routes: ['411'] }, { now: NOW });
  assert.deepEqual(
    filtered.map((departure) => departure.route),
    ['411'],
  );
});

test('a stop description is cached for a day, and survives a failed refresh', async () => {
  const calls = stubFetch({
    '/v5/stoptimes': stopTimesPayload(NOW, [
      { minutes: 1, routeId: '411', shortName: '411', headsign: 'Downtown | Macewan' },
      { minutes: 2 },
      { minutes: 3 },
    ]),
  });
  const description = await describeStop('1321', { now: NOW });
  assert.equal(formatRoutes(description), '411 → Downtown | Macewan, 523 → Downtown');
  assert.equal(description.name, '100 Street & 102 Avenue');
  // The trips seen at the stop name the route of a bare real-time prediction.
  assert.deepEqual(description.trips.get('T0'), { route: '411', headsign: 'Downtown | Macewan' });
  await describeStop('1321', { now: NOW + 3_600_000 });
  assert.equal(calls.length, 1);
  assert.equal(knownStop('1321'), description);

  restoreFetch();
  stubFetch({ '/v5/stoptimes': { status: 503, body: 'down' } });
  const stale = await describeStop('1321', { now: NOW + 2 * 86_400_000 });
  assert.equal(stale, description);
  assert.equal(await describeStop('00000', { now: NOW }), null);
});

test('a route serving both directions lists both', async () => {
  stubFetch({
    '/v5/stoptimes': stopTimesPayload(NOW, [
      { minutes: 1, headsign: 'West' },
      { minutes: 2, headsign: 'East' },
      { minutes: 3, headsign: 'West' },
    ]),
  });
  assert.equal(formatRoutes(await describeStop('1321', { now: NOW })), '523 → West/East');
});

test('distances', () => {
  assert.equal(distanceMeters(HOME, HOME), 0);
  const oneKmNorth = { lat: HOME.lat + 1 / 111.2, lon: HOME.lon };
  assert.ok(Math.abs(distanceMeters(HOME, oneKmNorth) - 1000) < 5);
});
