const CNTech = require('./CNTech.js');
const config = require('./configLoader.js')
const fs = require('fs');
let bot = new CNTech()
bot.login(config.WD_NAME, config.WD_PW)
bot.on('ready', ()=>{
  bot.outdate()
  /*bot.debug().then(res=>{
    fs.writeFileSync('./trans-reserve.json', JSON.stringify(res, null, 2), 'utf8')
    //console.log(res)
    //console.log(`Retrieved ${res.length} records.`)
  })*/
})
