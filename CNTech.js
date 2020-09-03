const cheerio = require('cheerio');
const WD = require('./wikidot.js');
const EventEmitter = require('events');
const winston = require('winston');
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

class CNTech extends EventEmitter {
  constructor() {
    super();

    this.tech = new WD('scp-tech-cn');
    this.cn = new WD('scp-wiki-cn');
    this.reserves = [];
    this.outdates = [];
  }

  loginAll(WD_NAME, WD_PW) {
    let t = this.loginSite("tech", WD_NAME, WD_PW)
    let c = this.loginSite("cn", WD_NAME, WD_PW)
    Promise.all([t,c]).then(()=>{
      this.emit('ready')
      winston.info(`Bot is ready.`)
    }).catch(e=>{
      winston.error(e.message)
    })
  }
  loginSite(site, WD_NAME, WD_PW) {
    let temp = this[site].login(WD_NAME, WD_PW)
    temp.then(()=>{
      winston.info(`Bot logged onto ${this[site].domain}.`)
      winston.info(`${this[site].domain} login expires on ${this[site].cookie.exp}.`)
    })
    if (this[site]._refresh) { clearInterval(this[site]._refresh) }
    this[site]._refresh = setInterval(()=>{
      try {
        if (this[site].cookie.exp - Date.now() <= 2592000000) {
          this[site].login(WD_NAME, WD_PW).then(res=>{
            winston.info(`Bot logged onto ${this[site].domain}.`)
            winston.info(`${this[site].domain} login expires on ${this[site].cookie.exp}.`)
          })
        }
      } catch (e) {
        winston.error(e.message)
      }
    }, 864000000)
    return temp
  }

  async getInfo(params) {
    let info = [];
    let cn = this.cn;
    let tech = this.tech;
    let res = await tech.listPages(Object.assign({
      category: "reserve",
      created_at: "older than 30 day",
      order: "created_at desc desc",
      perPage: "500",
      separate: "false",
      module_body: `[[head]]
      [[table class="wiki-content-table"]]
      [[/head]]
      [[body]]
      [[row]]
      [[cell]]
      %%created_by%%
      [[/cell]]
      [[cell]]
      %%created_by_unix%%
      [[/cell]]
      [[cell]]
      %%created_by_id%%
      [[/cell]]
      [[cell]]
      %%form_raw{branch}%%
      [[/cell]]
      [[cell]]
      %%name%%
      [[/cell]]
      [[cell]]
      %%fullname%%
      [[/cell]]
      [[cell]]
      %%title%%
      [[/cell]]
      [[cell]]
      %%created_at|%Y-%m-%d|hover%%
      [[/cell]]
      [[/row]]
      [[/body]]
      [[foot]]
      [[/table]]
      [[/foot]]`
    }, params));
    let $ = cheerio.load(res.body);
    //console.log(res.body)
    let all = $('table').find('tr');
    for (let i = 0; i < all.length; i++) {
      winston.debug(`Retreiving record ${i+1} of ${all.length}`)
      let meta = $(all[i]).children('td')
      let rawname = $(meta[5]).text().trim()
      let user = {
        displayName: $(meta[0]).text().trim(),
        unixname: $(meta[0]).text().trim()==="(user deleted)" ? null : $(meta[1]).text().trim(),
        id: $(meta[2]).text().trim(),
      }
      if ($(meta[0]).text().trim()==="(user deleted)") {
        let $ = await tech.history(rawname, {});
        $ = cheerio.load($.body);
        user.id = $("tbody").children("tr").last().find(`span[class="printuser deleted"]`).attr("data-id")
      }
      let temp = $(meta[3]).text().trim(), temp2 = null;
      let cat = parseInt(temp)==0 ? "wanderers:" : ""
      if (parseInt(temp)<0||parseInt(temp)>=15) { temp = null }
      else {
        temp2=`http://${branch[temp]}.wikidot.com/${$(meta[4]).text().trim()}`
        temp = await cn.quic("PageLookupQModule", {s:branchId[temp], q:$(meta[4]).text().trim()})
        temp = temp.pages.find(v=>v.unix_name === $(meta[4]).text().trim())
      }
      let page = {
        exist: temp2 ? !!temp : null,
        url: temp2,
        name: $(meta[4]).text().trim(),
        title: temp ? temp.title : $(meta[6]).text().trim(),
      }
      let created = parseInt($(meta[7]).children('span').attr('class').split(' ')[1].substring(5)+'000')
      let trans = {
        exist: false,
        translator: null,
        url: null,
        title: null,
        created: null,
      }
      temp = `${cat}${page.name}`
      let pageinfo = await cn.listPages({
        category: '*',
        fullname: temp.length>60 ? temp.substring(0,60) : temp,
        module_body: `[[table class="exist"]]
        [[row]]
        [[cell]]
        %%created_by%%
        [[/cell]]
        [[cell]]
        %%created_by_unix%%
        [[/cell]]
        [[cell]]
        %%created_by_id%%
        [[/cell]]
        [[cell]]
        %%link%%
        [[/cell]]
        [[cell]]
        %%title%%
        [[/cell]]
        [[cell]]
        %%created_at|%Y-%m-%d|hover%%
        [[/cell]]
        [[/row]]
        [[/table]]`});
      meta = cheerio.load(pageinfo.body)('table.exist').find('td');
      if (!!meta.length) {
        trans = {
          exist: true,
          translator: {
            displayName: $(meta[0]).text().trim(),
            unixname: $(meta[1]).text().trim(),
            id: $(meta[2]).text().trim(),
          },
          url: $(meta[3]).text().trim(),
          title: $(meta[4]).text().trim(),
          created: parseInt($(meta[5]).children('span').attr('class').split(' ')[1].substring(5)+'000'),
        }
      }
      info.push({user:user, page:page, created:created, trans:trans, rawname:rawname});
    };
    return info;
  }

