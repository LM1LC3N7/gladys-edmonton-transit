# ETS Edmonton

The **next ETS departures** (bus in real time, LRT timetable) and the
**status of the LRT lines** near your home, in Gladys.

This integration is not affiliated with Edmonton Transit Service nor the City
of Edmonton.

## Get started in 3 steps

No technical knowledge is needed, and no account: there is **nothing to
create, no key**.

1. **Check the address of your house in Gladys**: _Settings → Houses_. The
   house must have a position on the map. The integration uses it to find the
   stops near you. The position stays in your Gladys.
2. **Install the integration** from the integration catalog, and accept the
   access to the house location. Open its configuration page and press
   **Save**, without filling anything in.
3. Open the **Discover** tab of the integration. The 3 stops closest to your
   home are offered there, with their name and the direction of their routes,
   e.g. "ETS – 100 Street & 102 Avenue (411 → Downtown | Macewan, 523 →
   Downtown)", as well as the **ETS – LRT** device. Press **Add** on each one
   you want.

That's it. You now get the **next departures** at each stop and the status of
the LRT lines.

The message at the top of the configuration page always tells you what to do
next. For example: "Ready: 3 stops and the lines to add. Open the Discover
tab…".

Device names start with **ETS –**, so they are easy to find in the device
list of Gladys. You can rename them freely in Gladys.

### Showing the departures on the dashboard

1. Open the dashboard, then press **Edit**.
2. Add a widget and choose **ETS departures**.
3. Choose the stop, then save.

The **ETS line status** widget is added the same way.

Departures tracked in real time are green. Scheduled times carry a **~** and
are grey: "~12 min" means "scheduled in 12 minutes".

## Where the departures come from

- **Buses**: the ETS real-time predictions, read every minute for all your
  stops at once.
- **LRT** (Capital, Metro and Valley lines): ETS publishes no prediction for
  them. Their platforms show the **timetable**, through Transitous, a free
  community service, read every 2 minutes. An LRT platform is a stop of its
  own, one per direction ("Churchill Station" has two).

## Watching other stops (work, school…)

For a stop far from home:

1. At the bottom of the configuration page, press **Find a stop**. Type a
   street, a station or the stop number, e.g. "Churchill" or "100 Street 102
   Avenue".
2. The answer lists the stops with their number and the direction of their
   routes, e.g. `1321 — 100 Street & 102 Avenue (411 → Downtown | Macewan,
523 → Downtown)`.
3. Copy the number (`1321`) in **Stops**, save, then add the stop in the
   **Discover** tab.

The number is the one written on every ETS stop sign.

### Going further

The **Stops** field accepts several numbers separated by commas, a route
filter after `@` and a name after `:`.

| Entry                  | Meaning                                |
| ---------------------- | -------------------------------------- |
| `1321`                 | every route calling at stop 1321       |
| `1321@523`             | route 523 only                         |
| `1321@523\|411`        | routes 523 and 411                     |
| `1321@523:Bus to work` | route 523, displayed as "Bus to work"  |
| `18761@Capital`        | the Capital Line at Churchill, one way |

## What each device holds

**Stop:**

- **Next departure**, **Departure 2**…: the minutes to wait. 999 means no
  departure is coming.
- **Next departure route**…: the route ("9", "523", "Capital" for the LRT).
- **Next departures**: a summary, e.g. `523 3 min · 411 11 min`.

**LRT:** for each line (Capital, Metro, Valley), a **status** (`Normal`,
`Disrupted`, `Notice` or `Unknown`) and the **message** of the ETS alert. No
service, reduced service or major delays are a disruption; a detour or any
other announcement is a notice. Elevators and escalators, and the alerts
about a single station, do not change the status of a line.

## Scenes

**Triggers:**

- **Departure approaching**: a departure gets under 1, 2, 3, 5, 10 or 15
  minutes. Example: "when the 523 is 5 minutes away, turn the hall light on".
- **Line status changed**: a line is disrupted, gets back to normal, or
  receives a notice. Example: "if the Capital Line is disrupted, send me a
  message".

**Actions:**

- **Read the next departures**: e.g. a message every morning "Your 523 comes
  in {{minutes}} minutes".
- **Read a line status**: returns the status, the ETS message and `normal`
  (true or false).

## Troubleshooting

| Message or symptom                                | What to do                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| "set the address of your house"                   | _Settings → Houses_: place the house on the map, then save the configuration of the integration again. |
| "Gladys did not share the location of your house" | Reinstall the integration and accept the location access, or type stop numbers.                        |
| Nothing in the Discover tab                       | Read the message of the configuration page: it says what is missing.                                   |
| "Stop … is not in the ETS stop list"              | Check the number on the sign. A brand new stop comes with the next version of the integration.         |
| A stop stays at 999                               | No departure coming (at night), or a route filter matching no route of the stop.                       |
| An LRT platform shows "~" times                   | Normal: ETS publishes no real time for the LRT, the timetable is shown.                                |

## Privacy, data and licences

- The house location is only used to look the nearby stops up, in the stop
  list shipped with the integration: it is sent nowhere.
- Stop list, real time and alerts: ETS data, City of Edmonton open data,
  under the
  [City of Edmonton Open Data Terms of Use](https://data.edmonton.ca/stories/s/City-of-Edmonton-Open-Data-Terms-of-Use/msh8-if28)
  (the stop list is updated with every version).
- LRT timetable and directions: [Transitous](https://transitous.org/sources/),
  a free community service, from the ETS data.
- Integration code: Apache 2.0 licence.
