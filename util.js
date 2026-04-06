let { load } = require("js-yaml");
let fs = require("fs");

const branch = {
  "00": "wanderers-library",
  "01": "scp-wiki",
  "02": "scp-int",
  "03": "scp-ru",
  "04": "scpko",
  "05": "fondationscp",
  "06": "scp-pl",
  "07": "scp-es",
  "08": "scp-th",
  "09": "scp-jp",
  "10": "scp-wiki-de",
  "11": "fondazionescp",
  "12": "scp-ukrainian",
  "13": "scp-pt-br",
  "14": "scp-cs",
  "15": ""
}
const branchId = {
  "00": "146034",
  "01": "66711",
  "02": "1427610",
  "03": "169125",
  "04": "486864",
  "05": "464696",
  "06": "647733",
  "07": "1968241",
  "08": "547203",
  "09": "578002",
  "10": "1269857",
  "11": "530167",
  "12": "1398197",
  "13": "783633",
  "14": "2060442",
  "15": "",
}

const progressAlert = (progress) => {
  return !(progress % Math.pow(10, Math.max( Math.floor(Math.log10(progress)), 1 )))
}

const fileExists = (name) => {
  try {
    fs.accessSync(name, fs.constants.R_OK);
    return true;
  } catch (err) {
    return false;
  }
}

function loadConfig(name) {
  if (fileExists(`${name}.yaml`)) {
    return load(fs.readFileSync(`${name}.yaml`, 'utf8'));
  } else if (fileExists(`${name}.yml`)) {
    return load(fs.readFileSync(`${name}.yml`, 'utf8'));
  } else if (fileExists(`${name}.json`)) {
    return JSON.parse(fs.readFileSync(`${name}.json`, 'utf8'));
  } else {
    return null;
  }
}

async function delayMs(ms) {
  return new Promise(res => setTimeout(res, ms));
}

/**
 * Executes the callback at every 0th and 30th minute.
 * 
 * Returns an object containing the changing timeout handle,
 * useable with clearTimeout().
 */
function everyHalfHour(callback) {
  let timeout = {
    inner: null
  };

  (function loop() {
    let now = new Date();
    if (now.getMinutes() === 0 || now.getMinutes() === 30) {
      callback();
    }
    now = new Date();                  // allow for time passing
    let delay = 60000 - (now % 60000); // exact ms to next minute interval
    timeout.inner = setTimeout(loop, delay);
  })();

  return timeout;
}

/**
 * Parse time interval strings
 * 
 * e.g. 1d3h5m10s = 1 day + 3 hours + 5 minutes + 10 seconds
 */
function parseTime(time) {
  let day = /(\d+)d/i.exec(time)?.[1];
  let hour = /(\d+)h/i.exec(time)?.[1];
  let min = /(\d+)m/i.exec(time)?.[1];
  let sec = /(\d+)s/i.exec(time)?.[1];
  let timeMs = 0;
  if (day) timeMs += parseInt(day);
  timeMs *= 24;
  if (hour) timeMs += parseInt(hour);
  timeMs *= 60;
  if (min) timeMs += parseInt(min);
  timeMs *= 60;
  if (sec) timeMs += parseInt(sec);
  return timeMs * 1000;
}

module.exports = {
  loadConfig,
  delayMs,
  everyHalfHour,
  branch,
  branchId,
  progressAlert,
  parseTime,
}
