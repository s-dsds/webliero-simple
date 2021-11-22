var mapCache = new Map();
var baseURL = "https://webliero.gitlab.io/webliero-maps";
var mypool = {};
var mypoolIdx = [];

var currentMap = 0;
var currentMapName = "";

function loadPool(name) {
	(async () => {
	mypool = await (await fetch(baseURL + '/' +  name)).json();
	})();
}

function getMapUrl(name) {
    if (name.substring(0,8)=='https://') {
        return name;
    }
    return baseURL + '/' +  name;
}

async function getMapData(mapUrl) {
    let obj = mapCache.get(mapUrl)
    if (obj) {
      return obj;
    }
    try {
        obj = await (await fetch(mapUrl)).arrayBuffer();
    }catch(e) {
        return null;
    }

    
    mapCache.set(mapUrl, obj)
    return obj;
}

function loadMapByName(name) {
    console.log(name);
    (async () => {
        let data = await getMapData(getMapUrl(name));
        if (data == null) {
            notifyAdmins(`map ${name} could not be loaded`)
            window.WLROOM.restartGame();
        } else if (name.split('.').pop()=="png") {    
            window.WLROOM.loadPNGLevel(name, data);
        } else {
            window.WLROOM.loadLev(name, data);
        }
    })();
}

function loadMap(name, data) {
    console.log(data.data.length);
    console.log(data.data[2]);
    let buff=new Uint8Array(data.data).buffer;
    window.WLROOM.loadRawLevel(name,buff, data.x, data.y);
}

function resolveNextMap() {
    currentMap=currentMap+1<mypoolIdx.length?currentMap+1:0;
    currentMapName = mypool[mypoolIdx[currentMap]];
}

function next() {
    resolveNextMap();

    loadMapByName(currentMapName);
}

function shufflePool() {
    mypoolIdx = Object.keys(mypool);
    shuffleArray(mypoolIdx)
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

COMMAND_REGISTRY.add("map", ["!map #mapname#: load lev map from gitlab webliero.gitlab.io"], (player, ...name) => {
    let n = name.join(" ").trim();
    if (n == "") {
        announce("map name is empty ",player, 0xFFF0000);
    }
    currentMapName = n;
    loadMapByName(currentMapName);
    return false;
}, true);

COMMAND_REGISTRY.add("mapi", ["!mapi #index#: load map by pool index"], (player, idx) => {
    if (typeof idx=="undefined" || idx=="" || isNaN(idx) || idx>=mypool.length) {
        announce("wrong index, choose any index from 0 to "+(mypool.length-1),player, 0xFFF0000);
        return false;
    }
    currentMapName = mypool[idx];
    loadMapByName(currentMapName);
    return false;
}, true);

COMMAND_REGISTRY.add("clearcache", ["!clearcache: clears local map cache"], (player) => {
    mapCache = new Map();
    return false;
}, true);

COMMAND_REGISTRY.add("admin", ["!admin: if you're entitled to it, you get admin"], (player) => {
    let a = auth.get(player.id);
    if (admins.has(a) ) {
		window.WLROOM.setPlayerAdmin(player.id, true);
	}
    return false;
}, false);