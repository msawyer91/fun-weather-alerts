# Fun Weather Alerts

A custom Home Assistant dashboard card for displaying active weather
alerts --- with a little personality when the weather is behaving
itself.

When an optional NWS Alerts entity reports active alerts, the card
displays an alert banner that opens a scrollable detail view. When there
are no active alerts --- or when alerts are not configured --- the card
becomes either the **Muggy Meter** or **Nipply Meter**, based on the
current temperature.

Because weather dashboards can be useful *and* fun.

## Features

-   Displays a banner whenever one or more configured weather alerts are
    active
-   Tap the alert banner to view a scrollable list of alert details
-   Sorts alerts by severity
-   Adds weather-specific emoji for tornadoes, thunderstorms, winter
    weather, wind, hurricanes, flooding, heat, fog, fire weather, and
    more
-   Adds severity indicators to active alerts
-   **Muggy Meter** uses the current dew point to describe how
    oppressive the air feels
-   **Nipply Meter** takes over at 55°F / 12.8°C and below
-   Tap either meter to see its complete scale and thresholds in
    Fahrenheit and Celsius
-   Supports Fahrenheit and Celsius automatically
-   Can follow Home Assistant's configured temperature unit or use an
    explicit override
-   Includes debug options for forcing either meter and testing
    arbitrary temperatures
-   NWS weather alerts are optional; users can run the card solely as a
    Muggy/Nipply Meter
-   Uses existing Home Assistant entities; the card itself does not
    contact a weather service

## Requirements

### Required

A Home Assistant **weather entity** containing:

-   `temperature`
-   `dew_point`

### Optional

For U.S. weather alerts, the card can use an **NWS Alerts** sensor
provided by the NWS Alerts custom integration.

If no alert entity is configured, the Muggy Meter and Nipply Meter
continue to work normally. The card displays a small warning that
weather alerts are disabled unless `suppress_no_alert` is enabled.

This also allows users outside the United States to use the card without
installing an NWS-specific alert source.

## Installation

### HACS

If **Fun Weather Alerts** is available through HACS:

1.  Open **HACS**
2.  Go to **Dashboard**
3.  Search for **Fun Weather Alerts**
4.  Install it
5.  Reload your browser

If the repository has not yet been added to the default HACS catalog, it
can be installed as a custom repository using the repository URL and
selecting **Dashboard** as the category.

### Manual installation

1.  Copy `fun-weather-alerts.js` to:

    `/config/www/fun-weather-alerts.js`

2.  In Home Assistant, add the JavaScript file as a dashboard resource:

    `/local/fun-weather-alerts.js`

    Resource type: **JavaScript Module**

3.  Reload the browser.

If Home Assistant or your browser stubbornly keeps an older version of
the JavaScript file, temporarily changing the resource URL can force a
fresh fetch, for example:

`/local/fun-weather-alerts.js?v=2`

## Basic Configuration

With weather alerts:

``` yaml
type: custom:fun-weather-alerts
weather_entity: weather.home
alert_entity: sensor.nws_alerts
```

Without weather alerts:

``` yaml
type: custom:fun-weather-alerts
weather_entity: weather.home
suppress_no_alert: true
```

Replace the example entity IDs with your own.

## Configuration Options

  ---------------------------------------------------------------------------
  Option                Required          Default           Description
  --------------------- ----------------- ----------------- -----------------
  `weather_entity`      Yes               ---               Weather entity
                                                            containing
                                                            `temperature` and
                                                            `dew_point`

  `alert_entity`        No                ---               Optional NWS
                                                            Alerts sensor
                                                            containing the
                                                            active alert
                                                            count and
                                                            `Alerts`
                                                            attribute

  `temperature_unit`    No                `auto`            Display unit.
                                                            Supports `auto`,
                                                            `fahrenheit`, or
                                                            `celsius`

  `suppress_no_alert`   No                `false`           Suppresses the
                                                            informational
                                                            warning when no
                                                            alert entity is
                                                            configured

  `debug_mode`          No                ---               Forces a meter
                                                            for testing.
                                                            Valid values are
                                                            `muggy` or
                                                            `nipply`;
                                                            anything else is
                                                            ignored

  `debug_temperature`   No                ---               Overrides the
                                                            meter input while
                                                            a valid
                                                            `debug_mode` is
                                                            active
  ---------------------------------------------------------------------------

## Temperature Units

With:

``` yaml
temperature_unit: auto
```

the card follows Home Assistant's configured temperature unit.

You can explicitly force either unit:

``` yaml
temperature_unit: fahrenheit
```

or:

``` yaml
temperature_unit: celsius
```

All meter thresholds are normalized internally, so the same conditions
produce the same status regardless of the user's display unit.

## Optional Weather Alerts

To enable NWS weather alerts, configure an alert entity:

``` yaml
alert_entity: sensor.nws_alerts
```

