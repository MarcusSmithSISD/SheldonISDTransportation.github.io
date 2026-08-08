/*==========================================================================*
 * SHELDON ISD TRANSPORTATION
 * TRIP SELECTION BOARD
 *
 * VERSION 11.2
 * PRODUCTION SCRIPT
 *
 * PURPOSE:
 *   - Reads transportation trip data from a published Google Sheets CSV
 *   - Displays trips in the existing HTML/CSS interface
 *   - Supports automatic paging
 *   - Keeps each page visible for 20 seconds
 *   - Supports LED display / browser environments
 *   - Automatically refreshes spreadsheet data
 *   - Handles Google Sheets column-name variations
 *   - Handles blank cells and multi-day trips
 *   - Displays manual trip status:
 *       COVERED
 *       OPEN
 *       DROP OFF
 *
 * FINAL DISPLAY COLUMNS:
 *   1. Trip #
 *   2. Status
 *   3. Activity
 *   4. Departure Campus
 *   5. Clock In
 *   6. Depart Load
 *   7. Return Date/Time
 *   8. Destination
 *   9. Address
 *   10. # Busses
 *   11. Sponsor
 *
 *==========================================================================*/

"use strict";

/*==========================================================================*
 * CONFIGURATION
 *==========================================================================*/

const CONFIG = {

    /*---------------------------------------------------------------------*
     * GOOGLE SHEETS CSV
     *---------------------------------------------------------------------*/

    DATA_URL:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQNfRBXyIa0ZceWPuKpNJuB38Z1V8UfG9rHSwDaXZ1jQjGeB0lgLiifX_vdl6DHk4Z-6Rm-x_M2m8FQ/pub?gid=507419977&single=true&output=csv",

    /*---------------------------------------------------------------------*
     * TIMING
     *---------------------------------------------------------------------*/

    REFRESH_INTERVAL: 60000,

    PAGE_DURATION: 20000,

    FETCH_TIMEOUT: 15000,

    /*---------------------------------------------------------------------*
     * DISPLAY
     *---------------------------------------------------------------------*/

    ROWS_PER_PAGE: 8,

    /*---------------------------------------------------------------------*
     * BEHAVIOR
     *---------------------------------------------------------------------*/

    AUTO_PAGE: true,

    AUTO_REFRESH: true,

    SHOW_EMPTY_TRIPS: false,

    /*---------------------------------------------------------------------*
     * CONNECTION
     *---------------------------------------------------------------------*/

    ONLINE_TEXT: "LIVE",

    OFFLINE_TEXT: "OFFLINE",

    LOADING_TEXT: "LOADING",

    ERROR_TEXT: "ERROR"

};


/*==========================================================================*
 * APPLICATION STATE
 *==========================================================================*/

const App = {

    trips: [],

    filteredTrips: [],

    pages: [],

    currentPage: 0,

    pageTimer: null,

    refreshTimer: null,

    lastUpdated: null,

    loading: false,

    online: false,

    initialized: false,

    destroyed: false

};


/*==========================================================================*
 * DOM CACHE
 *==========================================================================*/

const DOM = {

    connectionStatus: null,

    currentDate: null,

    lastUpdated: null,

    table: null,

    tableHead: null,

    tableBody: null,

    pageNumber: null,

    pageContainer: null,

    mainContainer: null

};


/*==========================================================================*
 * INITIALIZATION
 *==========================================================================*/

document.addEventListener("DOMContentLoaded", initializeApplication);


/**
 * Start the application.
 */
async function initializeApplication() {

    if (App.initialized) {
        return;
    }

    App.initialized = true;

    cacheDOM();

    initializeDateDisplay();

    updateConnectionStatus(CONFIG.LOADING_TEXT);

    installVisibilityHandler();

    installResizeHandler();

    installUnloadHandler();

    await loadTrips();

    if (CONFIG.AUTO_REFRESH) {
        startRefreshTimer();
    }

}


/*==========================================================================*
 * DOM DISCOVERY
 *==========================================================================*/

