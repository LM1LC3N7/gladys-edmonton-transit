// -----------------------------------------------------------------------------
// The transit network this integration serves: Edmonton Transit Service.
//
// Everything that names the operator, its feeds or its lines lives here, so
// the rest of the code reads "the network", "the bike share", "the lines" —
// and the sister integrations (TransLink, OC Transpo, RTC Québec, TTC,
// Calgary Transit) differ from this one by this file, their gtfs/ folder and
// their texts, not by their logic.
// -----------------------------------------------------------------------------

/** The ETS real-time web service serves the static and the real-time feeds. */
const FEEDS = 'https://gtfs.edmonton.ca/TMGTFSRealTimeWebService';

/** The LRT routes: the Capital, Metro and Valley lines. */
const LRT_ROUTES = ['021R', '022R', '023R'];

export const NETWORK = {
  /** The operator, as riders call it. */
  operator: 'ETS',
  /** The device names start with it: "ETS – 100 Street & 102 Avenue". */
  stopPrefix: 'ETS – ',
  /** The language of the texts when the user did not choose one. */
  defaultLanguage: 'en',

  /**
   * The static GTFS the stop table (gtfs/stops.json, gtfs/routes.json) is
   * generated from, by `npm run update-stops`.
   */
  gtfs: {
    url: `${FEEDS}/GTFS/gtfs.zip`,
    stopName: (row) => row.stop_name,
    // The feed is regional: St. Albert, Strathcona County, Fort Saskatchewan…
    // list their stops behind a letter ("A0001", "S1001"), often with the
    // same code as an ETS stop. The ETS stop_ids are digits only.
    keepStop: (row) => /^\d+$/.test(row.stop_id),
    // The LRT is not in the ETS TripUpdates: its platforms read the timetable.
    scheduleOnlyRoutes: LRT_ROUTES,
  },

  /** Transitous ids are the GTFS ids behind this prefix: `ca-Edmonton-Transit-Service_1246`. */
  transitousPrefix: 'ca-Edmonton-Transit-Service_',

  /**
   * The ETS real time, open: no key, no account. The GTFS-Realtime
   * TripUpdates cover the buses (the LRT is not in them) with the stop_ids,
   * trip_ids and route_ids of the static GTFS.
   */
  realtime: {
    keyless: true,
    keyLabel: null,
    portal: 'https://data.edmonton.ca/browse?q=ets',
    tripUpdatesUrl: `${FEEDS}/TripUpdate/TripUpdates.pb`,
    alertsUrl: `${FEEDS}/Alert/Alerts.pb`,
    /**
     * The request of one feed: nothing to add.
     * @param {string} url
     */
    authorize: (url) => ({ url, headers: {} }),
  },

  /**
   * The LRT lines whose alerts make the "lines" device. `routeIds` are the
   * GTFS route_id values. The `id` keys are forever: Gladys keys the
   * features, the history and the scenes on them.
   */
  lines: [
    { id: 'capital', routeIds: ['021R'], name: { en: 'Capital Line', fr: 'Ligne Capital' } },
    { id: 'metro', routeIds: ['022R'], name: { en: 'Metro Line', fr: 'Ligne Metro' } },
    { id: 'valley', routeIds: ['023R'], name: { en: 'Valley Line', fr: 'Ligne Valley' } },
  ],
  /** "LRT" in the device and widget names. */
  linesName: { en: 'LRT', fr: 'SLR' },

  /** Edmonton has no docked bike share. */
  bike: null,

  /** The search example of the "Find a stop" answers: a network landmark. */
  examples: { search: 'Churchill' },
};
