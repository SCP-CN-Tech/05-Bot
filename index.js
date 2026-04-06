const WD = require('./wikidot.js');
const EventEmitter = require('events');
const winston = require('winston');
const { loadConfig } = require("./util");
const { loadModules } = require('./modules');

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

// -------- Loading config --------

let config = loadConfig("config");
if (!config) {
  winston.error("No config file found. Exiting now.");
  process.exit(0);
}

if (!config.wikidot?.username || !config.wikidot?.password) {
  winston.error('Wikidot login details are required.');
  process.exit(0);
}

if (config.logLevel) {
  winston.level = config.logLevel;
} else {
  winston.level = 'info';
}

if (config.logFile) {
  const files = new winston.transports.File({
    filename: config.logFile,
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

class ModuleManager extends EventEmitter {
  modules = loadModules();
  loadedModules = {};
  sites = {};

  constructor() {
    super();

    // -------- Handle wikidot site logins --------

    for (const site of config.wikidot.sites) {
      console.log(site.id)
      this.sites[site.id] = new WD(site.name);
    }

    this.loginAll();

    // -------- Loading function modules --------

    for (const module in config.modules) {
      if (config.modules[module].enabled && this.modules[module] !== undefined) {
        this.loadedModules[module] = new this.modules[module](config.modules[module], this.sites);
      };
    }
  }

  loginSite(site, WD_NAME, WD_PW) {
    let temp = this.sites[site].login(WD_NAME, WD_PW);
    temp.then(()=>{
      winston.info(`[05-Bot] Bot logged onto ${this.sites[site].domain}.`)
      winston.info(`[05-Bot] ${this.sites[site].domain} login expires on ${this.sites[site].cookie.exp}.`)
    })
    if (this.sites[site]._refresh) { clearInterval(this.sites[site]._refresh) }
    this.sites[site]._refresh = setInterval(()=>{
      try {
        if (this.sites[site].cookie.exp - Date.now() <= 2592000000) {
          this.sites[site].login(WD_NAME, WD_PW).then(()=>{
            winston.info(`[05-Bot] Bot logged onto ${this.sites[site].domain}.`)
            winston.info(`[05-Bot] ${this.sites[site].domain} login expires on ${this.sites[site].cookie.exp}.`)
          })
        }
      } catch (e) {
        winston.error(`[05-Bot] ${e.message}`);
      }
    }, 864000000)
    return temp;
  }

  loginAll() {
    Promise.all(config.wikidot.sites.map(site=>this.loginSite(site.id, config.wikidot?.username, config.wikidot?.password))).then(()=>{
      winston.info(`[05-Bot] Bot is ready.`);
      this.emit('ready');
    }).catch(e=>{
      winston.error(`[05-Bot] ${e.message}`);
      process.exit(0);
    })
  }

  start() {
    for (const module in this.loadedModules) {
      this.loadedModules[module].start();
    }
  }

  stop() {
    for (const module in this.loadedModules) {
      this.loadedModules[module].stop();
    }
  }
}

let bot = new ModuleManager();
bot.start();