/**
 * Find the existing HTML elements without requiring changes to the HTML.
 */
function cacheDOM() {

    DOM.connectionStatus =
        document.getElementById("connectionStatus") ||
        document.querySelector(".connection-status") ||
        document.querySelector("[data-connection-status]");

    DOM.currentDate =
        document.getElementById("currentDate") ||
        document.querySelector(".current-date") ||
        document.querySelector("[data-current-date]");

    DOM.lastUpdated =
        document.getElementById("lastUpdated") ||
        document.querySelector(".last-updated") ||
        document.querySelector("[data-last-updated]");

    DOM.table =
        document.getElementById("tripTable") ||
        document.getElementById("trip-table") ||
        document.querySelector("table");

    if (DOM.table) {

        DOM.tableHead =
            DOM.table.querySelector("thead");

        DOM.tableBody =
            DOM.table.querySelector("tbody");

    }

    DOM.pageNumber =
        document.getElementById("pageNumber") ||
        document.querySelector(".page-number") ||
        document.querySelector("[data-page-number]");

    DOM.pageContainer =
        document.getElementById("pageContainer") ||
        document.querySelector(".page-container") ||
        document.querySelector("[data-page-container]");

    DOM.mainContainer =
        document.getElementById("tripTableContainer") ||
        document.querySelector(".table-container") ||
        document.querySelector("main");

}


/*==========================================================================*
 * DATE / TIME
 *==========================================================================*/

/**
 * Update the existing date field.
 */
function initializeDateDisplay() {

    updateCurrentDate();

    setInterval(updateCurrentDate, 30000);

}


/**
 * Display current date.
 */
function updateCurrentDate() {

    if (!DOM.currentDate) {
        return;
    }

    const now = new Date();

    DOM.currentDate.textContent =
        now.toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric"
        });

}


/*==========================================================================*
 * DATA LOADING
 *==========================================================================*/

/**
 * Load the Google Sheets CSV.
 */
async function loadTrips() {

    if (App.loading) {
        return;
    }

    App.loading = true;

    updateConnectionStatus(CONFIG.LOADING_TEXT);

    try {

        const csv = await fetchCSV();

        const rows = parseCSV(csv);

        const trips = normalizeTrips(rows);

        App.trips = trips;

        App.filteredTrips = filterTrips(trips);

        buildPages();

        App.currentPage = 0;

        renderCurrentPage();

        App.lastUpdated = new Date();

        updateLastUpdated();

        updateConnectionStatus(CONFIG.ONLINE_TEXT);

        App.online = true;

        startPageTimer();

    }

    catch (error) {

        console.error(
            "Sheldon ISD Transportation Board:",
            error
        );

        App.online = false;

        updateConnectionStatus(CONFIG.OFFLINE_TEXT);

        if (!App.trips.length) {
            renderErrorState();
        }

    }

    finally {

        App.loading = false;

    }

}


/*==========================================================================*
 * FETCH CSV
 *==========================================================================*/

/**
 * Fetch Google Sheets CSV with timeout protection.
 */
async function fetchCSV() {

    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        CONFIG.FETCH_TIMEOUT
    );

    try {

        const separator =
            CONFIG.DATA_URL.includes("?")
                ? "&"
                : "?";

        const cacheBuster =
            `${separator}_=${Date.now()}`;

        const response = await fetch(
            CONFIG.DATA_URL + cacheBuster,
            {
                method: "GET",
                cache: "no-store",
                signal: controller.signal,
                headers: {
                    "Accept": "text/csv,text/plain,*/*"
                }
            }
        );

        if (!response.ok) {

            throw new Error(
                `CSV request failed: ${response.status}`
            );

        }

        return await response.text();

    }

    finally {

        clearTimeout(timeout);

    }

}


/*==========================================================================*
 * CSV PARSER
 *==========================================================================*/

/**
 * Production CSV parser.
 *
 * Handles:
 *   - commas
 *   - quoted values
 *   - commas inside quoted cells
 *   - escaped quotes
 *   - blank rows
 *   - CRLF/LF line endings
 */
