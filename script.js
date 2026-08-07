/*=========================================================
    SHELDON ISD TRANSPORTATION
    TRIP SELECTION BOARD
    VERSION 2.0
    PART 1 OF 5
=========================================================*/

/*=========================================================
    CONFIGURATION
=========================================================*/

const CSV_URL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vQNfRBXyIa0ZceWPuKpNJuB38Z1V8UfG9rHSwDaXZ1jQjGeB0lgLiifX_vdl6DHk4Z-6Rm-x_M2m8FQ/pub?gid=507419977&single=true&output=csv";

const REFRESH_INTERVAL = 30000;

const SCROLL_INTERVAL = 35;

const SCROLL_PAUSE = 2000;

/*=========================================================
    DOM ELEMENTS
=========================================================*/

const tableBody =
document.getElementById("tripBody");

const currentDate =
document.getElementById("currentDate");

const lastUpdated =
document.getElementById("lastUpdated");

const connectionStatus =
document.getElementById("connectionStatus");

const tableContainer =
document.querySelector(".table-container");

/*=========================================================
    HEADER
=========================================================*/

function updateHeader(){

    const now = new Date();

    currentDate.textContent =
        now.toLocaleDateString(
            "en-US",
            {
                weekday:"long",
                month:"long",
                day:"numeric",
                year:"numeric"
            }
        );

    lastUpdated.innerHTML =
        "Last Updated<br>" +
        now.toLocaleTimeString(
            [],
            {
                hour:"numeric",
                minute:"2-digit"
            }
        );

}

/*=========================================================
    CONNECTION STATUS
=========================================================*/

function setOnline(){

    connectionStatus.className =
        "online";

    connectionStatus.textContent =
        "● LIVE";

}

function setOffline(){

    connectionStatus.className =
        "offline";

    connectionStatus.textContent =
        "● OFFLINE";

}

/*=========================================================
    LOAD GOOGLE SHEET
=========================================================*/

function loadTrips(){

    Papa.parse(

        CSV_URL,

        {

            download:true,

            header:true,

            skipEmptyLines:true,

            complete:function(results){

                setOnline();

                updateHeader();

                processTrips(results.data);

            },

            error:function(error){

                console.error(error);

                setOffline();

            }

        }

    );

}

/*=========================================================
    FORMAT DATE / TIME
=========================================================*/

function formatDateTime(value){

    if(!value) return "";

    const date = new Date(value);

    if(isNaN(date)) return value;

    const datePart = date.toLocaleDateString(
        "en-US",
        {
            month:"2-digit",
            day:"2-digit",
            year:"2-digit"
        }
    );

    const timePart = date.toLocaleTimeString(
        "en-US",
        {
            hour:"numeric",
            minute:"2-digit"
        }
    );

    return `
        ${datePart}
        <br>
        ${timePart}
    `;

}

/*=========================================================
    STATUS BADGE
=========================================================*/

function statusBadge(status){

    if(!status){

        return `
            <span class="badge covered">
                N/A
            </span>
        `;

    }

    const value = status.toString().trim();

    const upper = value.toUpperCase();

    let css = "covered";

    if(upper === "OPEN"){

        css = "open";

    }
    else if(upper === "DROP OFF"){

        css = "drop";

    }
    else if(upper.startsWith("C")){

        css = "covered";

    }

    return `
        <span class="badge ${css}">
            ${value}
        </span>
    `;

}

/*=========================================================
    BUS BADGE
=========================================================*/

function busBadge(value){

    if(
        value === "" ||
        value === null ||
        value === undefined
    ){

        return "";

    }

    return `
        <div class="busBadge">
            ${value}
        </div>
    `;

}

/*=========================================================
    SORT BY DEPARTURE
=========================================================*/

function sortTrips(data){

    return data.sort(function(a,b){

        const first =
            new Date(a["Depart Date/time"]);

        const second =
            new Date(b["Depart Date/time"]);

        return first - second;

    });

}

/*=========================================================
    PROCESS TRIPS
=========================================================*/

function processTrips(data){

    const activeTrips = data.filter(function(row){

        return row["Trip #"];

    });

    if(activeTrips.length === 0){

        tableBody.innerHTML = `
            <tr>
                <td colspan="12" class="emptyMessage">
                    No Active Trips Available
                </td>
            </tr>
        `;

        return;

    }

    const sortedTrips = sortTrips(activeTrips);

    buildTable(sortedTrips);

}

/*=========================================================
    BUILD TABLE
=========================================================*/

