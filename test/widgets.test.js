// -----------------------------------------------------------------------------
// Dashboard widgets: every content must pass the SDK's own validator (the
// vocabulary and the budget the core enforces), and no failure may reach the
// dashboard as an exception.
// -----------------------------------------------------------------------------

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from './helpers/fakeGladys.js';
import { restoreFetch, stubFetch } from './helpers/stubFetch.js';
import { alertsFeed, lineAlert } from './helpers/fixtures.js';
import { encodeFeed } from './helpers/gtfsRealtimeEncoder.js';
import { normalizeConfig } from '../src/config.js';
import { clearReadings } from '../src/devices/readings.js';
import { clearRealtimeCache } from '../src/api/realtime.js';
import { departuresContent } from '../src/widgets/index.js';
import { truncate, WIDGETS } from '../src/widgets/index.js';
import { NETWORK } from '../src/network.js';

const TRIP_UPDATES_PATH = new URL(NETWORK.realtime.tripUpdatesUrl).pathname;
const ALERTS_PATH = new URL(NETWORK.realtime.alertsUrl).pathname;

const config = normalizeConfig({ stops: '1321', language: 'fr' });

function routes(extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    [TRIP_UPDATES_PATH]: encodeFeed({
      entities: Array.from({ length: 12 }, (_, index) => ({
        tripUpdate: {
          trip: { tripId: `T${index}`, routeId: index % 2 ? '411' : '523' },
          stopTimeUpdates: [
            {
              stopId: '1321',
              departure: { time: now + index * 240, delay: index === 3 ? 600 : 0 },
            },
          ],
        },
      })),
    }),
    [ALERTS_PATH]: alertsFeed([lineAlert('capital', 'Long closure text. '.repeat(40))]),
    ...extra,
  };
}

function assertValid(content) {
  assert.deepEqual(validateWidgetContent(content), []);
}

beforeEach(() => {
  clearReadings();
  clearRealtimeCache();
});
afterEach(() => restoreFetch());

test('the departures board is valid and capped', async () => {
  stubFetch(routes());
  const content = await WIDGETS.departures(createFakeGladys(), {
    settings: { stop: 'transit-stop:1321' },
    config,
  });
  assertValid(content);
  const board = content.components.find((component) => component.type === 'status');
  assert.equal(board.items.length, 8);
  assert.equal(board.items[3].color, 'warning');
});

test('the line card is valid, and truncates a long message to the budget', async () => {
  stubFetch(routes());
  const content = await WIDGETS.line_status(createFakeGladys(), { settings: {}, config });
  assertValid(content);
  const status = content.components.find((component) => component.type === 'status');
  assert.deepEqual(
    status.items.map((item) => item.color),
    ['danger', 'success', 'success'],
  );
  // No bike share in Edmonton: no bike card.
  assert.deepEqual(Object.keys(WIDGETS).sort(), ['departures', 'line_status']);
});

test('failures become a card that says what is wrong', async () => {
  stubFetch(routes({ [TRIP_UPDATES_PATH]: { status: 403, body: '' } }));
  const refused = await WIDGETS.departures(createFakeGladys(), {
    settings: { stop: 'transit-stop:1321' },
    config,
  });
  assertValid(refused);
  // An open feed: nothing about a key.
  assert.match(refused.components[0].text.en, /could not be read right now/);

  const unset = await WIDGETS.departures(createFakeGladys(), { settings: {}, config });
  assertValid(unset);
  assert.match(unset.components[0].text.en, /Choose a stop/);

  const notWatched = await WIDGETS.line_status(createFakeGladys(), {
    settings: {},
    config: normalizeConfig({ watch_lines: false }),
  });
  assert.match(notWatched.components[0].text.fr, /pas surveillées/);
});

test('a slow API gets a loading card rather than a dashboard error', async () => {
  // An answer that comes, but long after the card's deadline.
  globalThis.fetch = () =>
    new Promise((resolve) =>
      setTimeout(() => resolve({ ok: false, status: 503, text: async () => '' }), 100),
    );
  const content = await WIDGETS.departures(
    createFakeGladys(),
    { settings: { stop: 'transit-stop:1321' }, config },
    { deadlineMs: 10 },
  );
  assertValid(content);
  assert.match(content.components[0].text.en, /longer than usual/);
});

test('truncate', () => {
  assert.equal(truncate('abc', 5), 'abc');
  assert.equal(truncate('abcdef', 5), 'abcd…');
});

test('a scheduled board is grey, marked "~", and asks for no key', () => {
  const now = Math.floor(Date.now() / 1000);
  const content = departuresContent('Arrêt', [
    { route: '523', headsign: 'Downtown', minutes: 5, time: now + 300, realtime: false },
  ]);
  assertValid(content);
  const board = content.components.find((component) => component.type === 'status');
  assert.equal(board.items[0].color, 'neutral');
  assert.match(board.items[0].value, /^~5 min$/);
  assert.equal(content.components.at(-1).text.fr, '~ horaire prévu.');
});

test('an empty board says so', () => {
  const content = departuresContent('Arrêt', []);
  assertValid(content);
  assert.match(content.components[1].text.fr, /Aucun passage/);
});
