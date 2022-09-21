var fdb;
var commentsRef;
var notifsRef;
var modsRef;
var loginsRef;
var statsRef;
var adminsRef;
var baseRoomName="simple";
var admins = new Map();
var poolRef;
var settingsRef;

function initFirebase() {
    async function load_scripts(script_urls) {
        function load(script_url) {
            return new Promise(function(resolve, reject) {
                if (load_scripts.loaded.has(script_url)) {
                    resolve();
                } else {
                    var script = document.createElement('script');
                    script.onload = resolve;
                    script.src = script_url
                    document.head.appendChild(script);
                }
            });
        }
        var promises = [];
        for (const script_url of script_urls) {
            promises.push(load(script_url));
        }
        await Promise.all(promises);
        for (const script_url of script_urls) {
            load_scripts.loaded.add(script_url);
        }
    }
    load_scripts.loaded = new Set();

    (async () => {
		await load_scripts([
			'https://www.gstatic.com/firebasejs/7.20.0/firebase-app.js',
			'https://www.gstatic.com/firebasejs/7.20.0/firebase-database.js',
		]);
		
		firebase.initializeApp(CONFIG.firebase);
		fdb = firebase.database();
		commentsRef = fdb.ref(`${baseRoomName}/${CONFIG.room_id}/comments`);
        notifsRef = fdb.ref(`${baseRoomName}/${CONFIG.room_id}/notifs`);
        loginsRef = fdb.ref(`${baseRoomName}/${CONFIG.room_id}/logins`);

        adminsRef = fdb.ref(`${baseRoomName}/${CONFIG.room_id}/admins`);
        
        settingsRef = fdb.ref(`${baseRoomName}/${CONFIG.room_id}/settings`);

        listenForAdminsEvents();
       
        listenForSettingsEvents();

        if (CONFIG.pool_from_database) {
            console.log("loading pool");
            poolRef = fdb.ref(`${baseRoomName}/${CONFIG.room_id}/pool`);
            listenForPoolEvents();
        }
		console.log('firebase ok');

	})();		
}


function listenForAdminsEvents() {
    adminsRef.on('child_added', loadnewAdmin);
    adminsRef.on('child_changed', loadnewAdmin);
}

function loadnewAdmin(childSnapshot) {
	var v = childSnapshot.val();
	var k = childSnapshot.key;

  loadAdmin(k,v);
  
  console.log("admin `"+k+"`: `"+v.name+"` has been added to memory");
  notifyAdmins("admin `"+k+"`: `"+v.name+"` has been added to memory");
}


function loadAdmin(id, json) {
    admins.set(id, {
        auth: id,
        name: json.name,
        super: typeof json.super != 'undefined' && json.super
    } );
}

function isSuperAdmin(player) {
    let a = auth.get(player.id)
    let p = admins.get(a)
    return p && p.super
}

function addAdmin(player) {
    let a = auth.get(player.id)
    adminsRef.child(a).set({name: player.name})
}

function removeAdmin(a) {    
    let p = admins.get(a)
    let curr_pid = getPlayerIdFromAuth(a)
    if (curr_pid) {
        window.WLROOM.setPlayerAdmin(curr_pid, false)
    }
    
    const name = p.name
    adminsRef.child(a).remove()
    admins.delete(a)
    return name
}

/** mappool */
function listenForPoolEvents() {
    poolRef.on('child_added', loadnewMap);
    poolRef.on('child_changed', loadnewMap);
    poolRef.on('child_removed', removeMap);
}

function loadnewMap(childSnapshot) {
	var v = childSnapshot.val();
	var k = childSnapshot.key;

    mypool[k] = v;
    shufflePool();
	
	console.log("map `"+v+"` has been added to the pool");
    notifyAdmins("map `"+v+"` has been added to the pool");
}

function removeMap(childSnapshot) {
	var k = childSnapshot.key;
	var n = mypool[k];
    delete mypool[k];
    shufflePool();
	console.log("map `"+n+"` has been remove from the pool");
    notifyAdmins("map `"+n+"` has been remove from the pool");
}

/** settings */
function listenForSettingsEvents() {
    settingsRef.on('value', updateSettings);
}

function updateSettings(snapshot) {
    let v = snapshot.val();
    let sett = window.WLROOM.getSettings();
    for(let s in v) {        
        sett[s] = v[s];     
    } 
    loadSettings(sett);
    window.settingsSnap = sett;
    console.log("settings loaded", JSON.stringify(sett));
}

function loadSettings(sett) {
    window.WLROOM.setSettings(sett);
    if (typeof sett.afkLimit != 'undefined') {
        AFK_HANDLER.setTimeoutSeconds(sett.afkLimit);
    } else  {
        AFK_HANDLER.disable();
    }
}

COMMAND_REGISTRY.add("reset", ["!reset: resets to last settings loaded from database"], (player) => {
    loadSettings(window.settingsSnap);
    return false;
},  COMMAND.ADMIN_ONLY);


COMMAND_REGISTRY.add("poolreload", ["!poolreload: reloads the map pool from database from database"], (player) => {
    poolRef = fdb.ref(`${CONFIG.room_id}/pool`);    
    mypool = {};
    mypoolIdx = [];
    listenForPoolEvents();
    return false;
}, COMMAND.ADMIN_ONLY);

function writeLogins(p, type ="login") {
    const now = Date.now();
    loginsRef.child(now).set({name: p.name, auth:auth.get(p.id), type:type, formatted:(new Date(now).toLocaleString())});
}

function writeLog(p, msg) {
    const now = Date.now();
    commentsRef.child(now).set({name: p.name, auth:auth.get(p.id), msg:msg, formatted:(new Date(now).toLocaleString())});
}

function writeGameStats(event, stats) {
  const now = Date.now();
  statsRef.child(now).set({event: event, stats:stats});
}