If `alert_entity` is omitted, the card still provides the Muggy Meter
and Nipply Meter but displays an informational warning:

> ⚠️ Weather alerts disabled --- Without an NWS Alerts entity, you will
> not receive severe weather alerts.

If alerts are intentionally not being used, suppress the warning with:

``` yaml
suppress_no_alert: true
```

This is particularly useful for users outside the United States who do
not use an NWS alert source.

## Debugging the Meters

The card includes optional debug settings so you do not have to modify
the JavaScript just to test the various Muggy and Nipply states.

Force the Muggy Meter:

``` yaml
type: custom:fun-weather-alerts
weather_entity: weather.home
debug_mode: muggy
debug_temperature: 72
```

Force the Nipply Meter:

``` yaml
type: custom:fun-weather-alerts
weather_entity: weather.home
debug_mode: nipply
debug_temperature: 15
```

`debug_temperature` is only honored when `debug_mode` is `muggy` or
`nipply`.

The debug temperature is interpreted using the effective display unit.
For example:

``` yaml
temperature_unit: celsius
debug_mode: nipply
debug_temperature: -3
```

means **-3°C**.

With `temperature_unit: auto`, the value is interpreted using Home
Assistant's configured temperature unit.

## Normal Operation

The display follows this priority:

1.  **Active weather alerts** --- if a configured alert sensor reports
    one or more alerts, the alert banner is displayed.
2.  **Nipply Meter** --- when there are no active alerts and the current
    temperature is 55°F / 12.8°C or below.
3.  **Muggy Meter** --- when there are no active alerts and the current
    temperature is above 55°F / 12.8°C.

Debug mode can force either meter for testing.

## Muggy Meter

The Muggy Meter is based on **current dew point**, not relative
humidity.

  Dew Point                   Status
  --------------------------- -------------------------
  ≥ 75°F / \~24°C             🥵 Deodorant Won't Work
  70--\<75°F / \~21--\<24°C   😥 Disrespectful
  65--\<70°F / \~18--\<21°C   😰 Air You Can Wear
  60--\<65°F / \~16--\<18°C   😪 Kind of Humid
  \< 60°F / \<\~16°C          ✅ Comfortable

Tap the Muggy Meter to display the full scale in both Fahrenheit and
Celsius.

## Nipply Meter

The Nipply Meter is based on **current air temperature**.

  Temperature                Status
  -------------------------- -----------------------------------------
  50--55°F / \~10--13°C      ✅ Not Nipply
  40--\<50°F / \~4--10°C     🙂 A Little Brisk
  32--\<40°F / \~0--4°C      🥶 Nipply
  20--\<32°F / \~-7--0°C     ⚠️ Nipples Are At Risk
  10--\<20°F / \~-12---7°C   ‼️ Nipple Damage Likely
  5--\<10°F / \~-15---12°C   ❌ Severe Nipple Damage Likely
  \< 5°F / \<\~-15°C         ☠️ Catastrophic Nipple Failure Imminent

Tap the Nipply Meter to display the full scale in both Fahrenheit and
Celsius.

## Weather Alert Display

When active alerts are detected, the card displays:

**⚠️ Active Weather Alerts Detected - Tap for Deets**

Tapping the banner opens a scrollable popup containing available alert
information such as:

-   Event and headline
-   Severity and certainty
-   Expiration/end time
-   Affected areas
-   Description
-   Instructions

Alerts are ordered by severity so the most serious conditions appear
first.

The card also assigns emoji based on the alert title. Examples include
tornadoes, thunderstorms, winter weather, high wind, hurricanes,
flooding, heat, fog, fire weather, and coastal hazards.

## Visual Configuration

Fun Weather Alerts can provide a visual Home Assistant card editor so
users can configure the card without manually writing YAML.

Typical options include:

-   Weather Entity
-   Optional NWS Alerts Entity
-   Temperature Unit
-   Suppress Missing Alert Warning
-   Debug Mode
-   Debug Temperature

YAML configuration remains available for users who prefer it.

## Example

``` yaml
type: custom:fun-weather-alerts
weather_entity: weather.home
alert_entity: sensor.nws_alerts
temperature_unit: auto
```

For normal operation, only `weather_entity` is required.

## Notes

Fun Weather Alerts is a frontend dashboard card. It does not retrieve
NWS data itself and does not create Home Assistant entities. Weather
alerts and weather observations are supplied by the configured Home
Assistant entities.

The humorous Muggy and Nipply descriptions are intended for dashboard
entertainment and should not be treated as official meteorological
terminology or safety guidance. Always follow official weather-service
instructions during hazardous weather.

## License

Add the license used by this repository here.

## Credits

Weather alert data, when configured with an NWS Alerts entity,
ultimately comes from the National Weather Service / Weather.gov.

Built for Home Assistant dashboards, hyperpowerful hyperboomers, air you
can wear, and the responsible monitoring of nipple bicepularity.
