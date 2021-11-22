window.WLROOM.onPlayerChat = function (p, m) {
	console.log(p.name+" "+m);
	writeLog(p,m);
}

if (CONFIG.pool_from_database) {
    window.WLROOM.onGameEnd2 = function() {
        next();
    }
}