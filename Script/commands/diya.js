module.exports.config = {
 name: "diya",
 version: "1.2.8",
 hasPermssion: 0,
 credits: "Islamick Chat", //Don't chinge The credit
 description: "Short doya",
 commandCategory: "doya",
 usages: "doya",
 cooldowns: 5,
 dependencies: {
 "axios": "",
 "fs-extra": "",
 "request": ""
 } 
}

module.exports.onLoad = () => {
 let { mkdirSync, existsSync, createWriteStream } = require("fs-extra");
 let request = require("request");
 let dirMaterial = __dirname + `/noprefix/doya/`; 
 if (!existsSync(dirMaterial + "noprefix" + "12doya")) mkdirSync(dirMaterial, { recursive: true });

 if (!existsSync(dirMaterial + "doya1.jpg")) request("").pipe(createWriteStream(dirMaterial + "doya1.jpg"))

 if (!existsSync(dirMaterial + "doya2.jpg")) request("https://i.imgur.com/aESlOKd.jpeg").pipe(createWriteStream(dirMaterial + "doya2"))

 if (!existsSync(dirMaterial + "doya3.jpg")) request("https://i.imgur.com/3Bmg4Nd.jpeg").pipe(createWriteStream(dirMaterial + "doya3.jpg"))

 if (!existsSync(dirMaterial + "doya4.jpg")) request("https://i.imgur.com/TUm1LQW.jpeg").pipe(createWriteStream(dirMaterial + "doya4.jpg"))

 if (!existsSync(dirMaterial + "doya5.jpg")) request("https://i.imgur.com/wp7hM0m.jpeg").pipe(createWriteStream(dirMaterial + "doya5.jpg"))

 if (!existsSync(dirMaterial + "doya6.jpg")) request("https://i.imgur.com/pFvUmsm.jpeg").pipe(createWriteStream(dirMaterial + "doya6.jpg"))

 if (!existsSync(dirMaterial + "doya7.jpg")) request("https://i.imgur.com/LH2qVcm.jpeg").pipe(createWriteStream(dirMaterial + "doya7.jpg"))

 if (!existsSync(dirMaterial + "doya8.jpg")) request("https://i.imgur.com/28Et6s2.jpeg").pipe(createWriteStream(dirMaterial + "doya8.jpg"))

 if (!existsSync(dirMaterial + "doya9.jpg")) request("https://i.imgur.com/NIjfdfz.jpeg").pipe(createWriteStream(dirMaterial + "doya9.jpg"))

 if (!existsSync(dirMaterial + "doya10.jpg")) request("https://i.imgur.com/1ufw46l.jpeg").pipe(createWriteStream(dirMaterial + "doya10.jpg"))

 if (!existsSync(dirMaterial + "doya11.jpg")) request("https://i.imgur.com/0wcNcmI.jpeg").pipe(createWriteStream(dirMaterial + "doya11.jpg"))

 if (!existsSync(dirMaterial + "doya12.jpg")) request("https://i.imgur.com/AnIgU1J.jpeg").pipe(createWriteStream(dirMaterial + "doya12.jpg"))

}

