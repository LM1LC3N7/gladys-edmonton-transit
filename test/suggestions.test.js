// -----------------------------------------------------------------------------
// "Near my home": the stops and stations suggested from the house location,
// and the connection status that tells the user what to do next.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from './helpers/fakeGladys.js';
import { restoreFetch, stubFetch } from './helpers/stubFetch.js';
import { stopTimesPayload } from './helpers/fixtures.js';
import { normalizeConfig } from '../src/config.js';
import {
  clearSuggestions,
  getSuggestions,
  refreshSuggestions,
  suggestedStopLabel,
} from '../src/devices/suggestions.js';
import { buildDiscoveredDevices } from '../src/devices/index.js';
import { clearTransitousCache } from '../src/api/transitous.js';
import { describeStatus, inventory } from '../src/status.js';

function routes() {
  return {
    '/v5/stoptimes': stopTimesPayload(Date.now(), [{ minutes: 3 }, { minutes: 9 }]),
  };
}

beforeEach(() => {
  clearSuggestions();
  clearTransitousCache();
});
afterEach(() => restoreFetch());

test('the closest stops are suggested, named the way people know them', async () => {
  stubFetch(routes());
  const gladys = createFakeGladys();
  const config = normalizeConfig({ nearby_stops: 3, watch_lines: false });

  const found = await refreshSuggestions(gladys, config);

  assert.equal(found.status, 'ok');
  // The LRT platforms of Churchill Station, next to the house.
  assert.deepEqual(
    found.stops.slice(0, 2).map((stop) => stop.id),
    ['18762', '18761'],
  );
  assert.equal(found.stops.length, 3);
  // No docked bike share in Edmonton.
  assert.deepEqual(found.bikeStations, []);

  // Without typing anything, the Discovery screen offers them.
  const names = buildDiscoveredDevices(gladys, config).map((device) => device.name);
  assert.match(names[0], /^ETS – Churchill Station/);
  assert.ok(names.every((name) => name.startsWith('ETS – ')));
});

test('no located house, no permission, nothing wanted: each has its own status', async () => {
  stubFetch(routes());
  const gladys = createFakeGladys();
  const config = normalizeConfig({});

  gladys.houses = [{ id: 'h', name: 'Home', latitude: null, longitude: null }];
  assert.equal((await refreshSuggestions(gladys, config)).status, 'no_location');

  gladys.houses = new Error('HTTP 403');
  assert.equal((await refreshSuggestions(gladys, config)).status, 'no_house');

  const off = normalizeConfig({ nearby_stops: 0, nearby_bike_stations: 0 });
  assert.equal((await refreshSuggestions(gladys, off)).status, 'disabled');
});

test('a house far from the network gets nothing to suggest, without failing', async () => {
  stubFetch(routes());
  const gladys = createFakeGladys();
  gladys.houses = [{ id: 'h', name: 'Cottage', latitude: 51.18, longitude: -115.57 }];
  const found = await refreshSuggestions(gladys, normalizeConfig({}));
  assert.equal(found.status, 'ok');
  assert.deepEqual(getSuggestions().stops, []);
});

test('a name the user typed is never prefixed', async () => {
  stubFetch(routes());
  const gladys = createFakeGladys();
  const config = normalizeConfig({ stops: '1321:My bus, 18761', nearby_stops: 0 });
  await refreshSuggestions(gladys, config);
  assert.deepEqual(
    buildDiscoveredDevices(gladys, config).map((device) => device.name),
    ['ETS – LRT', 'My bus', 'ETS – Churchill Station'],
  );
});

test('a suggested label: the name, then the first routes and their direction', () => {
  assert.equal(suggestedStopLabel({ code: '1', name: 'Main St' }, null), 'Main St');
  assert.equal(suggestedStopLabel({ code: '1', name: '' }, null), '1');
  const busy = {
    name: 'Hub',
    routes: Array.from({ length: 12 }, (_, index) => ({
      route: String(index + 1),
      headsigns: ['Somewhere far away'],
    })),
  };
  const label = suggestedStopLabel({ code: '1', name: 'Hub' }, busy);
  assert.match(label, /^Hub \(1 → Somewhere far away, 2 → Somewhere far away, …\)$/);
});

test('status: nothing found asks to locate the house', async () => {
  stubFetch(routes());
  const gladys = createFakeGladys();
  gladys.houses = [];
  const nothing = normalizeConfig({ watch_lines: false });
  await refreshSuggestions(gladys, nothing);
  const status = describeStatus(gladys, nothing);
  assert.equal(status.connected, false);
  assert.match(status.message.fr, /Paramètres → Maisons/);

  // The line device needs no house: it is offered, and the house still asked for.
  const lines = describeStatus(gladys, normalizeConfig({}));
  assert.equal(lines.connected, true);
  assert.match(lines.message.en, /^Ready: the lines to add\..*Settings → Houses/);
});

test('status: devices waiting point to the Discovery tab, no key to ask for', async () => {
  stubFetch(routes());
  const gladys = createFakeGladys();
  const config = normalizeConfig({ nearby_stops: 2 });
  await refreshSuggestions(gladys, config);

  const status = describeStatus(gladys, config);
  assert.equal(status.connected, true);
  assert.equal(
    status.message.fr,
    'Prêt : 2 arrêts et les lignes à ajouter. Ouvrez l’onglet « Découverte » de cette ' +
      'intégration et cliquez sur « Ajouter ».',
  );
});

test('status: once everything is added, what is watched (no quota to count)', async () => {
  stubFetch(routes());
  const gladys = createFakeGladys();
  const config = normalizeConfig({ nearby_stops: 1 });
  await refreshSuggestions(gladys, config);
  gladys.devices = buildDiscoveredDevices(gladys, config);

  const status = describeStatus(gladys, config);
  assert.equal(status.message.en, 'Connected. Watching 1 stop and the lines.');
});

test('status: the open feed never waits for a key', () => {
  const config = normalizeConfig({ stops: '1321', schedule_without_key: false });
  const status = describeStatus(createFakeGladys(), config);
  assert.equal(status.connected, true);
  assert.doesNotMatch(status.message.en, /key/);
});

test('inventory', () => {
  assert.deepEqual(inventory({ stops: 3, stations: 0, lines: false }), {
    en: '3 stops',
    fr: '3 arrêts',
  });
  assert.deepEqual(inventory({ stops: 1, stations: 0, lines: true }), {
    en: '1 stop and the lines',
    fr: '1 arrêt et les lignes',
  });
});