function parseCSV(csv) {

    if (!csv || typeof csv !== "string") {
        return [];
    }

    const rows = [];

    let row = [];

    let value = "";

    let insideQuotes = false;

    for (let i = 0; i < csv.length; i++) {

        const char = csv[i];

        const next = csv[i + 1];

        if (char === '"') {

            if (insideQuotes && next === '"') {

                value += '"';

                i++;

            }

            else {

                insideQuotes = !insideQuotes;

            }

        }

        else if (char === "," && !insideQuotes) {

            row.push(value);

            value = "";

        }

        else if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {

            if (char === "\r" && next === "\n") {
                i++;
            }

            row.push(value);

            value = "";

            if (
                row.some(
                    cell => String(cell).trim() !== ""
                )
            ) {

                rows.push(row);

            }

            row = [];

        }

        else {

            value += char;

        }

    }

    if (value !== "" || row.length) {

        row.push(value);

        if (
            row.some(
                cell => String(cell).trim() !== ""
            )
        ) {

            rows.push(row);

        }

    }

    if (!rows.length) {
        return [];
    }

    const headers = rows[0].map(
        normalizeHeader
    );

    return rows
        .slice(1)
        .map(row => {

            const object = {};

            headers.forEach(
                (header, index) => {

                    object[header] =
                        cleanValue(row[index] ?? "");

                }
            );

            return object;

        });

}


/*==========================================================================*
 * HEADER NORMALIZATION
 *==========================================================================*/

/**
 * Convert spreadsheet header names to predictable keys.
 */
