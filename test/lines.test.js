// -----------------------------------------------------------------------------
// The line status, from the ETS GTFS-Realtime service alerts.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAlert,
  fetchLineStatus,
  isActive,
  LINE_STATUS,
  parseAlerts,
  pickText,
} from '../src/api/lines.js';
import { clearRealtimeCache } from '../src/api/realtime.js';
import { decodeAlerts } from '../src/api/gtfsRealtime.js';
import { normalizeConfig } from '../src/config.js';
import { NETWORK } from '../src/network.js';
import { alertsFeed, lineAlert, routeOf } from './helpers/fixtures.js';
import { restoreFetch, stubFetch } from './helpers/stubFetch.js';

const NOW_MS = 1_760_100_000_000;
const NOW = NOW_MS / 1000;
const ALERTS = new URL(NETWORK.realtime.alertsUrl).pathname;

const statuses = (status) => Object.fromEntries(status.lines.map((line) => [line.id, line.status]));
const read = (alerts, language = 'en') =>
  parseAlerts(decodeAlerts(alertsFeed(alerts)), { language, now: NOW_MS });

beforeEach(() => clearRealtimeCache());
afterEach(() => restoreFetch());

test('no alert: every line runs normally', () => {
  const status = read([]);
  assert.ok(status.lines.every((line) => line.status === LINE_STATUS.NORMAL && !line.message));
  assert.deepEqual(
    status.lines.map((line) => line.id),
    ['capital', 'metro', 'valley'],
  );
});

test('a line alert disrupts its line only, with its message', () => {
  const status = read([lineAlert('capital')], 'fr');
  assert.equal(statuses(status).capital, LINE_STATUS.DISRUPTED);
  assert.equal(statuses(status).metro, LINE_STATUS.NORMAL);
  // No French text: the English one rather than nothing.
  assert.equal(status.lines[0].message, 'Capital Line: no train service between two stations.');
});

test('station, accessibility and future alerts leave the line running', () => {
  const status = read([
    // An elevator: an accessibility issue.
    lineAlert('metro', 'Elevator out of service at Churchill', { effect: 11 }),
    // A platform closed at a station of the line.
    lineAlert('valley', 'Platform closed', {
      effect: 9,
      informedEntities: [{ routeId: routeOf('valley'), stopId: '18761' }],
    }),
    // Next weekend's closure, announced today.
    lineAlert('capital', 'Weekend closure', {
      activePeriods: [{ start: NOW + 86_400 * 5, end: NOW + 86_400 * 6 }],
    }),
  ]);
  assert.ok(status.lines.every((line) => line.status === LINE_STATUS.NORMAL));
});

test('a detour is a notice, the worst status wins, messages of that status only', () => {
  const status = read([
    lineAlert('valley', 'Trains run on a modified schedule.', { effect: 6 }),
    lineAlert('metro', 'Shuttle buses replace trains.', { effect: 4 }),
    lineAlert('metro', 'No service between NAIT and Churchill.'),
  ]);
  assert.equal(statuses(status).valley, LINE_STATUS.NOTICE);
  const metro = status.lines.find((line) => line.id === 'metro');
  assert.equal(metro.status, LINE_STATUS.DISRUPTED);
  assert.equal(metro.message, 'No service between NAIT and Churchill.');
});

test('helpers: texts, periods, effects', () => {
  const texts = [
    { text: 'Hello', language: 'en-CA' },
    { text: 'Bonjour', language: 'fr' },
  ];
  assert.equal(pickText(texts, 'fr'), 'Bonjour');
  assert.equal(pickText(texts, 'en'), 'Hello');
  assert.equal(pickText([{ text: 'Only' }], 'fr'), 'Only');
  assert.equal(pickText(undefined, 'fr'), '');
  assert.equal(isActive({ activePeriods: [] }, NOW), true);
  assert.equal(isActive({ activePeriods: [{ start: NOW - 10 }] }, NOW), true);
  assert.equal(isActive({ activePeriods: [{ end: NOW - 10 }] }, NOW), false);
  assert.equal(classifyAlert({ effect: 3 }), LINE_STATUS.DISRUPTED);
  assert.equal(classifyAlert({ effect: 7, severity: 4 }), LINE_STATUS.DISRUPTED);
  assert.equal(classifyAlert({ effect: 7 }), LINE_STATUS.NOTICE);
});

test('the status is read from the open alerts feed, without a key', async () => {
  const calls = stubFetch({ [ALERTS]: alertsFeed([lineAlert('capital')]) });
  const status = await fetchLineStatus(normalizeConfig(), { now: NOW_MS });
  assert.equal(statuses(status).capital, LINE_STATUS.DISRUPTED);
  assert.equal(calls[0].url, NETWORK.realtime.alertsUrl);
  // ETS refuses a strict protobuf Accept header (HTTP 406).
  assert.match(calls[0].headers.Accept, /\*\/\*/);
});
