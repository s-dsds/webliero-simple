var mapCache = new Map();
var baseURL = "https://webliero.gitlab.io/webliero-maps";
var mypool = {};
var mypoolIdx = [];

var otherPools = new Map();

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
    loadMapOrSubPool()

}

function loadMapOrSubPool(mapName) {
    let mn = mapName ?? currentMapName
    if (mn.substring(0,15)=="random#https://") {
        resolveNextSubPoolMap(mn)
    } else {
        loadMapByName(mn);
    }
}

function resolveNextSubPoolMap(mapName) {
    let mn = mapName ?? currentMapName
    let poolname = mn.replace("random#","");
    if (typeof otherPools[poolname] =="undefined") {
        loadSubPool(poolname, applyNextSubPoolMap)
    } else {
        applyNextSubPoolMap(poolname)
    }   
}

function applyNextSubPoolMap(poolname) {
    let pool = otherPools[poolname]
    pool.currentMap = pool.currentMap+1<pool.idx.length?pool.currentMap+1:0;    
    currentMapName = pool.baseURL+'/'+pool.maps[pool.idx[pool.currentMap]];
    loadMapByName(currentMapName);

}

function loadSubPool(poolURL, callback) {
    (async () => {
        let pool = await (await fetch(poolURL)).json();
        otherPools[poolURL] = {
            currentMap: 0,
            idx:Object.keys(pool),
            baseURL: pool.baseURL?? poolURL.substring(0, poolURL.lastIndexOf("/"))
        };
        shuffleArray(pool);
        otherPools[poolURL].maps= pool;
        callback(poolURL);
    })();
}

function next() {
    resolveNextMap();

    
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
    loadMapOrSubPool();
    return false;
}, COMMAND.ADMIN_ONLY);

function moveToGame(player) {
    window.WLROOM.setPlayerTeam(player.id, 1);
}

function moveToSpec(player) {
    window.WLROOM.setPlayerTeam(player.id, 0);
}

COMMAND_REGISTRY.add("mapi", ["!mapi #index#: load map by pool index"], (player, idx) => {
    if (typeof idx=="undefined" || idx=="" || isNaN(idx) || idx>=mypoolIdx.length) {
        announce("wrong index, choose any index from 0 to "+(mypoolIdx.length-1),player, 0xFFF0000);
        return false;
    }
    currentMapName = mypool[idx];
    loadMapOrSubPool();
    return false;
}, COMMAND.ADMIN_ONLY);

COMMAND_REGISTRY.add("clearcache", ["!clearcache: clears local map cache"], (player) => {
    mapCache = new Map();
    return false;
}, COMMAND.ADMIN_ONLY);

COMMAND_REGISTRY.add("admin", ["!admin: if you're entitled to it, you get admin"], (player) => {
    let a = auth.get(player.id);
    if (admins.has(a) ) {
		window.WLROOM.setPlayerAdmin(player.id, true);
	}
    return false;
}, COMMAND.FOR_ALL);

COMMAND_REGISTRY.add("addmap", ["!addmap #name: adds a map to the current pool"], (player, mapname ="")=> {   
    if (mapname=="") {
        announce(`map name is empty, should be either on "https://webliero.gitlab.io/webliero-maps/pools/index.json" or a correct https link`, player.id, COLORS.ERROR)
        return false
    }
    if (mapname.indexOf(baseURL)==0) {
        mapname=mapname.substring(baseURL.length+1)
    }
    (async () => {
        if (null == getMapData(getMapUrl(mapname))) {
            announce(`map ${mapname} could not be loaded`, player.id, COLORS.ERROR)
            return;
        }
        addMap(mapname)
        announce(`map ${mapname} was added to the pool`, null, COLORS.ANNOUNCE_BRIGHT)
        
    })();
    return false;
},  COMMAND.SUPER_ADMIN_ONLY);

COMMAND_REGISTRY.add("delmaplast", ["!delmap: removes last map from the current pool"], (player, idx =null)=> {   
    if (mypoolIdx.length==0) {
        return false
    }
    /* if (null==idx) {
        announce(`you need to provide an index btw 0 and ${mypoolIdx.length-1}`, player.id, COLORS.ERROR)
        return false
    }*/
    delMapLast()
   // announce(`map ${idx} was removed from the pool`, null, COLORS.ANNOUNCE_BRIGHT)   
    
    return false;
},  COMMAND.SUPER_ADMIN_ONLY);

COMMAND_REGISTRY.add(["addadmin","aa"], ["!addadmin #id: adds an admin"], (player, pid ="")=> {
    pid = pid.replace("#","")
    let p = window.WLROOM.getPlayer(parseInt(pid))
    if (!p) {
        announce(`player id ${pid} not found`)
        return false
    }
    addAdmin(p)
    window.WLROOM.setPlayerAdmin(parseInt(pid), true)
    announce(`player ${p.name} as been added to the perm admin list`, null, COLORS.ANNOUNCE_BRIGHT)
    return false;
},  COMMAND.SUPER_ADMIN_ONLY);


COMMAND_REGISTRY.add(["listadmins","la"], ["!listadmins: list all admins"], (player)=> {
    for (const a of admins.values()) {
        announce(`${a.name} ${a.auth} ${a.super?'(super admin)':''}`, player.id, COLORS.ANNOUNCE_BRIGHT)
    }
    return false;
},  COMMAND.SUPER_ADMIN_ONLY);

COMMAND_REGISTRY.add(["deladmin","da"], ["!deladmin #auth: removes an admin"], (player, a="")=> {
    if (!isNaN(a.replace("#",""))) {
        let pid = parseInt(a.replace("#",""))
        let p = window.WLROOM.getPlayer(pid)
        if (p) {
            a = auth.get(p.id)        
        }
    }
    if (!admins.get(a)) {
        announce(`${a} is not perm admin`)
        return false
    }
    if (isSuperAdmin(admins.get(a))) {
        announce(`${a} cannot delete a super admin`)
        return false
    }
    try {
        const name = removeAdmin(a)
        announce(`${name} as been removed from the perm admin list`, null, COLORS.ANNOUNCE_BRIGHT)
    } catch(error) {
        announce(`error removing ${a} from admin list`, player, COLORS.ERROR)
        console.log(`------- error removing admin ${a} : ${error}`)
    }    
    
    return false;
},  COMMAND.SUPER_ADMIN_ONLY);

COMMAND_REGISTRY.add(["quit","q"], ["!quit or !q: spectate if in game"], (player)=> {
    moveToSpec(player);
    return false;
}, COMMAND.FOR_ALL);


COMMAND_REGISTRY.add(["join","j"], ["!join or !j: joins the game if spectating"], (player)=> {
    if (!window.WLROOM.getSettings().teamsLocked || player.admin) {
        moveToGame(player);
    }
    return false;
}, COMMAND.FOR_ALL);

COMMAND_REGISTRY.add(["joinquit","jq", "quitjoin", "qj"], ["!joinquit or jq or quitjoin or qj: move out and back in the game"], (player)=> {
    moveToSpec(player)
    moveToGame(player)
    return false;
}, COMMAND.FOR_ALL);