function normalizeHeader(header) {

    return String(header || "")
        .trim()
        .toLowerCase()
        .replace(/[\r\n]+/g, " ")
        .replace(/[#]/g, " number ")
        .replace(/[\/\\]/g, " ")
        .replace(/[()]/g, " ")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


/**
 * Clean spreadsheet values.
 */
function cleanValue(value) {

    return String(value ?? "")
        .replace(/\uFEFF/g, "")
        .replace(/\r/g, "")
        .replace(/\n/g, " ")
        .trim();

}


/*==========================================================================*
 * COLUMN LOOKUP
 *==========================================================================*/

/**
 * Locate a spreadsheet value using multiple possible header names.
 */
function getField(row, names) {

    for (const name of names) {

        const key = normalizeHeader(name);

        if (
            Object.prototype.hasOwnProperty.call(
                row,
                key
            )
        ) {

            const value = cleanValue(row[key]);

            if (value !== "") {
                return value;
            }

        }

    }

    return "";

}


/*==========================================================================*
 * TRIP NORMALIZATION
 *==========================================================================*/

/**
 * Convert spreadsheet rows into the board's standard trip structure.
 */
function normalizeTrips(rows) {

    return rows
        .map((row, index) => {

            const trip = {

                tripNumber: getField(row, [
                    "Trip #",
                    "Trip Number",
                    "Trip No",
                    "Trip"
                ]),

                status: getField(row, [
                    "Status",
                    "Cover",
                    "Cover Status",
                    "Trip Status"
                ]),

                activity: getField(row, [
                    "Activity",
                    "Event",
                    "Trip Activity"
                ]),

                departureCampus: getField(row, [
                    "Departure Campus",
                    "Departure Campus Name",
                    "Campus",
                    "Depart Campus",
                    "School"
                ]),

                clockIn: getField(row, [
                    "Clock In",
                    "Clock-In",
                    "Clockin",
                    "Clock In Time"
                ]),

                departLoad: getField(row, [
                    "Depart Load",
                    "Depart Load Time",
                    "Depart/Load",
                    "Load Time",
                    "Departure Time"
                ]),

                returnDateTime: getField(row, [
                    "Return Date/Time",
                    "Return Date Time",
                    "Return",
                    "Return Time",
                    "Return Date"
                ]),

                destination: getField(row, [
                    "Destination",
                    "Dest"
                ]),

                address: getField(row, [
                    "Address",
                    "Destination Address",
                    "Dest Address"
                ]),

                buses: getField(row, [
                    "# Busses",
                    "# Buses",
                    "Busses",
                    "Buses",
                    "Bus Count",
                    "Number of Busses",
                    "Number of Buses"
                ]),

                sponsor: getField(row, [
                    "Sponsor",
                    "Trip Sponsor",
                    "Coach",
                    "Contact"
                ]),

                sourceIndex: index

            };

            return trip;

        })
        .filter(trip => {

            if (CONFIG.SHOW_EMPTY_TRIPS) {
                return true;
            }

            return hasTripData(trip);

        });

}


/*==========================================================================*
 * TRIP VALIDATION
 *==========================================================================*/

/**
 * Determine whether a row represents an actual trip.
 */
function hasTripData(trip) {

    return Boolean(
        trip.tripNumber ||
        trip.activity ||
        trip.departureCampus ||
        trip.destination ||
        trip.address
    );

}


/*==========================================================================*
 * FILTERING
 *==========================================================================*/

/**
 * Filter invalid rows while preserving all real trips.
 */
function filterTrips(trips) {

    return trips.filter(trip => {

        return hasTripData(trip);

    });

}


/*==========================================================================*
 * PAGE BUILDING
 *==========================================================================*/

/**
 * Split trips into display pages.
 */
function buildPages() {

    App.pages = [];

    const trips = App.filteredTrips;

    if (!trips.length) {
        App.pages.push([]);
        return;
    }

    for (
        let i = 0;
        i < trips.length;
        i += CONFIG.ROWS_PER_PAGE
    ) {

        App.pages.push(
            trips.slice(
                i,
                i + CONFIG.ROWS_PER_PAGE
            )
        );

    }

}


/*==========================================================================*
 * PAGE RENDERING
 *==========================================================================*/

/**
 * Render the current page.
 */
function renderCurrentPage() {

    if (!DOM.tableBody) {

        locateTableBody();

    }

    if (!DOM.tableBody) {

        console.warn(
            "Trip table body was not found."
        );

        return;

    }

    const page =
        App.pages[App.currentPage] || [];

    clearTable();

    if (!page.length) {

        renderEmptyState();

    }

    else {

        page.forEach(
            (trip, index) => {

                renderTripRow(
                    trip,
                    index
                );

            }
        );

    }

    updatePageNumber();

    forceLayoutRefresh();

}


/**
 * Locate tbody if it wasn't available during initialization.
 */
function locateTableBody() {

    if (!DOM.table) {

        DOM.table =
            document.querySelector("table");

    }

    if (DOM.table) {

        DOM.tableBody =
            DOM.table.querySelector("tbody");

    }

}


/**
 * Remove existing table rows.
 */
function clearTable() {

    if (!DOM.tableBody) {
        return;
    }

    while (DOM.tableBody.firstChild) {

        DOM.tableBody.removeChild(
            DOM.tableBody.firstChild
        );

    }

}


/*==========================================================================*
 * ROW CREATION
 *==========================================================================*/

/**
 * Create a complete trip row.
 */
function renderTripRow(trip, rowIndex) {

    const tr =
        document.createElement("tr");

    tr.className =
        "trip-row";

    tr.dataset.tripNumber =
        trip.tripNumber || "";

    tr.dataset.status =
        normalizeStatus(trip.status);

    tr.dataset.rowIndex =
        String(rowIndex);

    /*---------------------------------------------------------------------*
     * Trip #
     *---------------------------------------------------------------------*/

    appendCell(
        tr,
        trip.tripNumber,
        "trip-number"
    );

    /*---------------------------------------------------------------------*
     * Status
     *---------------------------------------------------------------------*/

    const statusCell =
        appendCell(
            tr,
            formatStatus(trip.status),
            "status"
        );

    applyStatusClass(
        statusCell,
        trip.status
    );

    /*---------------------------------------------------------------------*
     * Activity
     *---------------------------------------------------------------------*/

    appendCell(
        tr,
        trip.activity,
        "activity"
    );

    /*---------------------------------------------------------------------*
     * Departure Campus
     *---------------------------------------------------------------------*/

    appendCell(
        tr,
        trip.departureCampus,
        "departure-campus"
    );

    /*---------------------------------------------------------------------*
     * Clock In
     *---------------------------------------------------------------------*/

    appendCell(
        tr,
        formatTime(trip.clockIn),
        "clock-in"
    );

    /*---------------------------------------------------------------------*
     * Depart Load
     *---------------------------------------------------------------------*/

    appendCell(
        tr,
        formatTime(trip.departLoad),
        "depart-load"
    );

    /*---------------------------------------------------------------------*
     * Return Date/Time
     *---------------------------------------------------------------------*/

    appendCell(
        tr,
        formatReturnDateTime(
            trip.returnDateTime
        ),
        "return-date-time"
    );

    /*---------------------------------------------------------------------*
     * Destination
     *---------------------------------------------------------------------*/

    appendCell(
        tr,
        trip.destination,
        "destination"
    );

    /*---------------------------------------------------------------------*
     * Address
     *---------------------------------------------------------------------*/

    appendCell(
        tr,
        trip.address,
        "address"
    );

    /*---------------------------------------------------------------------*
     * # Busses
     *---------------------------------------------------------------------*/

    appendCell(
        tr,
        trip.buses,
        "buses"
    );

    /*---------------------------------------------------------------------*
     * Sponsor
     *---------------------------------------------------------------------*/

    appendCell(
        tr,
        trip.sponsor,
        "sponsor"
    );

    DOM.tableBody.appendChild(tr);

}


/**
 * Safely add a table cell.
 */
function appendCell(
    row,
    value,
    className
) {

    const td =
        document.createElement("td");

    td.className =
        className || "";

    td.textContent =
        cleanDisplayValue(value);

    row.appendChild(td);

    return td;

}


/*==========================================================================*
 * DISPLAY VALUE CLEANUP
 *==========================================================================*/

/**
 * Clean values without injecting HTML.
 */
function cleanDisplayValue(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }

    return String(value).trim();

}


/*==========================================================================*
 * STATUS
 *==========================================================================*/

/**
 * Normalize status.
 */
function normalizeStatus(status) {

    const value =
        cleanDisplayValue(status)
            .toUpperCase();

    if (
        value.includes("COVER")
    ) {

        return "covered";

    }

    if (
        value.includes("DROP")
    ) {

        return "drop-off";

    }

    if (
        value.includes("OPEN")
    ) {

        return "open";

    }

    return value
        .toLowerCase()
        .replace(/\s+/g, "-");

}


/**
 * Format status for display.
 */
function formatStatus(status) {

    const normalized =
        normalizeStatus(status);

    switch (normalized) {

        case "covered":
            return "COVERED";

        case "open":
            return "OPEN";

        case "drop-off":
            return "DROP OFF";

        default:

            return cleanDisplayValue(
                status
            ).toUpperCase();

    }

}


/**
 * Apply status classes.
 */
function applyStatusClass(
    cell,
    status
) {

    if (!cell) {
        return;
    }

    const normalized =
        normalizeStatus(status);

    cell.classList.remove(
        "covered",
        "open",
        "drop-off",
        "status-covered",
        "status-open",
        "status-drop-off"
    );

    if (normalized === "covered") {

        cell.classList.add(
            "covered",
            "status-covered"
        );

    }

    else if (normalized === "open") {

        cell.classList.add(
            "open",
            "status-open"
        );

    }

    else if (
        normalized === "drop-off"
    ) {

        cell.classList.add(
            "drop-off",
            "status-drop-off"
        );

    }

}


/*==========================================================================*
 * TIME FORMATTING
 *==========================================================================*/

/**
 * Format clock/load time while preserving spreadsheet text
 * when it cannot safely be interpreted.
 */
function formatTime(value) {

    const text =
        cleanDisplayValue(value);

    if (!text) {
        return "";
    }

    const parsed =
        parseDateValue(text);

    if (!parsed) {
        return text;
    }

    const hours =
        parsed.getHours();

    const minutes =
        parsed.getMinutes();

    const suffix =
        hours >= 12
            ? "PM"
            : "AM";

    const displayHour =
        hours % 12 || 12;

    return (
        String(displayHour) +
        ":" +
        String(minutes).padStart(2, "0") +
        " " +
        suffix
    );

}


/**
 * Format return date/time.
 *
 * If the spreadsheet contains a recognizable date,
 * show MM/DD/YYYY h:mm AM/PM.
 */
function formatReturnDateTime(value) {

    const text =
        cleanDisplayValue(value);

    if (!text) {
        return "";
    }

    const parsed =
        parseDateValue(text);

    if (!parsed) {
        return text;
    }

    const month =
        String(
            parsed.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            parsed.getDate()
        ).padStart(2, "0");

    const year =
        parsed.getFullYear();

    const hours =
        parsed.getHours();

    const minutes =
        parsed.getMinutes();

    const suffix =
        hours >= 12
            ? "PM"
            : "AM";

    const displayHour =
        hours % 12 || 12;

    return (
        month +
        "/" +
        day +
        "/" +
        year +
        " " +
        displayHour +
        ":" +
        String(minutes).padStart(2, "0") +
        " " +
        suffix
    );

}


/**
 * Safely parse common spreadsheet date formats.
 */
function parseDateValue(value) {

    if (!value) {
        return null;
    }

    const text =
        String(value).trim();

    /*---------------------------------------------------------------------*
     * ISO / normal browser date parsing
     *---------------------------------------------------------------------*/

    const direct =
        new Date(text);

    if (
        !Number.isNaN(
            direct.getTime()
        )
    ) {

        return direct;

    }

    /*---------------------------------------------------------------------*
     * MM/DD/YYYY [time]
     *---------------------------------------------------------------------*/

    const match =
        text.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(.+))?$/
        );

    if (!match) {
        return null;
    }

    let year =
        Number(match[3]);

    if (year < 100) {
        year += 2000;
    }

    let hours = 0;

    let minutes = 0;

    let seconds = 0;

    if (match[4]) {

        const timeMatch =
            match[4].match(
                /(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)?/i
            );

        if (timeMatch) {

            hours =
                Number(
                    timeMatch[1]
                );

            minutes =
                Number(
                    timeMatch[2] || 0
                );

            seconds =
                Number(
                    timeMatch[3] || 0
                );

            const meridiem =
                (
                    timeMatch[4] || ""
                ).toUpperCase();

            if (meridiem === "PM" && hours < 12) {
                hours += 12;
            }

            if (meridiem === "AM" && hours === 12) {
                hours = 0;
            }

        }

    }

    const result =
        new Date(
            year,
            Number(match[1]) - 1,
            Number(match[2]),
            hours,
            minutes,
            seconds
        );

    return Number.isNaN(
        result.getTime()
    )
        ? null
        : result;

}


