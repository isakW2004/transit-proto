const AGENCY_ID = 88;
const APP_ID = "_RIDER";
const API_KEY = "c620b8fe5fdbd6107da8c8381f4345b4";

const CONNECTION_NAMES = {
    spaul: "Saint Paul",
    ebank: "East Bank",
    wbank: "West Bank",
    svillage: "Stadium Village",
    dinky: "Dinkytown"
}

const DAY_CODE = ["U", "M", "T", "W", "R", "F", "S"];

async function ptRequest(controller, action) {
    var request = new Request(
        "//api.peaktransit.com/v5/index.php" +
        "?app_id=" + encodeURIComponent(APP_ID) +
        "&key=" + encodeURIComponent(API_KEY) +
        "&controller=" + encodeURIComponent(controller) +
        "&action=" + encodeURIComponent((action) ? action : "list") +
        "&agencyID=" + encodeURIComponent(AGENCY_ID)
    );
    var response = await fetch(request);
    var text = await response.text();
    return JSON.parse(text);
}

class Route {
    constructor(info) {
        this.schedule = new RouteSchedule(info.schedule);
        this.code = info.code;
        this.name = info.name;
        this.color = info.color;
        this.connects = info.connects;
        this.link = info.link;
    }

    stops = [];

    static all = [];

    static getRouteByCode(code) {
        return Route.all.find((el) => el.code == code);
    }

    static getRouteById(id) {
        return Route.all.find((el) => el.schedule.routeIds.includes(id));
    }

    static async getRouteInfo() {
        var request = new Request("routes.json");
        var response = await fetch(request);
        var data = JSON.parse(await response.text());
        var output = [];
        for (var route of data) {
            output.push(new Route(route));
        }
        return output;
    }
}

class RouteSchedule {
    constructor(info) {
        this.servicePeriods = [];
        this.routeIds = [];
        for (var pi of info) {
            var period = {
                from: new Time(pi.from),
                to: new Time(pi.to),
                freq: pi.freq,
                routeId: pi.routeId,
                days: pi.days
            };
            if (!this.routeIds.includes(pi.routeId)) {
                this.routeIds.push(pi.routeId);
            }
            this.servicePeriods.push(period);
        }
    }

    static periodInService(period) {
        var todayDay = (new Date).getDay();
        var timeNow = Time.now();
        if (period.to.compareTo(period.from) == -1 && period.to.compareTo(timeNow) == 1) {
            return period.days.includes(DAY_CODE[(todayDay == 0) ? 6 : (todayDay - 1)]);
        }
        var todayCode = DAY_CODE[todayDay];
        return period.days.includes(todayCode) &&
            period.from.compareTo(timeNow) != 1 &&
            period.to.compareTo(timeNow) == 1;
    }
}

class Time {
    constructor(timeString, zone) {
        var splitString = timeString.split(":");
        this.hour = parseInt(splitString[0]);
        this.min = parseInt(splitString[1]);
        this.zone = (zone ? zone : "CST");
        this._standardize();
    }

    static now() {
        var nowDate = new Date();
        return new Time(
            nowDate.toLocaleTimeString(
                "en-US",
                {
                    timeZone: "America/Chicago",
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit"
                }
            )
        )
    }

    _standardize() {
        if (this.min > 59) {
            this.hour += Math.floor(this.min / 60)
            this.min = this.min % 60;
        }
        if (this.hour > 23) {
            this.hour = this.hour % 24;
        }
    }

    toNextDate() {
        var today = new Date;
        if (today.getHours() > this.hour || (today.getHours() == this.hour && today.getMinutes() > this.min)) {
            today.setDate(today.getDate() + 1);
        }
        return new Date(today.toDateString() + " " + this.hour + ":" + this.min + " " + this.zone);
    }

    to12hTimeString() {
        return this.toNextDate().toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "numeric",
        });
    }

    compareTo(time) {
        var date1 = this.toNextDate(),
            date2 = time.toNextDate();
        if (date1.getHours() == date2.getHours()) {
            if (date1.getMinutes() > date2.getMinutes()) {
                return 1
            } else if (date1.getMinutes() < date2.getMinutes()) {
                return -1
            }
            return 0;
        }
        if (date1.getHours() > date2.getHours()) {
            return 1;
        }
        return -1;
    }
}

class CardGrid {
    constructor(root) {
        this.root = root;
    }

