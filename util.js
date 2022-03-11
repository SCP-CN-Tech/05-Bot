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

module.exports = {
  branch,
  branchId,
  progressAlert,
}