/*==========================================================================*
 * EMPTY / ERROR STATES
 *==========================================================================*/

/**
 * Display no-trip message.
 */
function renderEmptyState() {

    const tr =
        document.createElement("tr");

    tr.className =
        "empty-row";

    const td =
        document.createElement("td");

    td.colSpan = 11;

    td.className =
        "empty-message";

    td.textContent =
        "NO TRIPS AVAILABLE";

    tr.appendChild(td);

    DOM.tableBody.appendChild(tr);

}


/**
 * Display data loading error.
 */
function renderErrorState() {

    if (!DOM.tableBody) {
        return;
    }

    clearTable();

    const tr =
        document.createElement("tr");

    tr.className =
        "error-row";

    const td =
        document.createElement("td");

    td.colSpan = 11;

    td.className =
        "error-message";

    td.textContent =
        "Unable to load transportation trip data.";

    tr.appendChild(td);

    DOM.tableBody.appendChild(tr);

}


/*==========================================================================*
 * PAGE NUMBER
 *==========================================================================*/

/**
 * Update page indicator.
 */
function updatePageNumber() {

    const total =
        Math.max(
            App.pages.length,
            1
        );

    const current =
        Math.min(
            App.currentPage + 1,
            total
        );

    const text =
        `${current} / ${total}`;

    if (DOM.pageNumber) {

        DOM.pageNumber.textContent =
            text;

    }

    if (DOM.pageContainer) {

        DOM.pageContainer.setAttribute(
            "data-page",
            text
        );

    }

}


