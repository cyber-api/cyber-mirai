module.exports.config = {
  name: "animegirl",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
  description: "Random Loli Pics",
  commandCategory: "nsfw",
  usages: "lolilewd",
  cooldowns: 5,
  dependencies: {
    "request":"",
    "fs-extra":"",
    "axios":""
  }
    
};

module.exports.run = async({api,event,args,Users,Threads,Currencies}) => {
const axios = global.nodemodule["axios"];
const request = global.nodemodule["request"];
const fs = global.nodemodule["fs-extra"];
  var link = [

     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/oh5260.jpg",
     "https://files.catbox.moe/q0w0xn.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/jvaj3z.jpg",
     "https://files.catbox.moe/behiv7.jpg",
     "https://files.catbox.moe/orrifn.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/s2f3gv.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://i.mgur.com/eab5Ex9.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://i.mgur.com/lvbHmrc.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://i.mgur.com/kzUdnNU.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://i.imgur.com/EteGnuY.jpg",
     "https://i.imgur.com/E5axqu9.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://i.imgur.com/r4G6tQi.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg",
     "https://files.catbox.moe/z9iqww.jpg"
     
    ];
      var callback = () => api.sendMessage({body:`Random Loli Pic\nNumber of photos: ${link.length}`,attachment: fs.createReadStream(__dirname + "/cache/1.jpg")}, event.threadID, () => fs.unlinkSync(__dirname + "/cache/1.jpg"), event.messageID);  
      return request(encodeURI(link[Math.floor(Math.random() * link.length)])).pipe(fs.createWriteStream(__dirname+"/cache/1.jpg")).on("close",() => callback()); 
    

}
  
