/*=========================================================*
 SHELDON ISD TRANSPORTATION
 TRIP SELECTION BOARD
 VERSION 2.0
=========================================================*/

"use strict";

/*=========================================================*
 CONFIGURATION
=========================================================*/

const CONFIG = {

    VERSION: "2.0",

    SHEET_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQNfRBXyIa0ZceWPuKpNJuB38Z1V8UfG9rHSwDaXZ1jQjGeB0lgLiifX_vdl6DHk4Z-6Rm-x_M2m8FQ/pub?gid=507419977&single=true&output=csv",

    ROWS_PER_PAGE:12,

    PAGE_INTERVAL:20000,

    REFRESH_INTERVAL:60000

};

/*=========================================================*
 GOOGLE SHEET HEADERS
=========================================================*/

const COLUMN={

    TRIP:"Trip #",

    STATUS:"Cover Status",

    ACTIVITY:"Activity",

    CAMPUS:"Departure Campus",

    CLOCK_IN:"CLOCK IN",

    LOAD_TIME:"Depart: load time",

    DEPART:"Depart Date/time",

    RETURN:"Return Date/time",

    DESTINATION:"Destination",

    ADDRESS:"Address",

    BUSES:"#Buses",

    SPONSOR:"Sponsor"

};

/*=========================================================*
 APPLICATION STATE
=========================================================*/

const STATE={

    trips:[],

    pages:[],

    currentPage:0,

    loading:false,

    online:false,

    pageTimer:null,

    refreshTimer:null,

    lastUpdated:null

};

/*=========================================================*
 DOM CACHE
=========================================================*/

const DOM={

    body:
    document.getElementById("tripBody"),

    status:
    document.getElementById("connectionStatus"),

    date:
    document.getElementById("currentDate"),

    sync:
    document.getElementById("lastSync"),

    tripCount:
    document.getElementById("tripCount"),

    pageNumber:
    document.getElementById("pageNumber"),

    version:
    document.getElementById("version"),

    refresh:
    document.getElementById("refreshTime")

};

/*=========================================================*
 STARTUP
=========================================================*/

document.addEventListener(

    "DOMContentLoaded",

    initialize

);

async function initialize(){

    DOM.version.textContent=

        "Version "+CONFIG.VERSION;

    updateDate();

    setInterval(

        updateDate,

        60000

    );

    await loadTrips();

}

/*=========================================================*
 DATE
=========================================================*/

function updateDate(){

    const now=new Date();

    DOM.date.textContent=

        now.toLocaleDateString(

            "en-US",

            {

                weekday:"long",

                month:"long",

                day:"numeric",

                year:"numeric"

            }

        );

}

/*=========================================================*
 CONNECTION STATUS
=========================================================*/

function setStatus(type,text){

    DOM.status.className=

        "status "+type;

    DOM.status.textContent=

        "● "+text;

}

/*=========================================================*
 LAST UPDATED
=========================================================*/

function updateLastUpdated(){

    const now=new Date();

    STATE.lastUpdated=now;

    DOM.sync.innerHTML=

        "Last Updated<br>"+

        now.toLocaleTimeString(

            "en-US",

            {

                hour:"numeric",

                minute:"2-digit"

            }

        );

    DOM.refresh.textContent=

        "Updated "+

        now.toLocaleTimeString(

            "en-US",

            {

                hour:"numeric",

                minute:"2-digit"

            }

        );

}


/*=========================================================*
 LOAD GOOGLE SHEET
*=========================================================*/

async function loadTrips(){

    STATE.loading = true;

    setStatus("refreshing","REFRESHING");

    try{

        const results = await new Promise((resolve,reject)=>{

            Papa.parse(

                CONFIG.SHEET_URL + "&t=" + Date.now(),

                {

                    download:true,

                    header:true,

                    skipEmptyLines:true,

                    dynamicTyping:false,

                    complete:resolve,

                    error:reject

                }

            );

        });

        processTrips(results.data);

        STATE.loading = false;

        STATE.online = true;

        updateLastUpdated();

        setStatus("live","LIVE");

    }

    catch(error){

        console.error(error);

        STATE.loading = false;

        STATE.online = false;

        setStatus("offline","OFFLINE");

    }

}

/*=========================================================*
 PROCESS TRIPS
*=========================================================*/
function processTrips(data){

    STATE.trips = data.filter(row=>{

        return row[COLUMN.TRIP];

    });

    buildBoard();

    startPageRotation();

    startRefreshTimer();

}
/*=========================================================*
 FORMAT DATE/TIME
*=========================================================*/

function formatDateTime(value){

    if(!value) return "";

    const date = new Date(value);

    if(isNaN(date)) return value;

    const month = date.toLocaleString("en-US",{
        month:"short"
    });

    const day = date.getDate();

    const time = date.toLocaleTimeString("en-US",{
        hour:"numeric",
        minute:"2-digit"
    });

    return `
        <div class="dateCell">
            <div class="dateTop">${month} ${day}</div>
            <div class="dateBottom">${time}</div>
        </div>
    `;

} 


/*=========================================================*
 STATUS BADGES
*=========================================================*/