    static appearAnimation = [
        { transform: "translateY(20px)", filter: "opacity(0)" },
        { transform: "translateY(0)", filter: "opacity(1)" }
    ]

    static appearTiming = {
        duration: 300,
        easing: "ease"
    }

    spawnCard(card) {
        this.root.appendChild(card);
        this.cards.push(card);
        card.style.visibility = "hidden";
    }

    static animateAppear(card) {
        card.style.visibility = "visible";
        card.animate(CardGrid.appearAnimation, CardGrid.appearTiming);
    }

    static bulkAnimate(cards, start) {
        if (!start) {
            var start = 0;
        }
        if (start >= cards.length) {
            return;
        }
        CardGrid.animateAppear(cards[start]);
        setTimeout(
            function () {
                CardGrid.bulkAnimate(cards, start + 1)
            },
            50
        )
    }
    cards = [];
}

class RouteCard {
    constructor(route) {
        this.root = document.importNode(
            document.getElementById("route-card-template").content,
            true
        );
        this.root.firstElementChild.style.background = route.color;
        this.root.firstElementChild.href = route.link;
        this.root.querySelector(".route-code").innerText = route.code;
        this.root.querySelector(".route-name").innerText = route.name;
        this.chipSet = this.root.querySelector(".route-chip-set");
        for (var connection of route.connects) {
            var chip = document.createElement("span");
            chip.classList.add("chip");
            chip.innerText = CONNECTION_NAMES[connection];
            this.chipSet.appendChild(chip);
        }
    }
}

async function loadContent() {
    Route.all = await Route.getRouteInfo();
    var routeGrid = new CardGrid(document.getElementById("route-grid"));
    for (var route of Route.all) {
        var card = new RouteCard(route);
        routeGrid.spawnCard(card.root.firstElementChild);
    }
    CardGrid.bulkAnimate(routeGrid.cards);
    var locationGranted = await navigator.permissions.query({ name: "geolocation" });
    if (locationGranted.state == "granted") {
        await StopGrid.load();
    } else if (locationGranted == "denied") {
        document.getElementById("nearby-section").hidden = true;
    }
}

class Stop {
    constructor(info) {
        this.id = info.stopID;
        this.name = this.parseName(info.longName);
        this.pos = new Position(info.lat, info.lng);
        this.sheltered = info.sheltered == 1;
    }

    routes = [];

    etas = [];

    servicePeriods = [];

    static all = [];

    parseName(name) {
        var splitName = name.split(/(?<=Stop [\d]{1,}[ :,]{1,} )/gmi);
        return (splitName.length > 1) ? splitName[1] : name;
    }

    static getStopById(id) {
        return Stop.all.find((el) => el.id == id);
    }

    static clearEtas() {
        for (var stop of Stop.all) {
            stop.etas = [];
        }
    }

    periodsInService() {
        var periods = [];
        for (var period of this.servicePeriods) {
            if (RouteSchedule.periodInService(period)) {
                periods.push(period);
            }
        }
        return periods;
    }

    static async getRouteStops() {
        var routeStops = (await ptRequest("routestop2")).routeStops;
        var allStops = (await ptRequest("stop")).stop;
        for (var routeStopInfo of routeStops) {
            var route = Route.getRouteById(routeStopInfo.routeID);
            var stopInfo = allStops.find((el) => el.stopID == routeStopInfo.stopID);
            if (!stopInfo.disabled && !stopInfo.closed && !stopInfo.hidden && route && stopInfo.longName != "121 Night / Weekend") {
                var stop = Stop.getStopById(stopInfo.stopID);
                if (!stop) {
                    var stop = new Stop(stopInfo);
                    Stop.all.push(stop);
                }
                if (!stop.routes.includes(route)) {
                    route.stops.push(stop);
                    stop.routes.push(route);
                }
                for (var period of route.schedule.servicePeriods.filter((el) => el.routeId == routeStopInfo.routeID)) {
                    stop.servicePeriods.push(period)
                }
            }
        }
        return Stop.all;
    }

    static getClosest(position){
        for(var stop of Stop.all){
            stop.dist = Position.distance(position, stop.pos);
        }
        return Stop.all.toSorted(
            (a, b) =>{
                if(a.dist < b.dist){
                    return -1;
                }else if (a.dist > b.dist){
                    return 1;
                }
                return 0;
            }
        )
    }
}