/*==========================================================================*
 * PAGING
 *==========================================================================*/

/**
 * Move to next page.
 */
function nextPage() {

    if (App.pages.length <= 1) {
        return;
    }

    App.currentPage++;

    if (
        App.currentPage >=
        App.pages.length
    ) {

        App.currentPage = 0;

    }

    renderCurrentPage();

}


/**
 * Move to previous page.
 */
function previousPage() {

    if (App.pages.length <= 1) {
        return;
    }

    App.currentPage--;

    if (App.currentPage < 0) {

        App.currentPage =
            App.pages.length - 1;

    }

    renderCurrentPage();

}


/**
 * Start/restart 20-second page timer.
 */
function startPageTimer() {

    stopPageTimer();

    if (!CONFIG.AUTO_PAGE) {
        return;
    }

    if (App.pages.length <= 1) {
        return;
    }

    App.pageTimer =
        setInterval(
            nextPage,
            CONFIG.PAGE_DURATION
        );

}


/**
 * Stop page timer.
 */
function stopPageTimer() {

    if (App.pageTimer) {

        clearInterval(
            App.pageTimer
        );

        App.pageTimer = null;

    }

}


/*==========================================================================*
 * DATA REFRESH
 *==========================================================================*/

/**
 * Start spreadsheet refresh.
 */
