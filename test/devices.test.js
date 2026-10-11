// -----------------------------------------------------------------------------
// Devices: discovery payloads, polling, publication, manifest actions.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from './helpers/fakeGladys.js';
import { restoreFetch, stubFetch } from './helpers/stubFetch.js';
import { alertsFeed, lineAlert, stopTimesPayload } from './helpers/fixtures.js';
import { encodeFeed } from './helpers/gtfsRealtimeEncoder.js';
import { GLADYS_POLL_FREQUENCIES_MS, normalizeConfig } from '../src/config.js';
import {
  ACTIONS,
  buildBlueprints,
  buildDiscoveredDevices,
  findSelectedBlueprint,
  DeviceSelectionError,
  pollDevice,
  refreshDeviceNow,
} from '../src/devices/index.js';
import { NO_DEPARTURE_MINUTES } from '../src/devices/stop.js';
import { clearPollSchedule } from '../src/devices/pollSchedule.js';
import { clearStateCache } from '../src/devices/stateCache.js';
import { clearPublishReports } from '../src/devices/publish.js';
import { clearReadings } from '../src/devices/readings.js';
import { clearSceneMemory } from '../src/scenes/triggers.js';
import { clearRealtimeCache } from '../src/api/realtime.js';
import { clearTransitousCache } from '../src/api/transitous.js';
import { clearSuggestions } from '../src/devices/suggestions.js';
import { NETWORK } from '../src/network.js';

const TRIP_UPDATES = new URL(NETWORK.realtime.tripUpdatesUrl).pathname;
const ALERTS = new URL(NETWORK.realtime.alertsUrl).pathname;

// No key: the ETS feeds are open.
const config = normalizeConfig({
  stops: '1321, 18761@CAPITAL:Train to work',
  max_departures: 2,
  language: 'fr',
});

function tripFeed(nowSeconds) {
  return encodeFeed({
    timestamp: nowSeconds,
    entities: [
      {
        tripUpdate: {
          trip: { tripId: 'T1', routeId: '523' },
          stopTimeUpdates: [{ stopId: '1321', departure: { time: nowSeconds + 185 } }],
        },
      },
    ],
  });
}

const lrt = {
  stopId: '18761',
  routeId: '021R',
  shortName: 'Capital',
  headsign: 'Century Park',
};

function routes(extra = {}) {
  return {
    [TRIP_UPDATES]: tripFeed(Math.floor(Date.now() / 1000)),
    [ALERTS]: alertsFeed([]),
    // The LRT platforms read the Transitous timetable.
    '/v5/stoptimes': stopTimesPayload(Date.now(), [{ minutes: 5, ...lrt }]),
    ...extra,
  };
}

beforeEach(() => {
  clearPollSchedule();
  clearStateCache();
  clearPublishReports();
  clearReadings();
  clearSceneMemory();
  clearRealtimeCache();
  clearTransitousCache();
  clearSuggestions();
});
afterEach(() => restoreFetch());

test('one device per watched stop, plus the lines, and no bike device in Edmonton', () => {
  const gladys = createFakeGladys();
  const devices = buildDiscoveredDevices(
    gladys,
    normalizeConfig({ ...config, bike_stations: '1' }),
  );
  assert.deepEqual(
    devices.map((device) => device.name),
    ['ETS – SLR', 'ETS – 100 Street & 102 Avenue', 'Train to work'],
  );
  assert.deepEqual(
    devices.map((device) => device.external_id),
    ['transit-lines:network', 'transit-stop:1321', 'transit-stop:18761@CAPITAL'],
  );
});

test('every discovery payload is one the core accepts', () => {
  const gladys = createFakeGladys();
  for (const device of buildDiscoveredDevices(gladys, config)) {
    assert.ok(GLADYS_POLL_FREQUENCIES_MS.includes(device.poll_frequency), device.name);
    assert.equal(device.should_poll, true, `${device.name} must be scheduled by the core`);
    const ids = new Set();
    for (const feature of device.features) {
      // t_device_feature.min / max are NOT NULL in the core.
      assert.equal(typeof feature.min, 'number', `${feature.name} needs a min`);
      assert.equal(typeof feature.max, 'number', `${feature.name} needs a max`);
      assert.equal(feature.read_only, true);
      assert.ok(!ids.has(feature.external_id), `duplicate feature ${feature.external_id}`);
      ids.add(feature.external_id);
    }
  }
  // 2 departures x (minutes + route) + summary.
  assert.equal(buildDiscoveredDevices(gladys, config)[1].features.length, 5);
});