module.exports.handleReply = async ({ api, event, handleReply }) => {
 let { createReadStream } = require("fs-extra");
 let { threadID, messageID, senderID, body } = event;
 switch(handleReply.type) {
 case "choosee": {
 switch(body) {

 case "1":
 api.unsendMessage(handleReply.messageID);
 api.sendMessage({
 body: "হে আমাদের পালনকর্তা, আমাদের গুনাহসমূহ মাফ করে দাও, আমাদের থেকে সকল মন্দ দূর করে দাও এবং আমাদের নেক লোকদের সাহচার্য দান কর।", 
 attachment: createReadStream(__dirname + `/noprefix/doya/doya1.jpg`)
 }, threadID, messageID);
 break;

 case "2":
 api.unsendMessage(handleReply.messageID);
 api.sendMessage({
 body: "\nرَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا \n\nউচ্চারণ : ‘রাব্বানা হাব্লানা মিন আযওয়াঝিনা ওয়া জুর্রিয়াতিনা কুর্রাতা আইয়ুনিও ওয়াঝআলনা লিলমুত্তাক্বিনা ইমামা।", 
 attachment: createReadStream(__dirname + `/noprefix/doya/doya2.jpg`)
 },threadID, messageID);
 break;

 case "3":
 api.unsendMessage(handleReply.messageID);
 api.sendMessage({
 body: "بِسْمِ اللّهِ اللّهُمَّ جَنِّبْنَا الشَّيْطَانَ وَ جَنِّبِ الشَّيْطَانَ مَا رَزَقْتَنَا\nউচ্চারণ: 'বিসমিল্লাহি আল্লাহুম্মা জান্নিবনাশ শায়ত্বানা ওয়া জান্নিবিশ শায়ত্বানা মা রাযাক্বতানা।' অর্থ: 'আল্লাহর নামে শুরু করছি, হে আল্লাহ! আমাদেরকে তুমি শয়তান থেকে দূরে রাখ।.", 
 attachment: createReadStream(__dirname + `/noprefix/doya/doya3.jpg`)
 }, threadID, messageID); 
 break;

 case "4":
 api.unsendMessage(handleReply.messageID);
 api.sendMessage({
 body: " الْجَنَّةَ وَالنَّارِ- بِرَحْمَتِكَ يَاعَزِيْزُ يَا غَفَّارُ يَا كَرِيْمُ يَا سَتَّارُ يَا رَحِيْمُ يَاجَبَّارُ يَاخَالِقُ يَابَارُّ - اَللَّهُمَّ اَجِرْنَا مِنَ النَّارِ يَا مُجِيْرُ يَا مُجِيْرُ يَا مُجِيْرُ- بِرَحْمَتِكَ يَا اَرْحَمَالرَّحِمِيْنَ\n\nউচ্চারণ : আল্লাহুম্মা ইন্না-নাসআলুকাল জান্নাতা ওয়া নাউজুবিকা মিনাননার। ইয়া খ-লিক্বল জান্নাতা ওয়ান্নার। বিরাহমাতিকা ইয়া-আজিজু ইয়া-গাফফারু, ইয়া-ক্বারিমু ইয়া-সাত্তারু, ইয়া-রাহিমু ইয়া-জাব্বারু, ইয়া-খলিকু ইয়া-বারর। আল্লাহুম্মা আজিরনা-মিনান্নার। ইয়া-মুজিরু, ইয়া-মুজিরু, ইয়া-মুজিরু। বিরহমাতিকা ইয়া-আরহামার রাহিমিন।", 
 attachment: createReadStream(__dirname + `/noprefix/doya/doya4.jpg`)
 }, threadID, messageID); 
 break;

 case "5":
 api.unsendMessage(handleReply.messageID);
 api.sendMessage({
 body: "اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَجْمَعُ عِبَادَكَ أَوْ تَبْعَثُ عِبَادَكَ\n\nউচ্চারণ : ‘আল্লাহুম্মা ক্বিনি আজাবাকা ইয়াওমা তাঝমাউ ইবাদাকা আও তাবআছু ইবাদাকা।’অর্থ : ‘হে আল্লাহ! যেদিন তুমি তোমার বান্দাদের একত্রিত করবে অথবা পুনরায় জীবিত করবে; সেদিন আমাকে তোমার আজাব থেকে হেফাজতে রাখ।’ (তিরমিজি", 
 attachment: createReadStream(__dirname + `/noprefix/doya/doya5.jpg`)
 }, threadID, messageID); 
 break;

 case "6":
 api.unsendMessage(handleReply.messageID);
 api.sendMessage({
 body: "رَبَّنَاۤ اٰمَنَّا فَاغۡفِرۡ لَنَا وَ ارۡحَمۡنَا وَ اَنۡتَ خَیۡرُ الرّٰحِمِیۡنَ\n\nউচ্চারণ- রাব্বানা আমান্না ফাগফিরলানা ওয়ারহামনা ওয়া আংতা খাইরুর রাহিমিন।", 
 attachment: createReadStream(__dirname + `/noprefix/doya/doya6.jpg`)
 }, threadID, messageID); 
 break;

 case "7":
 api.unsendMessage(handleReply.messageID);
 api.sendMessage({
 body: "দু‘আ :رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَه عَلَى الَّذِينَ مِنْ قَبْلِنَا رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِه وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا أَنْتَ مَوْلَانَا فَانْصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ. \n\nউচ্চারণ : রব্বানা- ওয়ালা- তাহমিল ‘আলায়না ইসরান কামা- হামালতাহূ ‘আলাল্লাযীনা মিন ক্ববলিনা- রব্বানা- ওয়ালা- তুহাম্মিলনা- মা-লা- ত্বা-ক্বাতা লানা- বিহী, ওয়া‘ফু ‘আন্না- ওয়াগফির লানা- ওয়ারহামনা- আনতা মাওলা-না- ফানসুরনা- ‘আলাল ক্বওমিল কা-ফিরীন।", 
 attachment: createReadStream(__dirname + `/noprefix/doya/doya7.jpg`)
 }, threadID, messageID); 
 break;

 case "8":
 api.unsendMessage(handleReply.messageID);
 api.sendMessage({
 body: "رَبِّ هَبْ لِي مِن لَّدُنْكَ ذُرِّيَّةً طَيِّبَةً إِنَّكَ سَمِيعُ الدُّعَاء\n\nউচ্চারণ : রাব্বি হাবলি মিল্লাদুনকা যুরিরয়্যাতান ত্বাইয়্যিবাহ, ইন্নাকা সামিউদ দুআ। \n\n অর্থ : হে আমাদের প্রতিপালক! তোমার পক্ষ থেকে আমাকে পূতপবিত্র সন্তান দান করো। নিশ্চয়ই তুমি প্রার্থনা কবুলকারী। (সুরা : আলে ইমরান, আয়াত : ৩৮)।", 
 attachment: createReadStream(__dirname + `/noprefix/doya/doya8.jpg`)
 }, threadID, messageID); 
 break;

 case "9":
 api.unsendMessage(handleReply.messageID);
 api.sendMessage({
 body: "কবর জিয়ারত এর শঠিক নিয়ম ও দোয়া-!!❤️🤲\n\n১ বার সূরা ফাতিহা\n১ বার সূরা আন নাস \n১ বার সূরা ফালাক \n ৩ বার সূরা ইখলাস\n১ বার সূরা কাফিরুন \n২ বার সূরা তাকাছুর\n ১১ বার দুরুদশরিফ \n১১ বার আস্তাগফিরুল্লাহ \n এবং শেষে দোয়া করবেন\n\n আর অবশ্যই পশ্চিম দিকে তাকিয়ে সকল দোয়া ও সূরা পরবেন কবোরের দিকে তাকিয়ে নয়-!!🌸😊", attachment: createReadStream(__dirname + `/noprefix/doya/doya9.jpg`)
 }, threadID, messageID); 
 break;

 case "10":
 api.unsendMessage(handleReply.messageID);
 api.sendMessage({
 body: "رَبِّ هَبْ لِي مِن لَّدُنْكَ ذُرِّيَّةً طَيِّبَةً إِنَّكَ سَمِيعُ الدُّعَاء \n\nউচ্চারণ : রাব্বি হাবলি মিল্লাদুনকা যুরিরয়্যাতান ত্বাইয়্যিবাহ, ইন্নাকা সামিউদ দুআ।\n\n অর্থ : হে আমাদের প্রতিপালক! তোমার পক্ষ থেকে আমাকে পূতপবিত্র সন্তান দান করো। নিশ্চয়ই তুমি প্রার্থনা কবুলকারী।’ (সুরা : আলে ইমরান, আয়াত : ৩৮)।", attachment: createReadStream(__dirname + `/noprefix/doya/doya10.jpg`)
 }, threadID, messageID); 
 break;

 case "11":
 api.unsendMessage(handleReply.messageID);
 api.sendMessage({
 body: "اللّٰهُمَّ إِنِّيْۤ أَسْئَلُكَ الثَّبَاتَ فِي الْأَمْرِ، وَأَسْأَلُك عَزِيْمَةَ الرُّشْدِ، وَأَسْأَلُكَ شُكْرَ نِعْمَتِكَ وَحُسْنَ عِبَادَتِكَ، وَأَسْأَلُكَ لِسَانًا صَادِقًا وَّقَلْبًا سَلِيْمًا، وَخُلُقًا مُّسْتَقِيْمًا، وَأَسْأَلُكَ مِنْ خَيْرِ مَا تَعْلَمُ وَأَسْتَغْفِرُكَ مِمَّا تَعْلَمُ، إِنَّكَ أَنْتَ عَلَّامُ الْغُيُوْبِ.\n\n অর্থ: ইয়া আল্লাহ! আমি আপনার কাছে প্রার্থনা করি দীনের বিষয়ে অবিচলতা এবং আপনার কাছে প্রার্থনা করি উন্নত যোগ্যতা এবং আপনার কাছে প্রার্থনা করি আপনার নেয়ামতের শোকরগোজারি ও বন্দেগীর সৌন্দর্য এবং আপনার কাছে প্রার্থনা করি সত্যবাদী জিহ্বা, সুস্থ হৃদয় আর সুদৃঢ় চরিত্র।\n আমি আপনার কাছে প্রার্থনা করি কল্যাণ, যা আপনি জানেন এবং ক্ষমা চাই ওই সব গুনাহ থেকে, যে সম্পর্কে আপনি অবগত। সব অদৃশ্য বিষয় তো আপনার জানা। (সুতরাং ওই সব গুনাহ সম্পর্কেও আপনি অবগত, যা কোনো সৃষ্টির জানা নেই)।", 
 attachment: createReadStream(__dirname + `/noprefix/doya/doya11.jpg`)
 }, threadID, messageID); 
 break;

 case "12":
 api.unsendMessage(handleReply.messageID);
 api.sandmessage({
 body:"কবর জিয়ারত এর শঠিক নিয়ম ও দোয়া-!!❤️🤲\n\n১ বার সূরা ফাতিহা\n১ বার সূরা আন নাস \n১ বার সূরা ফালাক \n৩ বার সূরা ইখলাস\n১ বার সূরা কাফিরুন \n২ বার সূরা তাকাছুর\n১১ বার দুরুদশরিফ \n১১ বার আস্তাগফিরুল্লাহ \n এবং শেষে দোয়া করবেন\n\n আর অবশ্যই পশ্চিম দিকে তাকিয়ে সকল দোয়া ও সূরা পরবেন কবোরের দিকে তাকিয়ে নয়-!!🌸😊", 
 attachment: createReadStream(__dirname + `/noprefix/doya/doya12.jpg`)
 }, threadID, messageID); 
 break;

 default:
 const choose = parseInt(body);
 if (isNaN(body)) return api.sendMessage("•—»✨ একটি নুম্বারে রিপ্লাই দিন ", threadID, messageID);
 if (choose > 12 || choose < 1) return api.sendMessage("•—»✨ নির্বাচনের তালিকা নেই ", threadID, messageID); 

 }
 }
 }
}