function startRefreshTimer() {

    stopRefreshTimer();

    App.refreshTimer =
        setInterval(
            refreshData,
            CONFIG.REFRESH_INTERVAL
        );

}


/**
 * Stop spreadsheet refresh.
 */
function stopRefreshTimer() {

    if (App.refreshTimer) {

        clearInterval(
            App.refreshTimer
        );

        App.refreshTimer = null;

    }

}


/**
 * Refresh data while attempting to preserve the current page.
 */
async function refreshData() {

    if (App.loading) {
        return;
    }

    const oldTripCount =
        App.filteredTrips.length;

    const oldPage =
        App.currentPage;

    await loadTrips();

    if (
        oldTripCount ===
        App.filteredTrips.length
    ) {

        App.currentPage =
            Math.min(
                oldPage,
                Math.max(
                    App.pages.length - 1,
                    0
                )
            );

        renderCurrentPage();

    }

}


/*==========================================================================*
 * CONNECTION STATUS
 *==========================================================================*/

/**
 * Update LIVE/OFFLINE status.
 */
function updateConnectionStatus(status) {

    if (!DOM.connectionStatus) {
        return;
    }

    DOM.connectionStatus.textContent =
        status;

    DOM.connectionStatus.classList.remove(
        "live",
        "offline",
        "loading",
        "error"
    );

    const normalized =
        String(status)
            .toLowerCase();

    if (normalized === "live") {

        DOM.connectionStatus.classList.add(
            "live"
        );

    }

    else if (
        normalized === "offline"
    ) {

        DOM.connectionStatus.classList.add(
            "offline"
        );

    }

    else if (
        normalized === "loading"
    ) {

        DOM.connectionStatus.classList.add(
            "loading"
        );

    }

    else {

        DOM.connectionStatus.classList.add(
            "error"
        );

    }

}


/*==========================================================================*
 * LAST UPDATED
 *==========================================================================*/

/**
 * Update last-updated indicator.
 */
function updateLastUpdated() {

    if (!DOM.lastUpdated) {
        return;
    }

    if (!App.lastUpdated) {
        return;
    }

    DOM.lastUpdated.textContent =
        App.lastUpdated.toLocaleTimeString(
            "en-US",
            {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit"
            }
        );

}


