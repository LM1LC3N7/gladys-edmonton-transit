// -----------------------------------------------------------------------------
// Configuration: defaults, type coercion, watch-list mini-syntax.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  departuresSource,
  linesEnabled,
  estimatedDailyRequests,
  gladysPollFrequency,
  hasApiKey,
  hasRealtime,
  normalizeConfig,
  parseSimpleEntry,
  parseStopEntry,
  stopPlatformId,
} from '../src/config.js';

test('an empty configuration gets the defaults and watches the lines only', () => {
  const config = normalizeConfig();
  assert.equal(config.departures_poll_frequency, DEFAULT_CONFIG.departures_poll_frequency);
  assert.equal(config.language, 'en');
  // Edmonton has no docked bike share.
  assert.deepEqual(config.watched, { stops: [], bikeStations: [], lines: true });
  assert.equal(hasApiKey(config), false);
  // The ETS feeds are open: real time and line status without any key.
  assert.equal(hasRealtime(config), true);
  assert.equal(departuresSource(config), 'realtime');
  assert.equal(linesEnabled(config), true);
  assert.equal(config.nearby_stops, 3);
  assert.equal(config.nearby_bike_stations, 0);
});

test('the stop syntax: code, route filter, custom name', () => {
  assert.deepEqual(parseStopEntry('0513'), { id: '0513', routes: [], name: null });
  assert.deepEqual(parseStopEntry(' 18761 @ 0523 | capital : Train to work '), {
    id: '18761',
    // "0523" is the 523: leading zeros are dropped.
    routes: ['523', 'CAPITAL'],
    name: 'Train to work',
  });
  // The name may hold an '@': the name is cut first.
  assert.deepEqual(parseStopEntry('18761:Me@home'), {
    id: '18761',
    routes: [],
    name: 'Me@home',
  });
  assert.equal(parseStopEntry('@24'), null);
  assert.deepEqual(parseSimpleEntry('42:Home'), { id: '42', name: 'Home' });
  assert.equal(parseSimpleEntry(' :x'), null);
});

test('lists accept commas, semicolons and new lines, and drop duplicates', () => {
  const config = normalizeConfig({
    stops: '1321;18761@CAPITAL\n1321, 18761@METRO',
    bike_stations: '1, 2',
  });
  assert.deepEqual(config.watched.stops.map(stopPlatformId), [
    '1321',
    '18761@CAPITAL',
    '18761@METRO',
  ]);
  // No docked bike share in Edmonton: the field is ignored.
  assert.deepEqual(config.watched.bikeStations, []);
});

test('numbers, booleans and the language are coerced and bounded', () => {
  const config = normalizeConfig({
    departures_poll_frequency: '5',
    lines_poll_frequency: 'abc',
    bike_poll_frequency: 99999,
    max_departures: '9',
    watch_lines: 'false',
    language: 'de',
    api_key: '  key  ',
  });
  assert.equal(config.departures_poll_frequency, 30);
  assert.equal(config.lines_poll_frequency, DEFAULT_CONFIG.lines_poll_frequency);
  assert.equal(config.bike_poll_frequency, 3600);
  assert.equal(config.max_departures, 5);
  assert.equal(config.watched.lines, false);
  assert.equal(config.language, 'en');
  assert.equal(config.api_key, 'key');
});

test('poll frequencies map onto the values the Gladys scheduler accepts', () => {
  assert.equal(gladysPollFrequency(30), 30_000);
  assert.equal(gladysPollFrequency(60), 60_000);
  assert.equal(gladysPollFrequency(300), 60_000);
});

test('the daily request estimate counts only what a key pays for', () => {
  // The ETS feeds are open: no key, no quota to count against.
  assert.equal(estimatedDailyRequests(normalizeConfig({ stops: '1, 2, 3' })), 0);
  assert.equal(estimatedDailyRequests(normalizeConfig({ api_key: 'k', stops: '1' })), 0);
});

test('the departures source: the open real-time feed, keyed or not', () => {
  assert.equal(departuresSource(normalizeConfig({ schedule_without_key: false })), 'realtime');
  assert.equal(linesEnabled(normalizeConfig({ watch_lines: false })), false);
});

test('the suggestion counts are bounded, 0 turning them off', () => {
  const config = normalizeConfig({ nearby_stops: '0', nearby_bike_stations: 99 });
  assert.equal(config.nearby_stops, 0);
  // No bike share: nothing to suggest, whatever the field says.
  assert.equal(config.nearby_bike_stations, 0);
  assert.equal(normalizeConfig({ nearby_stops: 'x' }).nearby_stops, 3);
});