class ETAInfo {
    constructor(info) {
        this.eta1 = info.ETA1 ? new Date(info.ETA1 * 1000) : false;
        this.eta2 = info.ETA2 ? new Date(info.ETA2 * 1000) : false;
        if (this.eta1 && this.eta1 - (new Date) < 0) {
            this.eta1 = this.eta2;
            this.eta2 = false;
        }
        this.route = Route.getRouteById(info.routeID);
        this.stop = Stop.getStopById(info.stopID);
    }

    static async refreshEta() {
        var etaData = (await ptRequest("eta")).stop;
        Stop.clearEtas();
        for (var eta of etaData) {
            if (Stop.getStopById(eta.stopID)) {
                var etaInfo = new ETAInfo(eta);
                etaInfo.stop.etas.push(etaInfo);
            }
        }
    }
}

class Position {
    constructor(lat, long) {
        this.lat = parseFloat(lat);
        this.long = parseFloat(long);
    }

    static distance(pos1, pos2) {
        var dLat = Position._rad(pos2.lat - pos1.lat);
        var dLon = Position._rad(pos2.long - pos1.long);
        var lat1 = Position._rad(pos1.lat);
        var lat2 = Position._rad(pos2.lat);

        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return c;
    }

    static _rad(val) {
        return (val * Math.PI) / 180;
    }

    static _requestLocation() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true
            });
        });
    }

    static async current() {
        var coords = (await Position._requestLocation()).coords;
        return new Position(coords.latitude, coords.longitude);
    }
}

class StopGrid {
    constructor(root) {
        this.grid = new CardGrid(root);
    }
    cards = [];
    makeCards(stopInfo) {
        for (var info of stopInfo) {
            var card = new StopCard(info.stop, info.period);
            this.grid.spawnCard(card.root.firstElementChild);
            this.cards.push(card);
        }
        CardGrid.bulkAnimate(this.grid.cards);
    }

    startUpdateInterval() {
        var grid = this;
        setTimeout(async function () {
            try {
                await ETAInfo.refreshEta();
            } catch (e) {
                console.log(e)
            }
            for (var card of grid.cards) {
                card.updateEta();
            }
            grid.startUpdateInterval();
        }, 10000)
    }

    static async load() {
        document.querySelector(".location-prompt").hidden = true;
        try{
            var location = await Position.current();
        }catch{
            document.getElementById("nearby-section").hidden = true;
        }
        await Stop.getRouteStops();
        await ETAInfo.refreshEta();
        var inService = [];
        var sortedStops = Stop.getClosest(location);
        console.log(sortedStops)
        var i= 0;
        for (var stop of sortedStops) {
            if(i == 9){
                break;
            }
            console.log(stop);
            var stopInService = stop.periodsInService();
            for (var period of stopInService) {
                inService.push({ stop: stop, period: period });
            }
            if (stopInService.length != 0){
                i++;
            }
        }
        var stopGrid = new StopGrid(document.getElementById("stop-grid"));
        stopGrid.makeCards(inService);
        stopGrid.startUpdateInterval();
    }
}

class StopCard {
    constructor(stop, period) {
        this.period = period;
        this.route = Route.getRouteById(period.routeId);
        this.stop = stop;
        this.root = document.importNode(
            document.getElementById("stop-card-template").content,
            true
        );
        this.card = this.root.firstElementChild;
        this.root.firstElementChild.style.background = this.route.color;
        this.root.querySelector(".route-code").innerText = this.route.code;
        this.root.querySelector(".stop-name").innerText = stop.name;
        this.etaBlock = this.root.querySelector(".eta");
        this.etaSubtext = this.root.querySelector(".eta-subtext");
        this.root.querySelector(".sheltered-chip").hidden = stop.sheltered;
        this.updateEta();
    }

    updateEta() {
        for (var eta of this.stop.etas) {
            var etaMin = Math.floor((eta.eta1 - (new Date)) / 60000);
            if (eta.route == this.route && this.period.freq * 4 >= etaMin) {
                this.card.querySelector(".eta__text").innerText = etaMin;
                this.etaSubtext.innerText = "minute ETA"
                this.etaBlock.classList.toggle("eta--realtime", true);
                return;
            }
        }
        this.card.querySelector(".eta__text").innerText = this.period.freq;
        this.etaSubtext.innerText = "minute frequency"
        this.etaBlock.classList.toggle("eta--realtime", false);
    }
}