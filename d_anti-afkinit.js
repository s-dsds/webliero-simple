AFK_HANDLER.init(window.WLROOM, {maxPlayers: CONFIG.max_players,});

COMMAND_REGISTRY.add("afk", ["!afk #seconds#: number of seconds allowed for afk, `afk 0` disables it, 1/4th of #seconds# will be used as grace time (eg for 20sec, 5sec grace time)"], (player, num) => {
    let n = (typeof num=='undefined')?'':num.trim();
    if (n == "" || isNaN(n)) {
        announce("you need to provide a number as argument, type `!help afk` for help", player, 0xFFF0000);
        return false;
    }    
    AFK_HANDLER.setTimeoutSeconds(parseInt(n))
    return false;
},  COMMAND.ADMIN_ONLY);
