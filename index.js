const CNTech = require('./CNTech.js');
const winston = require('winston');
const fs = require('fs');

const logFormat = winston.format(info => {
  info.level = info.level.toUpperCase();
  if (info.stack) {
    info.message = `${info.message}\n${info.stack}`;
  }
  return info;
});
winston.add(new winston.transports.Console({
  format: winston.format.combine(
    logFormat(),
    winston.format.colorize(),
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(info => `${info.timestamp} [${info.level}] ${info.message}`)
  ),
}));

process.on('unhandledRejection', (reason, promise) => {
  promise.catch(e => {
    winston.error('Unhandled Rejection: ', e);
  });
});

process.on('uncaughtException', (err, origin) => {
  winston.error(`Uncaught exception:`, err);
});

process.on('rejectionHandled', promise => {
  // 忽略
});


const config = {
  "WD_NAME": "",
  "WD_PW": "",
  "LOG_LVL": "info",
  "LOG_FILE": ""
}

try {
  let customCnfg = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  for (var prop in customCnfg) {
    if (config.hasOwnProperty(prop) && customCnfg.hasOwnProperty(prop)) { config[prop] = customCnfg[prop] }
  }
} catch (e) { if (['MODULE_NOT_FOUND', 'ENOENT'].includes(e.code)) {
	 winston.info("No config JSON file found. Loading environment variables as config...")
	}
  else throw e;
}
if (process.env.O5B_WD_NAME && process.env.O5B_WD_NAME!==undefined) { config.WD_NAME = process.env.O5B_WD_NAME };
if (process.env.O5B_WD_PW && process.env.O5B_WD_PW!==undefined) { config.WD_PW = process.env.O5B_WD_PW };
if (process.env.O5B_LOG_LVL && process.env.O5B_LOG_LVL!==undefined) { config.LOG_LVL = process.env.O5B_LOG_LVL };
if (process.env.O5B_LOG_FILE && process.env.O5B_LOG_FILE!==undefined) { config.LOG_FILE = process.env.O5B_LOG_FILE };

if(!config.WD_NAME||!config.WD_PW) {
  winston.error('Wikidot login details are required.');
  process.exit(0);
}

if (config.LOG_LVL) {
  winston.level = config.LOG_LVL;
} else {
  winston.level = 'info';
}

if (config.LOG_FILE) {
  const files = new winston.transports.File({
    filename: config.LOG_FILE,
    format: winston.format.combine(
      logFormat(),
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.printf(info => `${info.timestamp} [${info.level}] ${info.message}`)
    )
  });
  winston.add(files);
}

let bot = new CNTech();
bot.loginAll(config.WD_NAME, config.WD_PW)

bot.on('ready', ()=>{
  bot.schedule = {
    outdate: setInterval(()=>{
      return bot.outdate().catch(e=>winston.error(e.message));
    }, 43200000),
    remove: setInterval(()=>{
      return bot.remove().catch(e=>winston.error(e.message));
    }, 10800000),
    expire: setInterval(()=>{
      return bot.expire().catch(e=>winston.error(e.message));
    }, 43200000),
  }
  bot.outdate().catch(e=>winston.error(e.message));
  bot.remove().catch(e=>winston.error(e.message));
  bot.expire().catch(e=>winston.error(e.message));
  /*bot.debug().then(res=>{
    fs.writeFileSync('./trans-reserve.json', JSON.stringify(res, null, 2), 'utf8')
    //console.log(res)
    //console.log(`Retrieved ${res.length} records.`)
  }).catch(e=>winston.error(e.message))*/
})
