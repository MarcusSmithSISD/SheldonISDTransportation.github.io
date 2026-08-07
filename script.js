/*=========================================================*
 SHELDON ISD TRANSPORTATION
 TRIP SELECTION BOARD
 VERSION 8.0
 PART 1 OF 4
=========================================================*/

/*=========================================================*
 GOOGLE SHEET
=========================================================*/

const CSV_URL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vQNfRBXyIa0ZceWPuKpNJuB38Z1V8UfG9rHSwDaXZ1jQjGeB0lgLiifX_vdl6DHk4Z-6Rm-x_M2m8FQ/pub?gid=507419977&single=true&output=csv";

/*=========================================================*
 SETTINGS
=========================================================*/

const SETTINGS={

    refreshInterval:30000,

    pageDuration:20000,

    fadeSpeed:400,

    minimumRows:10

};

/*=========================================================*
 APPLICATION STATE
=========================================================*/

const APP={

    trips:[],

    pages:[],

    currentPage:0,

    rowsPerPage:10,

    refreshTimer:null,

    pageTimer:null,

    loading:false

};

/*=========================================================*
 GOOGLE SHEET COLUMNS
=========================================================*/

const COLUMN={

    trip:"Trip #",

    cover:"Cover Status",

    activity:"Activity",

    campus:"Departure Campus",

    clockIn:"Clock in time",

    loadTime:"Depart: load time",

    departure:"Depart Date/time",

    returning:"Return Date/time",

    destination:"Destination",

    address:"Address",

    buses:"# Buses",

    sponsor:"Sponsor"

};

/*=========================================================*
 DOM
=========================================================*/

const tbody=document.getElementById("tripBody");

const tripCount=document.getElementById("tripCount");

const pageNumber=document.getElementById("pageNumber");

const currentDate=document.getElementById("currentDate");

const lastUpdated=document.getElementById("lastUpdated");

const connectionStatus=document.getElementById("connectionStatus");

/*=========================================================*
 HELPERS
=========================================================*/

function clean(value){

    if(value===undefined)return"";

    if(value===null)return"";

    return String(value).trim();

}

function formatDate(value){

    if(!value)return"";

    const d=new Date(value);

    if(isNaN(d))return value;

    return d.toLocaleDateString("en-US",{

        month:"2-digit",

        day:"2-digit",

        year:"2-digit"

    });

}

function formatTime(value){

    if(!value)return"";

    const d=new Date(value);

    if(isNaN(d))return value;

    return d.toLocaleTimeString("en-US",{

        hour:"numeric",

        minute:"2-digit"

    });

}

function formatDateTime(value){

    if(!value)return"";

    return `

<div class="dateTime">

<div>${formatDate(value)}</div>

<div>${formatTime(value)}</div>

</div>

`;

}

/*=========================================================*
 HEADER
=========================================================*/

function updateHeader(){

    const now=new Date();

    currentDate.innerHTML=

        now.toLocaleDateString(

            "en-US",

            {

                weekday:"long",

                month:"long",

                day:"numeric",

                year:"numeric"

            }

        );

    lastUpdated.innerHTML=

        "Last Updated<br>"+

        now.toLocaleTimeString(

            "en-US",

            {

                hour:"numeric",

                minute:"2-digit"

            }

        );

}

/*=========================================================*
 CONNECTION
=========================================================*/

function online(){

    connectionStatus.className="online";

    connectionStatus.innerHTML="● LIVE";

}

function offline(){

    connectionStatus.className="offline";

    connectionStatus.innerHTML="● OFFLINE";

}

/*=========================================================*
 LOADING
=========================================================*/

function loading(){

tbody.innerHTML=`

<tr>

<td colspan="12" class="loading">

Loading Trips...

</td>

</tr>

`;

}

function empty(){

tbody.innerHTML=`

<tr>

<td colspan="12" class="noTrips">

No Trips Found

</td>

</tr>

`;

}

/*=========================================================*
 PART 2 OF 4
 GOOGLE SHEETS
=========================================================*/