function buildTable(data){

    tableBody.innerHTML = "";

    data.forEach(function(row){

        const tripNumber =
            row["Trip #"] || "";

        const status =
            row["Cover Status"] || "";

        const activity =
            row["Activity"] || "";

        const campus =
            row["Departure Campus"] || "";

        const clockIn =
            row["Clock in time"] || "";

        const loadTime =
            row["Depart load time"] || "";

        const depart =
            row["Depart Date/time"] || "";

        const returning =
            row["Return Date/time"] || "";

        const destination =
            row["Destination"] || "";

        const address =
            row["Address"] || "";

        const buses =
            row["# Buses"] || "";

        const sponsor =
            row["Sponsor"] || "";

        const tr =
            document.createElement("tr");

        tr.innerHTML = `

<td>${tripNumber}</td>

<td>${statusBadge(status)}</td>

<td>${activity}</td>

<td>${campus}</td>

<td>${clockIn}</td>

<td>${loadTime}</td>

<td class="dateTime">
${formatDateTime(depart)}
</td>

<td class="dateTime">
${formatDateTime(returning)}
</td>

<td>${destination}</td>

<td>${address}</td>

<td>
${busBadge(buses)}
</td>

<td>${sponsor}</td>

`;

        tableBody.appendChild(tr);

    });

}

/*=========================================================
    REFRESH TABLE
=========================================================*/

function refreshBoard(){

    loadTrips();

}

/*=========================================================
    MANUAL REFRESH
=========================================================*/

function forceRefresh(){

    refreshBoard();

    updateHeader();

}

/*=========================================================
    AUTO SCROLL
=========================================================*/

let scrollDirection = 1;

let pauseUntil = 0;

function autoScroll(){

    const now = Date.now();

    if(now < pauseUntil){

        return;

    }

    const maxScroll =
        tableContainer.scrollHeight -
        tableContainer.clientHeight;

    if(maxScroll <= 0){

        return;

    }

    tableContainer.scrollTop += scrollDirection;

    if(tableContainer.scrollTop >= maxScroll){

        tableContainer.scrollTop = maxScroll;

        scrollDirection = -1;

        pauseUntil = now + SCROLL_PAUSE;

    }

    if(tableContainer.scrollTop <= 0){

        tableContainer.scrollTop = 0;

        scrollDirection = 1;

        pauseUntil = now + SCROLL_PAUSE;

    }

}

/*=========================================================
    START AUTO SCROLL
=========================================================*/

setInterval(

    autoScroll,

    SCROLL_INTERVAL

);

/*=========================================================
    AUTO REFRESH
=========================================================*/

setInterval(

    refreshBoard,

    REFRESH_INTERVAL

);

/*=========================================================
    KEYBOARD SHORTCUTS
=========================================================*/

document.addEventListener(

    "keydown",

    function(event){

        switch(event.key){

            case "r":

            case "R":

                forceRefresh();

                break;

            case "Home":

                tableContainer.scrollTop = 0;

                break;

            case "End":

                tableContainer.scrollTop =
                    tableContainer.scrollHeight;

                break;

        }

    }

);

/*=========================================================
    WINDOW RESIZE
=========================================================*/

window.addEventListener(

    "resize",

    function(){

        tableContainer.scrollTop = 0;

    }

);

/*=========================================================
    PAGE VISIBILITY
=========================================================*/

document.addEventListener(

    "visibilitychange",

    function(){

        if(!document.hidden){

            refreshBoard();

        }

    }

);

/*=========================================================
    APPLICATION STARTUP
=========================================================*/

function initializeDashboard(){

    console.clear();

    console.log(
        "========================================"
    );

    console.log(
        " Sheldon ISD Transportation Dashboard "
    );

    console.log(
        " Version 2.0"
    );

    console.log(
        "========================================"
    );

    updateHeader();

    loadTrips();

}

/*=========================================================
    INITIAL LOADING MESSAGE
=========================================================*/

tableBody.innerHTML = `

<tr>

<td colspan="12" class="emptyMessage">

Loading Transportation Trips...

</td>

</tr>

`;

/*=========================================================
    START APPLICATION
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    function(){

        initializeDashboard();

    }

);

/*=========================================================
    HEARTBEAT
=========================================================*/

setInterval(function(){

    updateHeader();

},60000);

/*=========================================================
    NETWORK STATUS
=========================================================*/

window.addEventListener(

    "online",

    function(){

        setOnline();

        refreshBoard();

    }

);

window.addEventListener(

    "offline",

    function(){

        setOffline();

    }

);

/*=========================================================
    ERROR HANDLING
=========================================================*/

window.onerror = function(message,url,line){

    console.error(

        "Dashboard Error:",

        message,

        "Line:",

        line

    );

};

/*=========================================================
    FINAL INITIALIZATION
=========================================================*/

console.log(

    "Dashboard Ready"

);

/*=========================================================
    VERSION
=========================================================*/

const DASHBOARD_VERSION = "2.0";

/*=========================================================
    END OF FILE
=========================================================*/






