const fs = require('fs');
var config = {
  "WD_NAME": "",
  "WD_PW": ""
}

function loadEnv(cnfg) {
  if (process.env.O5B_WD_NAME && process.env.O5B_WD_NAME!==undefined) { cnfg.WD_NAME = process.env.O5B_WD_NAME };
  if (process.env.O5B_WD_PW && process.env.O5B_WD_PW!==undefined) { cnfg.WD_PW = process.env.O5B_WD_PW };
  return cnfg;
}

try {
  let customCnfg = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  for (var prop in customCnfg) {
    if (config.hasOwnProperty(prop) && customCnfg.hasOwnProperty(prop)) { config[prop] = customCnfg[prop] }
  }
} catch (e) { if (e.code === 'MODULE_NOT_FOUND') {
	console.log("No config JSON file found. Loading environment variables as config...")
	} }
loadEnv(config);

if(!config.WD_NAME||!config.WD_PW) {
  throw new Error("Wikidot login details are required.")
}

module.exports = config