module.exports.run = async ({ api, event, handleReply }) => {
 let fs = require("fs-extra");
 let { threadID, senderID } = event;
 return api.sendMessage({ body: "╭•┄┅════❁🌺❁════┅┄•╮\n কিছু সহজ দোয়া-!!❤️🤲 \n╰•┄┅════❁🌺❁════┅┄•╯\n\n｢১｣ ঈমানের সাথে মৃত্যু বরণ করার দোয়া-!!🖤🤲 \n\n｢২｣ উত্তম জীবনসঙ্গী লাভের দোয়া-!!🖤🤲\n\n｢৩｣ সহবাস করার দোয়া-!!🖤🤲\n\n｢৪｣ তারাবিহর নামাজে দোয়া-!!🖤🤲\n\n｢৫｣ আল্লাহর গযব থেকে মুক্ত থাকার দোয়া-!!🖤🤲\n\n｢৬｣ ক্ষমা ও রহমতের দোয়া-!!🖤🤲\n\n｢৭｣ গুনাহ্ মাফের দোয়া-!!🖤🤲\n\n｢৮｣ সুসন্তান লাভের দোয়া-!!🖤🤲 \n\n｢৯｣কবর জিয়ারতের নিয়ম ও দয়া-!!🖤🤲\n\nএখানে কিছু সহজ দোয়া দেওয়া আছে এই বার্তা টি নাম্বার সংযোগ করে রিপ্লাই মেসেজ দিন-!!✨🧡"
 }, threadID, (error, info) => {
 global.client.handleReply.push({
 type: "choosee",
 name: this.config.name,
 author: senderID,
 messageID: info.messageID
 }) 
 })
 }