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

class CNTech extends EventEmitter {
  constructor() {
    super();

    this.tech = new WD('scp-tech-cn');
    this.cn = new WD('scp-wiki-cn');
    this.reserves = [];
    this.outdates = [];
  }
  login(WD_NAME, WD_PW) {
    this.tech.login(WD_NAME, WD_PW).then(res=>{
      this.emit('ready', res)
      winston.info(`Bot logged onto scp-tech-cn.`)
      winston.info(`Bot login expires on ${this.tech.cookie.exp}.`)
      winston.info(`Bot is ready.`)
    }).catch(e=>{
      winston.error(e.message)
    })
    this.tech._refresh = setInterval(()=>{
      try {
        if (this.tech.cookie.exp - Date.now() <= 2592000000) {
          this.tech.login(WD_NAME, WD_PW).then(res=>{
            winston.info(`Bot refreshed login status on scp-tech-cn.`)
            winston.info(`Bot login expires on ${this.tech.cookie.exp}.`)
          })
        }
      } catch (e) {
        winston.error(e.message)
      }
    }, 864000000)
  }

  async getInfo(params) {
    let info = [];
    let cn = this.cn;
    let res = await this.tech.module('list/ListPagesModule', Object.assign({
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
      let user = {
        displayName: $(meta[0]).text().trim(),
        unixname: $(meta[1]).text().trim(),
        id: $(meta[2]).text().trim(),
      }
      let a = $(meta[3]).text().trim()
      if (parseInt(a)<0||parseInt(a)>=15) { a===null }
      else { a=`http://${branch[a]}.wikidot.com/${$(meta[4]).text().trim()}` }
      let page = {
        url: a,
        name: $(meta[4]).text().trim(),
        title: $(meta[5]).text().trim(),
      }
      a = parseInt($(meta[6]).children('span').attr('class').split(' ')[1].substring(5)+'000')
      let time = {
        raw: a,
        date: new Date(a),
      }
      let trans = {
        exist: false,
        translator: null,
        url: null,
        title: null,
      }
      let pageinfo = await cn.module('list/ListPagesModule', {
        name: page.name,
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
        }
      }
      info.push({user:user, page:page, time:time, trans:trans});
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
      if (v.trans.exist||v.time.raw<=now-7776000000) {
        this.tech.delete(`reserve:${v.page.name}`).then(stat=>{
          if (stat.status==='ok') {
            winston.verbose(`Deleted "reserve:${v.page.name}"`)
          } else winston.warn(`${stat.status}: ${stat.message}`)
        })
      }
      else {
        this.tech.rename(`reserve:${v.page.name}`, `outdate:${v.page.name}`).then(stat=>{
          if (stat.status==='ok') {
            winston.verbose(`Renamed "reserve:${v.page.name}" to "outdate:${v.page.name}"`)
          } else winston.warn(`${stat.status}: ${stat.message}`)
        })
      }
    })
  }

  async remove() {
    let info = await this.getInfo({
      category: "reserve",
      created_at: null
    })
    let info2 = await this.getInfo({
      category: "outdate",
      created_at: "older than 30 day"
    })
    info.forEach(v=>{
      if (v.trans.exist) {
        this.tech.delete(`reserve:${v.page.name}`).then(stat=>{
          if (stat.status==='ok') {
            winston.verbose(`Deleted "reserve:${v.page.name}"`)
          } else winston.warn(`${stat.status}: ${stat.message}`)
        })
      }
    })
    info2.forEach(v=>{
      if (v.trans.exist) {
        this.tech.delete(`outdate:${v.page.name}`).then(stat=>{
          if (stat.status==='ok') {
            winston.verbose(`Deleted "outdate:${v.page.name}"`)
          } else winston.warn(`${stat.status}: ${stat.message}`)
        })
      }
    })
  }

  async expire() {
    let info = await this.getInfo({
      category: "outdate",
      created_at: "older than 90 day"
    })
    info.forEach(v=>{
      this.tech.delete(`outdate:${v.page.name}`).then(stat=>{
        if (stat.status==='ok') {
          winston.verbose(`Deleted "outdate:${v.page.name}"`)
        } else winston.eror(`${stat.status}: ${stat.message}`)
      })
    })
  }

  async debug() {
    return await this.getInfo({
      created_at: null,
    })
  }
}
module.exports = CNTech;
