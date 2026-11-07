module.exports.config = {
  name: "boy pp",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Islamick Chat",
  description: "Random Islamick boy",
  commandCategory: "Random-IMG",
  usages: "boy pp",
  cooldowns: 2,
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
"https://i.imgur.com/QhlqGb1.jpg",
"https://files.catbox.moe/sumwm9.jpg",
"https://files.catbox.moe/00u0t7.jpg",
"https://files.catbox.moe/7nb4lz.jpg",
"https://files.catbox.moe/0f6qgd.jpg",
"https://files.catbox.moe/ex4b6s.jpg",
"https://files.catbox.moe/0msjws.jpg",
"https://files.catbox.moe/q14swv.jpg",
"https://files.catbox.moe/p9smo8.jpg",
"https://files.catbox.moe/d3pxdo.jpg",
"https://files.catbox.moe/3tdyne.jpg",
"https://files.catbox.moe/kready.jpg",
"https://files.catbox.moe/6qh0k8.jpg",
"https://files.catbox.moe/ximgff.jpg",
"https://i.imgur.com/s3t1Aag.jpg",
"https://files.catbox.moe/3ict1y.jpg",
"https://files.catbox.moe/6juvjy.jpg",
"https://files.catbox.moe/w1rppr.jpg",
"https://files.catbox.moe/71u864.jpg",
"https://files.catbox.moe/ly7dun.jpg",
"https://files.catbox.moe/el5yqe.jpg",
"https://files.catbox.moe/zprda1.jpg",
"https://files.catbox.moe/n4xkux.jpg",
"https://files.catbox.moe/gol4sm.jpg",
"https://files.catbox.moe/anj3qp.jpg",
"https://files.catbox.moe/rxsnha.jpg",
"https://files.catbox.moe/rg6zn8.jpg",
"https://files.catbox.moe/1lk36j.jpg",
"https://files.catbox.moe/deigsp.jpg",
"https://files.catbox.moe/uejpqa.jpg",
"https://files.catbox.moe/z5bmox.jpg",
"https://files.catbox.moe/gkf7dt.jpg",
"https://files.catbox.moe/8dx9tp.jpg",
"https://files.catbox.moe/zn5y59.jpg",
"https://files.catbox.moe/hvipcz.jpg",
"https://files.catbox.moe/mh9mn1.jpg",
"https://files.catbox.moe/wsqgug.jpg",
"https://files.catbox.moe/d2x3wy.jpg",
"https://files.catbox.moe/nj4ikg.jpg",
"https://files.catbox.moe/htd7z0.jpg",
"https://files.catbox.moe/c40yni.jpg",
"https://files.catbox.moe/zc6uik.jpg",
"https://files.catbox.moe/zc6uik.jpg",
"https://files.catbox.moe/uapeb3.jpg",
"https://files.catbox.moe/uaa544.jpg",
"https://i.imgur.com/K5RfFYF.jpg",
"https://files.catbox.moe/cn0uk2.jpg",
"https://i.imgur.com/K5RfFYF.jpg",
     ];
     var callback = () => api.sendMessage({body:`𝐈𝐒𝐋𝐀𝐌𝐈𝐂𝐊 𝐁𝐎𝐘 𝐅𝐁 𝐏𝐑𝐎𝐅𝐈𝐋𝐄 𝐈𝐌𝐆`,attachment: fs.createReadStream(__dirname + "/cache/1.jpg")}, event.threadID, () => fs.unlinkSync(__dirname + "/cache/1.jpg"));  
      return request(encodeURI(link[Math.floor(Math.random() * link.length)])).pipe(fs.createWriteStream(__dirname+"/cache/1.jpg")).on("close",() => callback());
   };