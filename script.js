/*=========================================================*
 SHELDON ISD TRANSPORTATION
 TRIP SELECTION BOARD
 VERSION 5.0 PRODUCTION
 SECTION 1 - CONFIGURATION & GLOBALS
=========================================================*/

/*=========================================================*
 GOOGLE SHEET
=========================================================*/

const CSV_URL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vQNfRBXyIa0ZceWPuKpNJuB38Z1V8UfG9rHSwDaXZ1jQjGeB0lgLiifX_vdl6DHk4Z-6Rm-x_M2m8FQ/pub?gid=507419977&single=true&output=csv";

/*=========================================================*
 APPLICATION SETTINGS
=========================================================*/

const SETTINGS = {

    pageDuration: 20000,

    refreshInterval: 30000,

    fadeDuration: 400,

    minimumRows: 6

};

/*=========================================================*
 APPLICATION STATE
=========================================================*/

const APP = {

    trips: [],

    pages: [],

    currentPage: 0,

    rowsPerPage: 0,

    refreshTimer: null,

    pageTimer: null,

    dataSignature: "",

    loading: false

};

/*=========================================================*
 DOM REFERENCES
=========================================================*/

const tbody = document.getElementById("tripBody");

const currentDate = document.getElementById("currentDate");

const lastUpdated = document.getElementById("lastUpdated");

const tripCount = document.getElementById("tripCount");

const pageNumber = document.getElementById("pageNumber");

const connectionStatus = document.getElementById("connectionStatus");

/*=========================================================*
 COLUMN MAP
=========================================================*/

const COLUMNS = {

    tripNumber: "Trip #",

    status: "Cover",

    activity: "Activity",

    campus: "Departing Campus",

    clockIn: "Clock In Time",

    loadTime: "Returning Load Time",

    departure: "Depart Date/time",

    returning: "Return Date/time",

    destination: "Destination",

    address: "Address",

    buses: "Bus Number",

    sponsor: "Sponsor Name"

};

/*=========================================================*
 END SECTION 1
=========================================================*/

/*=========================================================*
 SECTION 2
 HELPER FUNCTIONS
=========================================================*/

/*=========================================================*
 CLEAN VALUE
=========================================================*/

function clean(value){

    if(value === undefined) return "";

    if(value === null) return "";

    return String(value).trim();

}

/*=========================================================*
 FORMAT DATE
=========================================================*/

function formatDate(value){

    if(!value) return "";

    const date = new Date(value);

    if(isNaN(date)) return "";

    return date.toLocaleDateString(
        "en-US",
        {
            month:"2-digit",
            day:"2-digit",
            year:"numeric"
        }
    );

}

/*=========================================================*
 FORMAT TIME
=========================================================*/

function formatTime(value){

    if(!value) return "";

    const date = new Date(value);

    if(isNaN(date)) return "";

    return date.toLocaleTimeString(
        "en-US",
        {
            hour:"numeric",
            minute:"2-digit"
        }
    );

}

/*=========================================================*
 FORMAT DATE & TIME
=========================================================*/

function formatDateTime(value){

    return `
        <div class="dateTime">
            <div>${formatDate(value)}</div>
            <div>${formatTime(value)}</div>
        </div>
    `;

}

/*=========================================================*
 STATUS BADGE
=========================================================*/

function statusBadge(status){

    status = clean(status);

    if(status === ""){
        status = "OPEN";
    }

    const cssClass = status
        .toLowerCase()
        .replace(/\s+/g,"-");

    return `
        <span class="badge ${cssClass}">
            ${status}
        </span>
    `;

}

/*=========================================================*
 BUS BADGE
=========================================================*/

function busBadge(bus){

    bus = clean(bus);

    if(bus === ""){
        bus = "-";
    }

    return `
        <div class="busBadge">
            ${bus}
        </div>
    `;

}

/*=========================================================*
 ONLINE STATUS
=========================================================*/

function setOnline(){

    connectionStatus.className = "online";

    connectionStatus.innerHTML = "● LIVE";

}

/*=========================================================*
 OFFLINE STATUS
=========================================================*/

function setOffline(){

    connectionStatus.className = "offline";

    connectionStatus.innerHTML = "● OFFLINE";

}