function getStatusBadge(status){

    const value = (status || "").trim().toUpperCase();

    let css = "badge";

    let text = status || "";

    switch(value){

        case "OPEN":

            css += " open";

            text = "Open";

            break;

        case "COVER AM":

            css += " cam";

            text = "Cover AM";

            break;

        case "COVER PM":

            css += " cpm";

            text = "Cover PM";

            break;

        case "COVER 2 & 3 AM":

            css += " cam";

            text = "Cover 2 & 3 AM";

            break;

        case "COVER 2 & 3 PM":

            css += " cpm";

            text = "Cover 2 & 3 PM";

            break;

        default:

            css += " covered";

    }

    return `<span class="${css}">${text}</span>`;

}

/*=========================================================*
 BUS BADGE
*=========================================================*/

function getBusBadge(value){

    value = (value || "").trim();

    if(value === ""){
        return "&nbsp;";
    }

    return `
        <div class="busBadge">
            ${value}
        </div>
    `;

}
/*=========================================================*
 BUILD PAGES
*=========================================================*/

function buildPages(){

    STATE.pages = [];

    for(

        let i = 0;

        i < STATE.trips.length;

        i += CONFIG.ROWS_PER_PAGE

    ){

        STATE.pages.push(

            STATE.trips.slice(

                i,

                i + CONFIG.ROWS_PER_PAGE

            )

        );

    }

}

/*=========================================================*
 RENDER PAGE
*=========================================================*/

function renderPage(pageIndex){

    DOM.body.innerHTML = "";

    if(

        STATE.pages.length === 0 ||

        !STATE.pages[pageIndex]

    ){

        DOM.body.innerHTML = `

        <tr>

            <td colspan="12" class="loading">

                No Trips Found

            </td>

        </tr>

        `;

        DOM.tripCount.textContent = "Trips: 0";

        DOM.pageNumber.textContent = "Page 0 of 0";

        return;

    }

    const page = STATE.pages[pageIndex];

    page.forEach(trip=>{

        const row = document.createElement("tr");

        const campus =

            (trip[COLUMN.CAMPUS] || "")

            .replace("(KHS) C. E. KING HIGH SCHOOL","King HS")

            .replace("(KHS) CE KING HIGH SCHOOL","King HS");

        const activity =

            (trip[COLUMN.ACTIVITY] || "")

            .replace(/-/g," ");

        row.innerHTML = `

       <td class="tripNumber">${trip[COLUMN.TRIP] || ""}</td>

        <td>${getStatusBadge(trip[COLUMN.STATUS])}</td>

        <td>${activity}</td>

        <td>${campus}</td>

        <td>${trip[COLUMN.CLOCK_IN] || ""}</td>

        <td>${trip[COLUMN.LOAD_TIME] || ""}</td>

        <td>${formatDateTime(trip[COLUMN.DEPART])}</td>

        <td>${formatDateTime(trip[COLUMN.RETURN])}</td>

        <td>${trip[COLUMN.DESTINATION] || ""}</td>

        <td>${trip[COLUMN.ADDRESS] || ""}</td>

       <td>${getBusBadge(trip[COLUMN.BUSES])}</td>

        <td>${trip[COLUMN.SPONSOR] || ""}</td>

        `;

        DOM.body.appendChild(row);

    });

    updateFooter();

}

/*=========================================================*
 FOOTER
*=========================================================*/

function updateFooter(){

    DOM.tripCount.textContent =

        `Trips: ${STATE.trips.length}`;

    DOM.pageNumber.textContent =

        `Page ${STATE.currentPage + 1} of ${STATE.pages.length}`;

}

/*=========================================================*
 BUILD BOARD
*=========================================================*/
function buildBoard(){

    buildPages();

    if(STATE.currentPage >= STATE.pages.length){

        STATE.currentPage = 0;

    }

    renderPage(STATE.currentPage);

}

/*=========================================================*
 PAGE ROTATION
*=========================================================*/

function nextPage(){

    if(STATE.pages.length <= 1){

        return;

    }

    STATE.currentPage++;

    if(STATE.currentPage >= STATE.pages.length){

        STATE.currentPage = 0;

    }

    renderPage(STATE.currentPage);

}

function startPageRotation(){

    if(STATE.pageTimer){

        clearInterval(STATE.pageTimer);

    }

    STATE.pageTimer = setInterval(

        nextPage,

        CONFIG.PAGE_INTERVAL

    );

}

/*=========================================================*
 AUTO REFRESH
*=========================================================*/

function startRefreshTimer(){

    if(STATE.refreshTimer){

        clearInterval(STATE.refreshTimer);

    }

    STATE.refreshTimer = setInterval(

        async function(){

            await loadTrips();

        },

        CONFIG.REFRESH_INTERVAL

    );

}

/*=========================================================*
 START BOARD
*=========================================================*/

function startBoard(){

    buildBoard();

    startPageRotation();

    startRefreshTimer();

}

/*=========================================================*
 UPDATE PROCESS TRIPS
*=========================================================*/



/*=========================================================*
 WINDOW ERROR LOGGING
*=========================================================*/

window.addEventListener(

    "error",

    function(event){

        console.error(

            "Trip Board Error:",

            event.error

        );

    }

);