/*=========================================================*
 LOAD GOOGLE SHEET
=========================================================*/

function loadTrips(){

    APP.loading=true;

    loading();

    Papa.parse(CSV_URL,{

        download:true,

        header:true,

        skipEmptyLines:true,

        complete:function(results){

            processTrips(results.data);

        },

        error:function(error){

            console.error(error);

            APP.loading=false;

            offline();

            empty();

        }

    });

}

/*=========================================================*
 PROCESS DATA
=========================================================*/

function processTrips(rows){

    APP.trips=[];

    rows.forEach(function(row){

        if(clean(row[COLUMN.trip])===""){

            return;

        }

        const trip={

            tripNumber:clean(row[COLUMN.trip]),

            cover:clean(row[COLUMN.cover]),

            activity:clean(row[COLUMN.activity]),

            campus:clean(row[COLUMN.campus]),

            clockIn:clean(row[COLUMN.clockIn]),

            loadTime:clean(row[COLUMN.loadTime]),

            departure:clean(row[COLUMN.departure]),

            returning:clean(row[COLUMN.returning]),

            destination:clean(row[COLUMN.destination]),

            address:clean(row[COLUMN.address]),

            buses:clean(row[COLUMN.buses]),

            sponsor:clean(row[COLUMN.sponsor]),

            departureDate:new Date(

                row[COLUMN.departure]

            )

        };

        APP.trips.push(trip);

    });

    sortTrips();

}

/*=========================================================*
 SORT TRIPS
=========================================================*/

function sortTrips(){

    APP.trips.sort(function(a,b){

        return a.departureDate-b.departureDate;

    });

    calculateRows();

}

/*=========================================================*
 CALCULATE ROWS
=========================================================*/

function calculateRows(){

    const availableHeight=

        window.innerHeight-170;

    const rowHeight=52;

    APP.rowsPerPage=Math.floor(

        availableHeight/rowHeight

    );

    if(APP.rowsPerPage<SETTINGS.minimumRows){

        APP.rowsPerPage=SETTINGS.minimumRows;

    }

    buildPages();

}

/*=========================================================*
 BUILD PAGES
=========================================================*/

function buildPages(){

    APP.pages=[];

    for(

        let i=0;

        i<APP.trips.length;

        i+=APP.rowsPerPage

    ){

        APP.pages.push(

            APP.trips.slice(

                i,

                i+APP.rowsPerPage

            )

        );

    }

    APP.currentPage=0;

    APP.loading=false;

    online();

    updateHeader();

    if(APP.pages.length===0){

        empty();

        return;

    }

    renderPage(0);

    startPaging();

}

/*=========================================================*
 PART 3 OF 4
 RENDERING ENGINE
=========================================================*/

/*=========================================================*
 RENDER PAGE
=========================================================*/

function renderPage(page){

    if(APP.pages.length===0){

        empty();

        return;

    }

    if(page>=APP.pages.length){

        page=0;

    }

    APP.currentPage=page;

    tbody.classList.add("fadeOut");

    setTimeout(function(){

        let html="";

        APP.pages[page].forEach(function(trip){

            html+=createRow(trip);

        });

        tbody.innerHTML=html;

        updateFooter();

        tbody.classList.remove("fadeOut");

        tbody.classList.add("fadeIn");

        setTimeout(function(){

            tbody.classList.remove("fadeIn");

        },SETTINGS.fadeSpeed);

    },SETTINGS.fadeSpeed);

}

/*=========================================================*
 CREATE ROW
=========================================================*/

function createRow(trip){

return `

<tr>

<td class="col-trip">
${trip.tripNumber}
</td>

<td class="col-cover">
${trip.cover}
</td>

<td class="col-activity">
${trip.activity}
</td>

<td class="col-campus">
${trip.campus}
</td>

<td class="col-clock">
${trip.clockIn}
</td>

<td class="col-load">
${trip.loadTime}
</td>

<td class="col-depart">
${formatDateTime(trip.departure)}
</td>

<td class="col-return">
${formatDateTime(trip.returning)}
</td>

<td class="col-destination">
${trip.destination}
</td>

<td class="col-address">
${trip.address}
</td>

<td class="col-bus">
${trip.buses}
</td>

<td class="col-sponsor">
${trip.sponsor}
</td>

</tr>

`;

}