test('feature names follow the configured language', () => {
  const gladys = createFakeGladys();
  const [, stop] = buildDiscoveredDevices(gladys, normalizeConfig({ ...config, language: 'en' }));
  assert.equal(stop.features[0].name, 'Next departure');
  const [, arret] = buildDiscoveredDevices(gladys, config);
  assert.equal(arret.features[0].name, 'Prochain passage');
});

test('polling a stop publishes the board, and the sentinel for missing departures', async () => {
  stubFetch(routes());
  const gladys = createFakeGladys();
  await pollDevice(gladys, { external_id: 'transit-stop:1321' }, config);

  const byFeature = Object.fromEntries(
    gladys.published.map((state) => [state.featureExternalId, state.state ?? state.text]),
  );
  assert.equal(byFeature['transit-stop:1321:departure_1'], 3);
  assert.equal(byFeature['transit-stop:1321:departure_1_route'], '523');
  assert.equal(byFeature['transit-stop:1321:departure_2'], NO_DEPARTURE_MINUTES);
  assert.equal(byFeature['transit-stop:1321:departure_2_route'], '');
  assert.equal(byFeature['transit-stop:1321:departures'], '523 3 min');
});

test('polling the lines publishes a status and a message per line', async () => {
  stubFetch(routes({ [ALERTS]: alertsFeed([lineAlert('capital')]) }));
  const gladys = createFakeGladys();
  await pollDevice(gladys, { external_id: 'transit-lines:network' }, config);

  const byFeature = Object.fromEntries(
    gladys.published.map((state) => [state.featureExternalId, state.text]),
  );
  assert.equal(byFeature['transit-lines:network:line_metro_status'], 'Normal');
  assert.equal(byFeature['transit-lines:network:line_capital_status'], 'Perturbé');
  assert.equal(
    byFeature['transit-lines:network:line_capital_message'],
    'Capital Line: no train service between two stations.',
  );
});

test('the ticks inside the refresh interval do not read the API again', async () => {
  const calls = stubFetch(routes());
  const gladys = createFakeGladys();
  await pollDevice(gladys, { external_id: 'transit-stop:1321' }, config);
  await pollDevice(gladys, { external_id: 'transit-stop:1321' }, config);
  assert.equal(calls.length, 1);

  // A device just created is read right away, whole.
  clearRealtimeCache();
  const before = gladys.published.length;
  await refreshDeviceNow(gladys, { external_id: 'transit-stop:1321' }, config);
  assert.equal(calls.length, 2);
  assert.equal(gladys.published.length - before, 5);
});

test('unchanged values are not published twice', async () => {
  stubFetch(routes());
  const gladys = createFakeGladys();
  await pollDevice(gladys, { external_id: 'transit-stop:18761@CAPITAL' }, config);
  clearPollSchedule();
  clearRealtimeCache();
  const before = gladys.published.length;
  await pollDevice(gladys, { external_id: 'transit-stop:18761@CAPITAL' }, config);
  assert.equal(gladys.published.length, before);
});

test('a device removed from the configuration is ignored', async () => {
  const calls = stubFetch({});
  await pollDevice(createFakeGladys(), { external_id: 'transit-stop:00000' }, config);
  assert.equal(calls.length, 0);
});

test('an LRT platform shows the timetable, marked as scheduled, every 2 minutes at most', async () => {
  const calls = stubFetch({
    '/v5/stoptimes': stopTimesPayload(Date.now(), [
      { minutes: 4, ...lrt },
      { minutes: 12, ...lrt },
    ]),
  });
  const gladys = createFakeGladys();
  const platform = normalizeConfig({ stops: '18761', max_departures: 2, watch_lines: false });

  const [stop] = buildDiscoveredDevices(gladys, platform);
  assert.equal(stop.poll_frequency, 60_000);
  assert.equal(buildBlueprints(gladys, platform)[0].pollIntervalMs(platform), 120_000);

  await pollDevice(gladys, { external_id: 'transit-stop:18761' }, platform);
  const summary = gladys.published.find((state) => state.featureExternalId.endsWith(':departures'));
  assert.match(summary.text, /^Capital ~[34] min · Capital ~1[12] min$/);
  // The ETS real time has no LRT: it is not even read.
  assert.ok(calls.every((call) => !call.url.includes('TripUpdates')));

  // A bus stop next to it keeps the real time.
  const bus = normalizeConfig({ stops: '1321', watch_lines: false });
  assert.equal(buildBlueprints(gladys, bus)[0].pollIntervalMs(bus), 60_000);
});

