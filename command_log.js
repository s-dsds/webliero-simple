window.WLROOM.onPlayerChat = function (p, m) {
	console.log(p.name+" "+m);
	writeLog(p,m);
}

window.WLROOM.onGameEnd2 = function() {
    if (CONFIG.pool_from_database) {
        next();
    }
}