/*=========================================================*
 UPDATE FOOTER
=========================================================*/

function updateFooter(){

    tripCount.innerHTML=

        "Trips: "+APP.trips.length;

    pageNumber.innerHTML=

        "Page "+

        (APP.currentPage+1)+

        " of "+

        APP.pages.length;

}

/*=========================================================*
 REFRESH HEADER
=========================================================*/

function refreshHeader(){

    updateHeader();

}

/*=========================================================*
 REFRESH FOOTER
=========================================================*/

function refreshFooter(){

    updateFooter();

}

/*=========================================================*
 REFRESH DISPLAY
=========================================================*/

function refreshDisplay(){

    refreshHeader();

    refreshFooter();

}

/*=========================================================*
 REDRAW
=========================================================*/

function redraw(){

    calculateRows();

}

/*=========================================================*
 PART 4 OF 4
 AUTO PAGING • AUTO REFRESH • STARTUP
=========================================================*/

/*=========================================================*
 START PAGE ROTATION
=========================================================*/

function startPaging(){

    stopPaging();

    if(APP.pages.length<=1){

        return;

    }

    APP.pageTimer=setInterval(function(){

        APP.currentPage++;

        if(APP.currentPage>=APP.pages.length){

            APP.currentPage=0;

        }

        renderPage(APP.currentPage);

    },SETTINGS.pageDuration);

}

/*=========================================================*
 STOP PAGE ROTATION
=========================================================*/

function stopPaging(){

    if(APP.pageTimer){

        clearInterval(APP.pageTimer);

        APP.pageTimer=null;

    }

}

/*=========================================================*
 START AUTO REFRESH
=========================================================*/

function startRefresh(){

    stopRefresh();

    APP.refreshTimer=setInterval(function(){

        loadTrips();

    },SETTINGS.refreshInterval);

}

/*=========================================================*
 STOP AUTO REFRESH
=========================================================*/

function stopRefresh(){

    if(APP.refreshTimer){

        clearInterval(APP.refreshTimer);

        APP.refreshTimer=null;

    }

}

/*=========================================================*
 WINDOW RESIZE
=========================================================*/

function handleResize(){

    stopPaging();

    calculateRows();

}

/*=========================================================*
 KEYBOARD SHORTCUTS
=========================================================*/

document.addEventListener("keydown",function(e){

    switch(e.key){

        case "ArrowRight":

            stopPaging();

            APP.currentPage++;

            if(APP.currentPage>=APP.pages.length){

                APP.currentPage=0;

            }

            renderPage(APP.currentPage);

            startPaging();

        break;

        case "ArrowLeft":

            stopPaging();

            APP.currentPage--;

            if(APP.currentPage<0){

                APP.currentPage=APP.pages.length-1;

            }

            renderPage(APP.currentPage);

            startPaging();

        break;

        case "Home":

            stopPaging();

            APP.currentPage=0;

            renderPage(APP.currentPage);

            startPaging();

        break;

        case "End":

            stopPaging();

            APP.currentPage=APP.pages.length-1;

            renderPage(APP.currentPage);

            startPaging();

        break;

    }

});

/*=========================================================*
 APPLICATION STARTUP
=========================================================*/

function initialize(){

    updateHeader();

    loading();

    loadTrips();

    startRefresh();

}

/*=========================================================*
 EVENTS
=========================================================*/

window.addEventListener(

    "resize",

    handleResize

);

document.addEventListener(

    "visibilitychange",

    function(){

        if(document.hidden){

            stopPaging();

        }else{

            startPaging();

        }

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

/*=========================================================*
 END OF FILE
 VERSION 8.0
=========================================================*/