/*=========================================================*
 UPDATE HEADER
=========================================================*/

function updateHeader(){

    const now = new Date();

    currentDate.innerHTML =
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
            "en-US",
            {
                hour:"numeric",
                minute:"2-digit"
            }
        );

}

/*=========================================================*
 LOADING SCREEN
=========================================================*/

function showLoading(){

    tbody.innerHTML = `
        <tr>
            <td colspan="12" class="loading">
                Loading Trips...
            </td>
        </tr>
    `;

}

/*=========================================================*
 EMPTY TABLE
=========================================================*/

function showEmpty(){

    tbody.innerHTML = `
        <tr>
            <td colspan="12" class="noTrips">
                No Active Trips
            </td>
        </tr>
    `;

}

/*=========================================================*
 END SECTION 2
=========================================================*/


/*=========================================================*
 SECTION 3
 GOOGLE SHEETS DATA ENGINE
=========================================================*/

/*=========================================================*
 LOAD GOOGLE SHEET
=========================================================*/

function loadTrips(){

    APP.loading = true;

    showLoading();

    Papa.parse(CSV_URL,{

        download:true,

        header:true,

        skipEmptyLines:true,

        complete:function(results){

            processTrips(results.data);

        },

        error:function(error){

            console.error(error);

            APP.loading = false;

            setOffline();

            showEmpty();

        }

    });

}

/*=========================================================*
 PROCESS GOOGLE SHEET
=========================================================*/

function processTrips(rows){

    const trips = [];

    rows.forEach(function(row){

        const trip={

            tripNumber:
                clean(row[COLUMNS.tripNumber]),

            status:
                clean(row[COLUMNS.status]),

            activity:
                clean(row[COLUMNS.activity]),

            campus:
                clean(row[COLUMNS.campus]),

            clockIn:
                clean(row[COLUMNS.clockIn]),

            loadTime:
                clean(row[COLUMNS.loadTime]),

            departure:
                clean(row[COLUMNS.departure]),

            returning:
                clean(row[COLUMNS.returning]),

            destination:
                clean(row[COLUMNS.destination]),

            address:
                clean(row[COLUMNS.address]),

            buses:
                clean(row[COLUMNS.buses]),

            sponsor:
                clean(row[COLUMNS.sponsor]),

            departureDate:
                new Date(row[COLUMNS.departure])

        };

        if(trip.tripNumber !== ""){

            trips.push(trip);

        }

    });

    trips.sort(function(a,b){

        return a.departureDate - b.departureDate;

    });

    const signature = JSON.stringify(trips);

    if(signature === APP.dataSignature){

        APP.loading = false;

        setOnline();

        updateHeader();

        return;

    }

    APP.dataSignature = signature;

    APP.trips = trips;

    APP.loading = false;

    setOnline();

    updateHeader();

    if(APP.trips.length === 0){

        showEmpty();

        return;

    }

    calculateRowsPerPage();

    buildPages();

    renderPage(0);

}

/*=========================================================*
 CALCULATE ROWS PER PAGE
=========================================================*/

function calculateRowsPerPage(){

    const headerHeight = 90;

    const footerHeight = 40;

    const padding = 85;

    const rowHeight = 48;

    const availableHeight =

        window.innerHeight -

        headerHeight -

        footerHeight -

        padding;

    APP.rowsPerPage = Math.floor(

        availableHeight / rowHeight

    );

    if(APP.rowsPerPage < SETTINGS.minimumRows){

        APP.rowsPerPage = SETTINGS.minimumRows;

    }

}

/*=========================================================*
 END SECTION 3
=========================================================*/


/*=========================================================*
 SECTION 4
 PAGING ENGINE
=========================================================*/

/*=========================================================*
 BUILD PAGES
=========================================================*/

function buildPages(){

    APP.pages = [];

    for(

        let i = 0;

        i < APP.trips.length;

        i += APP.rowsPerPage

    ){

        APP.pages.push(

            APP.trips.slice(

                i,

                i + APP.rowsPerPage

            )

        );

    }

    APP.currentPage = 0;

}

/*=========================================================*
 RENDER PAGE
=========================================================*/

