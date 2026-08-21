class FunWeatherAlertsCard extends HTMLElement {

    setConfig(config) {
        if (!config.weather_entity) {
            throw new Error("You must specify a weather entity");
        }

        const debugMode = String(
            config.debug_mode || ""
        )
            .trim()
            .toLowerCase();

        this.config = {
            temperature_unit: "auto",
            ...config,
            debug_mode:
                debugMode === "muggy" ||
                debugMode === "nipply"
                    ? debugMode
                    : ""
        };
    }

    set hass(hass) {
        const alertEntity = this.config.alert_entity
            ? hass.states[this.config.alert_entity]
            : null;
        const weatherEntity = hass.states[this.config.weather_entity];

        const alertCount = alertEntity
            ? Number(alertEntity.state)
            : 0;

        /*
         * Weather alerts always take priority over the Muggy/Nipply meters.
         */
        if (alertCount > 0) {
            const alerts = Array.isArray(alertEntity.attributes.Alerts)
                ? alertEntity.attributes.Alerts
                : [];

            this.renderAlertBanner(alerts);
            return;
        }

        const sourceUnit = this.getSourceTemperatureUnit(
            hass,
            weatherEntity
        );

        const displayUnit = this.getDisplayTemperatureUnit(
            hass,
            weatherEntity
        );

        const rawDewPoint = Number(
            weatherEntity?.attributes?.dew_point
        );

        const rawTemperature = Number(
            weatherEntity?.attributes?.temperature
        );

        /*
         * Normalize all internal comparisons to Fahrenheit so the
         * Muggy Meter and Nipply Meter thresholds only need to be
         * maintained in one unit system.
         */
        const dewPointF = this.toFahrenheit(
            rawDewPoint,
            sourceUnit
        );

        const temperatureF = this.toFahrenheit(
            rawTemperature,
            sourceUnit
        );

        /*
        * Optional debug temperature.
        *
        * Only honored when debug_mode is "muggy" or "nipply".
        * The supplied value is interpreted using the effective display unit:
        *
        *   1. temperature_unit override, if configured
        *   2. otherwise Home Assistant's configured unit system
        */
        const hasDebugTemperature =
            this.config.debug_mode &&
            this.config.debug_temperature !== undefined &&
            this.config.debug_temperature !== null &&
            this.config.debug_temperature !== "";

        const debugTemperature = Number(
            this.config.debug_temperature
        );

        const debugTemperatureF =
            hasDebugTemperature &&
            !Number.isNaN(debugTemperature)
                ? this.toFahrenheit(
                    debugTemperature,
                    displayUnit
                )
                : NaN;

        /*
        * Debug override.
        */
        if (this.config.debug_mode === "muggy") {
            const debugDewPointF =
                !Number.isNaN(debugTemperatureF)
                    ? debugTemperatureF
                    : dewPointF;

            this.renderMuggyMeter(
                debugDewPointF,
                displayUnit
            );

            return;
        }

        if (this.config.debug_mode === "nipply") {
            const debugAirTemperatureF =
                !Number.isNaN(debugTemperatureF)
                    ? debugTemperatureF
                    : temperatureF;

            this.renderNipplyMeter(
                debugAirTemperatureF,
                displayUnit
            );

            return;
        }

        /*
         * At 55°F / 12.8°C and below, the Nipply Meter takes over.
         * Above that, the Muggy Meter reports dew point conditions.
         */
        if (temperatureF <= 55) {
            this.renderNipplyMeter(
                temperatureF,
                displayUnit
            );
        } else {
            this.renderMuggyMeter(
                dewPointF,
                displayUnit
            );
        }
    }

    renderAlertBanner(alerts) {
        this.style.display = "";

        this.innerHTML = `
            <ha-card
                id="hyperboomer-banner"
                style="
                    cursor: pointer;
                    padding: 16px;
                    text-align: center;
                    font-weight: 600;
                "
            >
                ⚠️ Active Weather Alerts Detected - Tap for Deets
            </ha-card>
        `;

        this.querySelector("#hyperboomer-banner")
            .addEventListener("click", () => {
                this.showAlertPopup(alerts);
            });
    }

    renderMuggyMeter(dewPointF, displayUnit) {
        this.style.display = "";

        if (Number.isNaN(dewPointF)) {
            this.innerHTML = `
                <ha-card
                    style="
                        padding: 16px;
                        text-align: center;
                    "
                >
                    💧 <strong>Muggy Meter:</strong> unavailable
                </ha-card>
            `;

            return;
        }

        const phrase = this.getMuggyPhrase(dewPointF);

        const displayTemperature = this.formatTemperature(
            dewPointF,
            displayUnit
        );

        this.innerHTML = `
            <ha-card
                id="muggy-meter-card"
                style="
                    cursor: pointer;
                    padding: 16px;
                    text-align: center;
                "
            >
                💧 <strong>Muggy Meter:</strong>
                ${displayTemperature} —
                ${this.escapeHtml(phrase)}

                ${this.getNoAlertWarning()}
            </ha-card>
        `;

        this.querySelector("#muggy-meter-card")
            .addEventListener("click", () => {
                this.showMeterPopup(
                    "💧 Muggy Meter",
                    this.getMuggyScale()
                );
            });
    }

    renderNipplyMeter(temperatureF, displayUnit) {
        this.style.display = "";

        if (Number.isNaN(temperatureF)) {
            this.innerHTML = `
                <ha-card
                    style="
                        padding: 16px;
                        text-align: center;
                    "
                >
                    🥶 <strong>Nipply Meter:</strong> unavailable
                </ha-card>
            `;

            return;
        }

        const phrase = this.getNipplyPhrase(temperatureF);

        const displayTemperature = this.formatTemperature(
            temperatureF,
            displayUnit
        );

        this.innerHTML = `
            <ha-card
                id="nipply-meter-card"
                style="
                    cursor: pointer;
                    padding: 16px;
                    text-align: center;
                "
            >
                🥶 <strong>Nipply Meter:</strong>
                ${displayTemperature} —
                ${this.escapeHtml(phrase)}

                ${this.getNoAlertWarning()}
            </ha-card>
        `;

        this.querySelector("#nipply-meter-card")
            .addEventListener("click", () => {
                this.showMeterPopup(
                    "🥶 Nipply Meter",
                    this.getNipplyScale()
                );
            });
    }

    getMuggyPhrase(dewPointF) {
        /*
         * Inspired by the Michigan Storm Chasers Muggy Meter.
         * Thresholds are maintained internally in Fahrenheit.
         */

        if (dewPointF >= 75) {
            return "🥵 Deodorant Won't Work";
        } else if (dewPointF >= 70) {
            return "😥 Disrespectful";
        } else if (dewPointF >= 65) {
            return "😰 Air You Can Wear";
        } else if (dewPointF >= 60) {
            return "😪 Kind of Humid";
        } else {
            return "✅ Comfortable";
        }
    }

    getNipplyPhrase(temperatureF) {
        /*
         * Highly Scientific Nipply Meter.
         * Thresholds are maintained internally in Fahrenheit.
         */

        if (temperatureF >= 50) {
            return "✅ Not Nipply";
        } else if (temperatureF >= 40) {
            return "🙂 A Little Brisk";
        } else if (temperatureF >= 32) {
            return "🥶 Nipply";
        } else if (temperatureF >= 20) {
            return "⚠️ Nipples Are At Risk";
        } else if (temperatureF >= 10) {
            return "‼️ Nipple Damage Likely";
        } else if (temperatureF >= 5) {
            return "❌ Severe Nipple Damage Likely";
        } else {
            return "☠️ Catastrophic Nipple Failure Imminent";
        }
    }

    getSourceTemperatureUnit(hass, weatherEntity) {
        /*
         * Prefer an entity-level temperature unit if one is supplied.
         * Otherwise, use Home Assistant's configured unit system.
         */
        const entityUnit =
            weatherEntity?.attributes?.temperature_unit;

        if (entityUnit) {
            return this.normalizeTemperatureUnit(entityUnit);
        }

        return this.normalizeTemperatureUnit(
            hass?.config?.unit_system?.temperature || "°F"
        );
    }

    getDisplayTemperatureUnit(hass, weatherEntity) {
        const configuredUnit = String(
            this.config.temperature_unit || "auto"
        ).toLowerCase();

        if (configuredUnit === "auto") {
            return this.getSourceTemperatureUnit(
                hass,
                weatherEntity
            );
        }

        return this.normalizeTemperatureUnit(
            this.config.temperature_unit
        );
    }

    normalizeTemperatureUnit(unit) {
        const normalized = String(unit || "")
            .trim()
            .toLowerCase();

        if (
            normalized === "°c" ||
            normalized === "c" ||
            normalized === "celsius"
        ) {
            return "°C";
        }

        if (
            normalized === "°f" ||
            normalized === "f" ||
            normalized === "fahrenheit"
        ) {
            return "°F";
        }

        /*
         * If Home Assistant gives us something unexpected,
         * fall back to Fahrenheit.
         */
        return "°F";
    }

    toFahrenheit(value, unit) {
        if (Number.isNaN(value)) {
            return NaN;
        }

        if (this.normalizeTemperatureUnit(unit) === "°C") {
            return (value * 9 / 5) + 32;
        }

        return value;
    }

    fromFahrenheit(valueF, unit) {
        if (Number.isNaN(valueF)) {
            return NaN;
        }

        if (this.normalizeTemperatureUnit(unit) === "°C") {
            return (valueF - 32) * 5 / 9;
        }

        return valueF;
    }

    formatTemperature(valueF, unit) {
        const normalizedUnit =
            this.normalizeTemperatureUnit(unit);

        const displayValue = this.fromFahrenheit(
            valueF,
            normalizedUnit
        );

        return `${displayValue.toFixed(0)}${normalizedUnit}`;
    }

    showAlertPopup(alerts) {
        /*
         * Don't allow multiple copies of the popup.
         */
        if (document.getElementById("hyperboomer-alert-popup")) {
            return;
        }

        const sortedAlerts = [...alerts].sort(
            (a, b) =>
                this.severityRank(b.Severity) -
                this.severityRank(a.Severity)
        );

        const overlay = document.createElement("div");
        overlay.id = "hyperboomer-alert-popup";

        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: rgba(0, 0, 0, 0.72);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        `;

        const popup = document.createElement("div");

        popup.style.cssText = `
            width: min(900px, 96vw);
            max-height: 88vh;
            overflow-y: auto;
            background: var(--card-background-color, #1c1c1c);
            color: var(--primary-text-color, white);
            border-radius: 16px;
            padding: 24px;
            box-sizing: border-box;
        `;

        let content = `
            <div
                style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 22px;
                "
            >
                <div
                    style="
                        font-size: 24px;
                        font-weight: 700;
                    "
                >
                    ⚠️ Active Weather Alerts
                </div>

                <button
                    id="hyperboomer-close"
                    type="button"
                    aria-label="Close weather alerts"
                    style="
                        font-size: 26px;
                        line-height: 1;
                        border: none;
                        background: transparent;
                        color: inherit;
                        cursor: pointer;
                    "
                >
                    ✕
                </button>
            </div>
        `;

        if (sortedAlerts.length === 0) {
            content += `
                <p>
                    Home Assistant reports one or more active weather alerts,
                    but no alert details were supplied.
                </p>
            `;
        } else {
            sortedAlerts.forEach((alert, index) => {
                const event = alert.Event || "Weather Alert";
                const headline = alert.Headline || "";
                const severity = alert.Severity || "";
                const certainty = alert.Certainty || "";
                const areas = alert.AreasAffected || "";
                const description = alert.Description || "";
                const instruction = alert.Instruction || "";
                const ends = alert.Ends || alert.Expires || "";

                const weatherEmoji =
                    this.getWeatherEmoji(event);

                const severityIcon =
                    this.getSeverityIcon(severity);

                const showHeadline =
                    headline &&
                    headline.trim().toLowerCase() !==
                    event.trim().toLowerCase();

                content += `
                    <section
                        style="
                            padding-bottom: 24px;
                            margin-bottom: 24px;
                            ${
                                index < sortedAlerts.length - 1
                                    ? "border-bottom: 1px solid var(--divider-color, #555);"
                                    : ""
                            }
                        "
                    >
                        <div
                            style="
                                font-size: 22px;
                                font-weight: 700;
                                margin-bottom: 10px;
                            "
                        >
                            ${weatherEmoji}
                            ${this.escapeHtml(event)}
                        </div>

                        ${
                            showHeadline
                                ? `
                                    <div
                                        style="
                                            font-size: 17px;
                                            font-weight: 600;
                                            margin-bottom: 12px;
                                        "
                                    >
                                        ${this.escapeHtml(headline)}
                                    </div>
                                `
                                : ""
                        }

                        ${
                            severity || certainty
                                ? `
                                    <div style="margin-bottom: 10px;">
                                        ${
                                            severity
                                                ? `
                                                    <strong>Severity:</strong>
                                                    ${severityIcon}
                                                    ${this.escapeHtml(severity)}
                                                `
                                                : ""
                                        }

                                        ${
                                            severity && certainty
                                                ? " &nbsp; | &nbsp; "
                                                : ""
                                        }

                                        ${
                                            certainty
                                                ? `
                                                    <strong>Certainty:</strong>
                                                    ${this.escapeHtml(certainty)}
                                                `
                                                : ""
                                        }
                                    </div>
                                `
                                : ""
                        }

                        ${
                            ends
                                ? `
                                    <div style="margin-bottom: 10px;">
                                        <strong>Valid Until:</strong>
                                        ${this.escapeHtml(
                                            this.formatDateTime(ends)
                                        )}
                                    </div>
                                `
                                : ""
                        }

                        ${
                            areas
                                ? `
                                    <div
                                        style="
                                            margin-bottom: 16px;
                                            color: var(--secondary-text-color, #aaa);
                                        "
                                    >
                                        <strong>Affected Areas:</strong>
                                        ${this.escapeHtml(areas)}
                                    </div>
                                `
                                : ""
                        }

                        ${
                            description
                                ? `
                                    <div
                                        style="
                                            white-space: pre-wrap;
                                            line-height: 1.5;
                                            margin-bottom: 18px;
                                        "
                                    >
                                        ${this.escapeHtml(description)}
                                    </div>
                                `
                                : ""
                        }

                        ${
                            instruction
                                ? `
                                    <div
                                        style="
                                            margin-top: 16px;
                                            padding-top: 16px;
                                            border-top: 1px solid var(--divider-color, #555);
                                        "
                                    >
                                        <div
                                            style="
                                                font-weight: 700;
                                                margin-bottom: 8px;
                                            "
                                        >
                                            Instructions
                                        </div>

                                        <div
                                            style="
                                                white-space: pre-wrap;
                                                line-height: 1.5;
                                            "
                                        >
                                            ${this.escapeHtml(instruction)}
                                        </div>
                                    </div>
                                `
                                : ""
                        }
                    </section>
                `;
            });
        }

        popup.innerHTML = content;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        const closePopup = () => {
            overlay.remove();
            document.removeEventListener(
                "keydown",
                escapeHandler
            );
        };

        const escapeHandler = (event) => {
            if (event.key === "Escape") {
                closePopup();
            }
        };

        popup
            .querySelector("#hyperboomer-close")
            .addEventListener(
                "click",
                closePopup
            );

        overlay.addEventListener(
            "click",
            (event) => {
                if (event.target === overlay) {
                    closePopup();
                }
            }
        );

        document.addEventListener(
            "keydown",
            escapeHandler
        );
    }

    getWeatherEmoji(event) {
        const text = (event || "").toLowerCase();

        if (text.includes("tornado")) {
            return "🌪️";
        }

        if (
            text.includes("thunderstorm") ||
            text.includes("lightning")
        ) {
            return "⛈️";
        }

        if (
            text.includes("winter") ||
            text.includes("blizzard") ||
            text.includes("snow") ||
            text.includes("ice")
        ) {
            return "❄️";
        }

        if (
            text.includes("wind") ||
            text.includes("gale")
        ) {
            return "💨";
        }

        if (
            text.includes("hurricane") ||
            text.includes("tropical storm")
        ) {
            return "🌀";
        }

        if (text.includes("heat")) {
            return "🥵";
        }

        if (text.includes("flood")) {
            return "🌊";
        }

        if (text.includes("fog")) {
            return "🌫️";
        }

        if (
            text.includes("fire") ||
            text.includes("red flag")
        ) {
            return "🔥";
        }

        if (
            text.includes("freeze") ||
            text.includes("frost")
        ) {
            return "🥶";
        }

        return "⚠️";
    }

    getSeverityIcon(severity) {
        switch ((severity || "").toLowerCase()) {
            case "extreme":
                return "🔴";

            case "severe":
                return "🟠";

            case "moderate":
                return "🟡";

            case "minor":
                return "🟢";

            default:
                return "⚪";
        }
    }

    severityRank(severity) {
        switch ((severity || "").toLowerCase()) {
            case "extreme":
                return 5;

            case "severe":
                return 4;

            case "moderate":
                return 3;

            case "minor":
                return 2;

            case "unknown":
                return 1;

            default:
                return 0;
        }
    }

    formatDateTime(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleString(
            [],
            {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
            }
        );
    }

    escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    getCardSize() {
        return 1;
    }

    getMuggyScale() {
        return [
            {
                minF: 75,
                maxF: null,
                label: "🥵 Deodorant Won't Work"
            },
            {
                minF: 70,
                maxF: 74.9,
                label: "😥 Disrespectful"
            },
            {
                minF: 65,
                maxF: 69.9,
                label: "😰 Air You Can Wear"
            },
            {
                minF: 60,
                maxF: 64.9,
                label: "😪 Kind of Humid"
            },
            {
                minF: null,
                maxF: 59.9,
                label: "✅ Comfortable"
            }
        ];
    }

    getNipplyScale() {
        return [
            {
                minF: 50,
                maxF: null,
                label: "✅ Not Nipply"
            },
            {
                minF: 40,
                maxF: 49.9,
                label: "🙂 A Little Brisk"
            },
            {
                minF: 32,
                maxF: 39.9,
                label: "🥶 Nipply"
            },
            {
                minF: 20,
                maxF: 31.9,
                label: "⚠️ Nipples Are At Risk"
            },
            {
                minF: 10,
                maxF: 19.9,
                label: "‼️ Nipple Damage Likely"
            },
            {
                minF: 5,
                maxF: 9.9,
                label: "❌ Severe Nipple Damage Likely"
            },
            {
                minF: null,
                maxF: 4.9,
                label: "☠️ Catastrophic Nipple Failure Imminent"
            }
        ];
    }

    showMeterPopup(title, scale) {
        if (document.getElementById("hyperboomer-meter-popup")) {
            return;
        }

        const overlay = document.createElement("div");
        overlay.id = "hyperboomer-meter-popup";

        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: rgba(0, 0, 0, 0.72);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        `;

        const popup = document.createElement("div");

        popup.style.cssText = `
            width: min(760px, 96vw);
            max-height: 88vh;
            overflow-y: auto;
            background: var(--card-background-color, #1c1c1c);
            color: var(--primary-text-color, white);
            border-radius: 16px;
            padding: 24px;
            box-sizing: border-box;
        `;

        const rows = scale.map(item => {
            const fRange = this.formatScaleRange(
                item.minF,
                item.maxF,
                "°F"
            );

            const cRange = this.formatScaleRange(
                item.minF,
                item.maxF,
                "°C"
            );

            return `
                <tr>
                    <td
                        style="
                            padding: 10px;
                            border-bottom: 1px solid var(--divider-color, #555);
                        "
                    >
                        ${this.escapeHtml(item.label)}
                    </td>

                    <td
                        style="
                            padding: 10px;
                            border-bottom: 1px solid var(--divider-color, #555);
                            white-space: nowrap;
                        "
                    >
                        ${this.escapeHtml(fRange)}
                    </td>

                    <td
                        style="
                            padding: 10px;
                            border-bottom: 1px solid var(--divider-color, #555);
                            white-space: nowrap;
                        "
                    >
                        ${this.escapeHtml(cRange)}
                    </td>
                </tr>
            `;
        }).join("");

        popup.innerHTML = `
            <div
                style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 20px;
                "
            >
                <div
                    style="
                        display: flex;
                        align-items: baseline;
                        gap: 10px;
                        flex-wrap: wrap;
                    "
                >
                    <div
                        style="
                            font-size: 24px;
                            font-weight: 700;
                        "
                    >
                        ${this.escapeHtml(title)}
                    </div>

                    <div
                        style="
                            font-size: 13px;
                            font-weight: 400;
                            color: var(--secondary-text-color, #aaa);
                        "
                    >
                        ${
                            title.includes("Muggy")
                                ? "Based on Current Dew Point (Inspired by Michigan Storm Chasers)"
                                : "Based on Current Temperature (Inspired by Clark Griswold)"
                        }
                    </div>
                </div>

                <button
                    id="hyperboomer-meter-close"
                    type="button"
                    aria-label="Close meter scale"
                    style="
                        font-size: 26px;
                        line-height: 1;
                        border: none;
                        background: transparent;
                        color: inherit;
                        cursor: pointer;
                    "
                >
                    ✕
                </button>
            </div>

            <table
                style="
                    width: 100%;
                    border-collapse: collapse;
                "
            >
                <thead>
                    <tr>
                        <th
                            style="
                                text-align: left;
                                padding: 10px;
                            "
                        >
                            Status
                        </th>

                        <th
                            style="
                                text-align: left;
                                padding: 10px;
                            "
                        >
                            Fahrenheit
                        </th>

                        <th
                            style="
                                text-align: left;
                                padding: 10px;
                            "
                        >
                            Celsius
                        </th>
                    </tr>
                </thead>

                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        const closePopup = () => {
            overlay.remove();
            document.removeEventListener(
                "keydown",
                escapeHandler
            );
        };

        const escapeHandler = (event) => {
            if (event.key === "Escape") {
                closePopup();
            }
        };

        popup
            .querySelector("#hyperboomer-meter-close")
            .addEventListener(
                "click",
                closePopup
            );

        overlay.addEventListener(
            "click",
            (event) => {
                if (event.target === overlay) {
                    closePopup();
                }
            }
        );

        document.addEventListener(
            "keydown",
            escapeHandler
        );
    }

    formatScaleRange(minF, maxF, unit) {
        const convert = (valueF) => {
            if (unit === "°C") {
                return (valueF - 32) * 5 / 9;
            }

            return valueF;
        };

        const formatValue = (value) => {
            return Math.round(value);
        };

        if (minF !== null && maxF === null) {
            return `≥ ${formatValue(convert(minF))}${unit}`;
        }

        if (minF === null && maxF !== null) {
            return `< ${formatValue(convert(maxF + 0.1))}${unit}`;
        }

        return `${formatValue(convert(minF))}–${formatValue(convert(maxF))}${unit}`;
    }

    getNoAlertWarning() {
        if (
            this.config.alert_entity ||
            this.config.suppress_no_alert === true
        ) {
            return "";
        }

        return `
            <div
                style="
                    margin-top: 8px;
                    font-size: 12px;
                    color: var(--secondary-text-color, #aaa);
                "
            >
                ⚠️ Weather Alerts Disabled —
                Without an NWS Alerts entity, you will not receive
                severe weather alerts.
            </div>
        `;
    }

    static getConfigForm() {
        return {
            schema: [
                {
                    name: "weather_entity",
                    required: true,
                    selector: {
                        entity: {
                            filter: {
                                domain: "weather"
                            }
                        }
                    }
                },
                {
                    name: "alert_entity",
                    selector: {
                        entity: {
                            filter: {
                                domain: "sensor"
                            }
                        }
                    }
                },
                {
                    name: "temperature_unit",
                    selector: {
                        select: {
                            options: [
                                {
                                    value: "auto",
                                    label: "Auto"
                                },
                                {
                                    value: "fahrenheit",
                                    label: "Fahrenheit"
                                },
                                {
                                    value: "celsius",
                                    label: "Celsius"
                                }
                            ]
                        }
                    }
                },
                {
                    name: "suppress_no_alert",
                    selector: {
                        boolean: {}
                    }
                },
                {
                    type: "expandable",
                    name: "",
                    title: "Debug Options",
                    flatten: true,
                    schema: [
                        {
                            name: "debug_mode",
                            selector: {
                                select: {
                                    options: [
                                        {
                                            value: "",
                                            label: "Off"
                                        },
                                        {
                                            value: "muggy",
                                            label: "Muggy Meter"
                                        },
                                        {
                                            value: "nipply",
                                            label: "Nipply Meter"
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            name: "debug_temperature",
                            selector: {
                                number: {
                                    mode: "box",
                                    step: 0.1
                                }
                            }
                        }
                    ]
                }
            ],

            computeLabel: (schema) => {
                const labels = {
                    weather_entity: "Weather Entity",
                    alert_entity: "NWS Alerts Entity",
                    temperature_unit: "Temperature Unit",
                    suppress_no_alert: "Suppress Missing Alert Warning",
                    debug_mode: "Debug Mode",
                    debug_temperature: "Debug Temperature"
                };

                return labels[schema.name];
            },

            computeHelper: (schema) => {
                const helpers = {
                    weather_entity:
                        "Required. Must provide current temperature and dew point.",
                    alert_entity:
                        "Optional. Without this entity, severe weather alerts will not be displayed.",
                    temperature_unit:
                        "Auto follows Home Assistant's configured temperature unit.",
                    suppress_no_alert:
                        "Hide the warning shown when no alert entity is configured.",
                    debug_mode:
                        "Force the Muggy or Nipply Meter for testing.",
                    debug_temperature:
                        "Only used when Debug Mode is Muggy or Nipply. Interpreted in the selected temperature unit."
                };

                return helpers[schema.name];
            }
        };
    }

    static getStubConfig() {
        return {
            weather_entity: "",
            temperature_unit: "auto",
            suppress_no_alert: false
        };
    }
}

customElements.define(
    "fun-weather-alerts-card",
    FunWeatherAlertsCard
);

window.customCards = window.customCards || [];

window.customCards.push({
    type: "fun-weather-alerts-card",
    name: "Fun Weather Alerts Card",
    description:
        "Weather alerts, Muggy Meter, and highly scientific Nipply Meter.",
    preview: false
});
