var COMMAND = {
    SUPER_ADMIN_ONLY: 2,
    ADMIN_ONLY: 1,
    FOR_ALL: 0
}

var COMMAND_REGISTRY = (function () {
    // Command registry plugin
    // used to add commands to a room
    // by default it inits a "!help" commands, listing commands available depending on the user's rights
    // example usage:
    //  #init registry by passing to it the room and eventual config
    //  COMMAND_REGISTRY.init(window.WLROOM, pluginConfig);
    //  #add commands to it
    //  #params: (string #command name, []string #help message, func #command function, bool #is admin only command)
    //  COMMAND_REGISTRY.add("map", ["!map nameofmap.png : loads map 'nameofmap.png'"], (player, name)=>{
    //     this.room.loadPNGLevel(name, mypool.get(name));
    //     this.room.sendAnnouncement("loading map "+name, player.id, 0x0010D0); return false;
    //  }, true);
    //
     const chainFunction = (object, attribute, func) => {
       const original = object[attribute]
       if (original) {
         object[attribute] = (...arguments) => {
           let or = original.apply(object, arguments)
           let r = func.apply(object, arguments)
           if (false==r || false==or) {
               return false;
           }
         }
       } else {
         object[attribute] = func
       }
     }
 
     const log = (...arguments) => {
       console.log(...arguments.map(x => JSON.stringify(x)))
     }
 
     let room = null
     
     let settings = {
         motd: `Commands are available in this room, type !help for more informations`,
         motd_color: 0x00A9D0,
         error_color: 0xFF0000,
         help_color: 0x50A9D0,
     } //default settings
 
     const loadSettings = (confArgs) => {
         settings = {
             ...settings,
             ...confArgs
         }
     }
 
     let commands = {
         any:  new Map(),
         admins: new Map(),
         superadmins: new Map()
     }
 
     const execMotd = (player) => {
         if (!settings.motd) {
             return
         }
         room.sendAnnouncement(settings.motd, player.id, settings.motd_color)
     }
 
     const onChat = (p, m) =>  {        
         if (m[0] == "!") {
             let splitted=m.substr(1).split(' ')
             if (isSuperAdmin(p) && !execCommand(commands.superadmins, p, splitted)) {
                return false
            } else if (p.admin && !execCommand(commands.admins, p, splitted)) {
                 return false
             } else if (!execCommand(commands.any, p, splitted)) {
                 return false;
             }
         }
         return true
     }
 
     const execCommand = (commandList, p, commandText) => {         
         const command = commandList.get(commandText[0])
         if (command == null || typeof command.f != 'function') {             
             return true
         } else {
             try {
                 console.log(`Command: ${commandText.join(" ")}`)
                 return command.f(p, ...commandText.splice(1))
             } catch (e) {
                 console.log(e)
                 room.sendAnnouncement(`Error: ${e.message}`, p.id, settings.error_color)
             }
         }
         return true
     }
 
     const add = (name, usage, func, admin = COMMAND.FOR_ALL) => {
         const clist = commands[resolveMap(admin)]
         if (typeof name == 'object') {
             name.forEach((n) => {add(n, usage, func, admin)})
             return;
         }
         if (clist.has(name)) {
             console.log('command '+name+' is being overwritten')
         }
         clist.set(name, {h:usage, f:func})
     }
 
     const remove = (name, admin) => {
         commands[resolveMap(admin)].delete(name)
         console.log('command '+name+' removed')
     }
     const resolveMap = (admin) => { switch (admin) { case 2: return "superadmins"; case 1: return "admins"; default: return "any"}}
     const list = () => {
         return {
         }
     }
     const helpCommand = (p, name ='') => {
         let msg = (() => {
             let msg = ['available commands:']
             if (''!=name) {
                if (isSuperAdmin(p) && commands.superadmins.has(name)) {
                    msg = commands.superadmins.get(name).h
                } else if (p.admin && commands.admins.has(name)) {
                    msg = commands.admins.get(name).h
                } else if (commands.any.has(name)) {
                     msg = commands.any.get(name).h
                 } else {
                     msg= ['command "'+name+'" isn\'t available']
                 }
                 return msg
             }
             if (p.admin) {
                 if (isSuperAdmin(p) && commands.superadmins.size>0) {
                    msg.push('  for super admins only:')
                    msg.push('    '+Array.from(commands.superadmins.keys()).join(', '))
                 }
                 if (commands.admins.size>0) {
                     // nbsp: u00A0
                     msg.push('  for admins only:')
                     msg.push('    '+Array.from(commands.admins.keys()).join(', '))
                 }
                 msg.push('  for any players:')
             }
             
             msg.push('    '+Array.from(commands.any.keys()).join(', '))
             msg.push('type "!help commandname" for help on a specific command')
             return msg
         })()
         const printMsg = (m) => {
            if (typeof m=="function") {
                m = m();
            }
            if (typeof m.reduce=="function") {
                m.forEach(printMsg)        
            } else {
               room.sendAnnouncement(m, p.id, settings.help_color, "small")
            }
            
        }
         msg.forEach(printMsg)        
     }
 
     const init = (argRoom, confArgs) => {        
         if (window.CRPLUGIN) {
             log('command registry is already loaded, you can change settings use COMMAND_REGISTRY.loadSettings()', settings)
             return
         }
         room=argRoom 
         loadSettings(confArgs)
         log('loading command registry', settings)
         window.CRPLUGIN = true
 
         add(["h","help"], ["!help or !h: lists all available commands", "can take anycommand name as arg for more help"], helpCommand)
 
         chainFunction(room, 'onPlayerChat', onChat)
         chainFunction(room, 'onPlayerJoin', execMotd)
     }
 
     return {
         init: init,
         loadSettings: loadSettings,
         add: add,
         remove: remove,
         list: list
     }
   })()
   