  async outdate() {
    let now = Date.now()
    let info = await this.getInfo({
      category: "reserve",
      created_at: "older than 30 day"
    })
    info.forEach(v=>{
      if (v.trans.exist && v.created<=v.trans.created || v.created<=now-7776000000) {
        this.tech.delete(v.rawname).then(stat=>{
          if (stat.status==='ok') {
            winston.verbose(`Deleted "${v.rawname}"`)
          } else winston.warn(`${stat.status}: ${stat.message}`)
        }).catch(e=>winston.error(e.message))
      }
      else {
        this.tech.rename(v.rawname, `outdate:${v.page.name}`).then(stat=>{
          if (stat.status==='ok') {
            winston.verbose(`Renamed "${v.rawname}" to "outdate:${v.page.name}"`)
          } else winston.warn(`${stat.status}: ${stat.message}`)
        }).catch(e=>winston.error(e.message))
      }
    })
  }

  async remove() {
    let info = await this.getInfo({
      category: "reserve",
      created_at: null,
      tags: "-无原文",
    })
    let info2 = await this.getInfo({
      category: "outdate",
      created_at: "older than 30 day",
      tags: "-长网址",
    })
    info.forEach(v=>{
      let tag = v.rawname.length>=55 ? ["长网址"] : [];
      if (v.page.exist === false) {
        tag.push("无原文");
        winston.verbose(`No source article for "${v.rawname}"`)
      } else if (v.trans.exist && v.created<=v.trans.created) {
        tag.push("已翻译")
      }
      if (tag.length) {
        this.tech.tags(v.rawname, {add: tag}).then(stat=>{
          if (stat.status!=='ok') { winston.warn(`${stat.status}: ${stat.message}`) }
        }).catch(e=>winston.error(e.message))
      }
    })
    info2.forEach(v=>{
      if (!v.page.exist || v.trans.exist) {
        this.tech.delete(v.rawname).then(stat=>{
          if (stat.status==='ok') {
            winston.verbose(`Deleted "${v.rawname}"`)
          } else winston.warn(`${stat.status}: ${stat.message}`)
        }).catch(e=>winston.error(e.message))
      }
    })
  }

  async untag() {
    let info = await this.getInfo({
      category: "reserve",
      created_at: null,
      tags: "+已翻译",
    })
    info.forEach(v=>{
      if (!v.trans.exist) {
        this.tech.tags(v.rawname, {remove: "已翻译"}).then(stat=>{
          if (stat.status!=='ok') { winston.warn(`${stat.status}: ${stat.message}`) }
        }).catch(e=>winston.error(e.message))
      }
    })
  }

  async expire() {
    let info = await this.getInfo({
      category: "outdate",
      created_at: "older than 90 day"
    })
    info.forEach(v=>{
      this.tech.delete(`${v.rawname}`).then(stat=>{
        if (stat.status==='ok') {
          winston.verbose(`Deleted "${v.rawname}"`)
        } else winston.warn(`${stat.status}: ${stat.message}`)
      }).catch(e=>winston.error(e.message))
    })
  }

  async debug() {
    return await this.getInfo({
      created_at: null,
      category: "outdate",
    })
  }
}
module.exports = CNTech;