test('a stop code missing from the stop table says so', async () => {
  const unknown = normalizeConfig({ stops: '99999', watch_lines: false });
  const [blueprint] = buildBlueprints(createFakeGladys(), unknown);
  await assert.rejects(blueprint.read(unknown), (err) =>
    /n’est pas dans la liste des arrêts ETS/.test(err.userMessage.fr),
  );
});

test('a widget pointing at nothing gets an explanation', () => {
  const gladys = createFakeGladys();
  assert.throws(
    () => findSelectedBlueprint(gladys, '', config, 'transit-stop'),
    (err) => err instanceof DeviceSelectionError && /Choose a stop/.test(err.userMessage.en),
  );
});

test('an open feed has no key to test: no such button', () => {
  assert.equal(ACTIONS.test_api_key, undefined);
  assert.equal(ACTIONS.search_bike_stations, undefined);
  assert.equal(typeof ACTIONS.search_stops, 'function');
});

test('the lines are not built when they are not watched', () => {
  const blueprints = buildBlueprints(
    createFakeGladys(),
    normalizeConfig({ watch_lines: false, stops: '1321' }),
  );
  assert.deepEqual(
    blueprints.map((blueprint) => blueprint.type),
    ['transit-stop'],
  );
});

test('a created device keeps refreshing once it is neither typed nor suggested', async () => {
  stubFetch(routes());
  const gladys = createFakeGladys();
  const empty = normalizeConfig({ watch_lines: false });
  gladys.devices = [
    {
      external_id: 'transit-stop:1321@523',
      name: 'Bus to work',
      params: [
        { name: 'stop_code', value: '1321' },
        { name: 'routes', value: '523' },
      ],
    },
  ];
  assert.deepEqual(
    buildDiscoveredDevices(gladys, empty).map((device) => device.external_id),
    ['transit-stop:1321@523'],
  );
  // Not in the configuration, yet decoded: its board is not empty.
  await pollDevice(gladys, { external_id: 'transit-stop:1321@523' }, empty);
  const first = gladys.published.find((state) => state.featureExternalId.endsWith(':departure_1'));
  assert.equal(first.state, 3);
});

test('the real time needs no key, is read every minute, and cannot be turned off', async () => {
  const calls = stubFetch(routes());
  const gladys = createFakeGladys();
  const off = normalizeConfig({ stops: '1321', schedule_without_key: false, watch_lines: false });
  const [stop] = buildDiscoveredDevices(gladys, off);
  assert.equal(stop.poll_frequency, 60_000);
  const [blueprint] = buildBlueprints(gladys, off);
  assert.equal(blueprint.pollIntervalMs(off), 60_000);
  const board = await blueprint.read(off);
  assert.equal(board[0].route, '523');
  assert.equal(board[0].realtime, true);
  // Transitous is not asked for the board.
  assert.ok(calls.every((call) => !call.url.includes('/v5/stoptimes')));
});

test('search_stops lists the codes with the directions of their routes', async () => {
  stubFetch({ '/v5/stoptimes': stopTimesPayload(Date.now(), [{ minutes: 3 }]) });
  const message = await ACTIONS.search_stops(createFakeGladys(), {
    fields: { query: '100 street 102 avenue' },
    config,
  });
  assert.match(message.fr, /^Collez un code dans « Arrêts »/);
  assert.match(message.fr, /1321 — 100 Street & 102 Avenue \(523 → Downtown\)/);
});

test('search_stops still lists the stops when Transitous does not answer', async () => {
  stubFetch({ '/v5/stoptimes': { status: 503, body: '' } });
  const message = await ACTIONS.search_stops(createFakeGladys(), {
    fields: { query: '1321' },
    config,
  });
  assert.match(message.en, /^1321 — 100 Street & 102 Avenue$/m);
  const none = await ACTIONS.search_stops(createFakeGladys(), {
    fields: { query: 'zzzz qqqq' },
    config,
  });
  assert.match(none.en, /No ETS stop matches/);
});