function renderPage(pageIndex){

    if(APP.pages.length === 0){

        showEmpty();

        return;

    }

    if(pageIndex >= APP.pages.length){

        pageIndex = 0;

    }

    APP.currentPage = pageIndex;

    const page = APP.pages[pageIndex];

    tbody.classList.add("fadeOut");

    setTimeout(function(){

        let html = "";

        page.forEach(function(trip){

            html += createRow(trip);

        });

        tbody.innerHTML = html;

        tbody.classList.remove("fadeOut");

        tbody.classList.add("fadeIn");

        updateFooter();

        setTimeout(function(){

            tbody.classList.remove("fadeIn");

        },SETTINGS.fadeDuration);

    },SETTINGS.fadeDuration);

}

/*=========================================================*
 CREATE ROW
=========================================================*/

function createRow(trip){

    return `

<tr>

<td>

${trip.tripNumber}

</td>

<td>

${statusBadge(trip.status)}

</td>

<td>

${trip.activity}

</td>

<td>

${trip.campus}

</td>

<td>

${trip.clockIn}

</td>

<td>

${trip.loadTime}

</td>

<td>

${formatDateTime(trip.departure)}

</td>

<td>

${formatDateTime(trip.returning)}

</td>

<td>

${trip.destination}

</td>

<td>

${trip.address}

</td>

<td>

${busBadge(trip.buses)}

</td>

<td>

${trip.sponsor}

</td>

</tr>

`;

}

/*=========================================================*
 UPDATE FOOTER
=========================================================*/

function updateFooter(){

    if(APP.pages.length===0){

        tripCount.innerHTML="Active Trips: 0";

        pageNumber.innerHTML="Page 0 of 0";

        return;

    }

    const start=

        (APP.currentPage*APP.rowsPerPage)+1;

    const end=

        Math.min(

            start+

            APP.pages[APP.currentPage].length-1,

            APP.trips.length

        );

    tripCount.innerHTML=

        "Active Trips: "+

        APP.trips.length+

        " | Showing "+

        start+

        "–"+

        end+

        " of "+

        APP.trips.length;

    pageNumber.innerHTML=

        "Page "+

        (APP.currentPage+1)+

        " of "+

        APP.pages.length;

}

/*=========================================================*
 END SECTION 4
=========================================================*/

/*=========================================================*
 SECTION 5
 AUTO PAGING • AUTO REFRESH • STARTUP
=========================================================*/

/*=========================================================*
 START PAGE ROTATION
=========================================================*/

function startPaging(){

    stopPaging();

    if(APP.pages.length <= 1){

        return;

    }

    APP.pageTimer = setInterval(function(){

        let nextPage = APP.currentPage + 1;

        if(nextPage >= APP.pages.length){

            nextPage = 0;

        }

        renderPage(nextPage);

    }, SETTINGS.pageDuration);

}

/*=========================================================*
 STOP PAGE ROTATION
=========================================================*/

function stopPaging(){

    if(APP.pageTimer){

        clearInterval(APP.pageTimer);

        APP.pageTimer = null;

    }

}

/*=========================================================*
 START AUTO REFRESH
=========================================================*/

function startRefresh(){

    stopRefresh();

    APP.refreshTimer = setInterval(function(){

        loadTrips();

    }, SETTINGS.refreshInterval);

}

/*=========================================================*
 STOP AUTO REFRESH
=========================================================*/

function stopRefresh(){

    if(APP.refreshTimer){

        clearInterval(APP.refreshTimer);

        APP.refreshTimer = null;

    }

}

/*=========================================================*
 WINDOW RESIZE
=========================================================*/

function handleResize(){

    calculateRowsPerPage();

    buildPages();

    renderPage(APP.currentPage);

}

/*=========================================================*
 APPLICATION STARTUP
=========================================================*/

function initialize(){

    updateHeader();

    calculateRowsPerPage();

    loadTrips();

    startRefresh();

}

/*=========================================================*
 EVENTS
=========================================================*/

window.addEventListener(

    "resize",

    function(){

        handleResize();

    }

);

/*=========================================================*
 START APPLICATION
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    function(){

        initialize();

    }

);
