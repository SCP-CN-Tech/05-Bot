const CNTech = require('./CNTech.js');
const config = require('./configLoader.js')
let bot = new CNTech()
bot.login(config.WD_NAME, config.WD_PW)
bot.on('ready', ()=>{
  bot.debug().then(res=>{
    console.log(`Retrieved ${res.length} records.`)
  })
})