/*==========================================================================*
 * LED / DISPLAY OPTIMIZATION
 *==========================================================================*/

/**
 * Force browser to recalculate table layout.
 *
 * This is useful for Chromium-based players and
 * LED display browser environments.
 */
function forceLayoutRefresh() {

    if (!DOM.table) {
        return;
    }

    void DOM.table.offsetHeight;

    requestAnimationFrame(() => {

        if (DOM.table) {

            DOM.table.style.visibility =
                "hidden";

            void DOM.table.offsetHeight;

            DOM.table.style.visibility =
                "visible";

        }

    });

}


/*==========================================================================*
 * VISIBILITY HANDLING
 *==========================================================================*/

/**
 * Pause timers when browser tab is hidden.
 *
 * Resume cleanly when visible again.
 */
function installVisibilityHandler() {

    document.addEventListener(
        "visibilitychange",
        () => {

            if (document.hidden) {

                stopPageTimer();

                stopRefreshTimer();

            }

            else {

                startPageTimer();

                if (CONFIG.AUTO_REFRESH) {
                    startRefreshTimer();
                }

                refreshData();

            }

        }
    );

}


/*==========================================================================*
 * RESIZE HANDLING
 *==========================================================================*/

/**
 * Refresh layout when display size changes.
 */
function installResizeHandler() {

    let resizeTimer = null;

    window.addEventListener(
        "resize",
        () => {

            clearTimeout(
                resizeTimer
            );

            resizeTimer =
                setTimeout(
                    () => {

                        forceLayoutRefresh();

                    },
                    250
                );

        }
    );

}


/*==========================================================================*
 * UNLOAD CLEANUP
 *==========================================================================*/

/**
 * Clean timers before page unload.
 */
function installUnloadHandler() {

    window.addEventListener(
        "beforeunload",
        () => {

            App.destroyed = true;

            stopPageTimer();

            stopRefreshTimer();

        }
    );

}


/*==========================================================================*
 * KEYBOARD CONTROLS
 *==========================================================================*/

/**
 * Optional keyboard controls for testing on a computer.
 *
 * LEFT  = previous page
 * RIGHT = next page
 * R     = refresh
 */
document.addEventListener(
    "keydown",
    event => {

        if (event.key === "ArrowRight") {

            nextPage();

        }

        else if (event.key === "ArrowLeft") {

            previousPage();

        }

        else if (
            event.key.toLowerCase() === "r"
        ) {

            refreshData();

        }

    }
);


/*==========================================================================*
 * NETWORK STATUS
 *==========================================================================*/

window.addEventListener(
    "online",
    () => {

        if (!App.loading) {

            refreshData();

        }

    }
);


window.addEventListener(
    "offline",
    () => {

        updateConnectionStatus(
            CONFIG.OFFLINE_TEXT
        );

    }
);


/*==========================================================================*
 * PUBLIC API
 *
 * These functions are intentionally exposed so the existing HTML can
 * optionally call them without modification to this script.
 *==========================================================================*/

window.SheldonTransportationBoard = {

    refresh: refreshData,

    nextPage: nextPage,

    previousPage: previousPage,

    getTrips: () => App.trips,

    getPages: () => App.pages,

    getCurrentPage: () =>
        App.currentPage + 1,

    getStatus: () => ({
        online: App.online,
        loading: App.loading,
        tripCount: App.filteredTrips.length,
        pageCount: App.pages.length,
        currentPage: App.currentPage + 1,
        lastUpdated: App.lastUpdated
    })

};


/*==========================================================================*
 * STARTUP COMPLETE
 *==========================================================================*/

/**
 * Final safety check.
 *
 * If the HTML table is injected or loaded slightly later than the script,
 * try again shortly after initialization.
 */
setTimeout(() => {

    if (
        !DOM.tableBody &&
        !App.destroyed
    ) {

        cacheDOM();

        if (DOM.tableBody) {

            renderCurrentPage();

        }

    }

}, 1000);


/*==========================================================================*
 * END VERSION 11.2
 *==========================================================================*/