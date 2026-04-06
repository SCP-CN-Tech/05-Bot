let BaseModule = require("./base");
const got = require('got');
const cheerio = require('cheerio');
const winston = require('winston');
const { branch, branchId, progressAlert, parseTime } = require('../util');

/**
 * Module that handles translation reservation.
 */
class TransResModule extends BaseModule {
  static id = "Transres";
  intervals = {
    outdate: 43200000,   // 12h
    remove:  10800000,   //  3h
    expire:  43200000,   // 12h
    untag:   10800000,   //  3h
    archive: 10800000,   //  3h
  }

  constructor(config, sites) {
    super(config);

    this.reserveSite = sites[config.reserveSite];
    this.translateSite = sites[config.translateSite];
    if (config.schedule) {
      for (const task in config.schedule) {
        if (this.intervals[task]) {
          this.intervals[task] = parseTime(config.schedule[task]);
        }
      }
    }
  }

  async getInfo(params) {
    let info = [];
    let res = await this.reserveSite.listPages(Object.assign({
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
      [[cell]]
      %%form_raw{page}%%
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
      winston.debug(`[Transres] Retreiving record ${i+1} of ${all.length}`)
      let meta = $(all[i]).children('td')
      let rawname = $(meta[5]).text().trim()
      let user = {
        displayName: $(meta[0]).text().trim(),
        unixname: $(meta[0]).text().trim()==="(user deleted)" ? null : $(meta[1]).text().trim(),
        id: $(meta[2]).text().trim(),
      }
      // extract user id if user is deleted
      if ($(meta[0]).text().trim()==="(user deleted)") {
        let $ = await this.reserveSite.history(rawname, {});
        $ = cheerio.load($.body);
        user.id = $("tbody").children("tr").last().find(`span[class="printuser deleted"]`).attr("data-id")
      }
      // extract target page and branch
      let temp = $(meta[3]).text().trim(), temp2 = null;
      let cat = parseInt(temp)==0 ? "wanderers:" : "";
      let temp3 = rawname.length >= 55 && $(meta[8]).text().trim().length ? $(meta[8]).text().trim() : $(meta[4]).text().trim();
      if (parseInt(temp)<0||parseInt(temp)>=15) { temp = null }
      else {
        temp2=`http://${branch[temp]}.wikidot.com`;
        temp = await this.translateSite.quick("PageLookupQModule", {s:branchId[temp], q:temp3});
        temp = temp.pages.find(v=>v.unix_name === temp3);
      }
      let page = {
        exist: temp2 ? !!temp : null,
        originWiki: temp2,
        url: temp2 ? `${temp2}/${temp3}` : temp3,
        name: temp3,
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
      // handle wanderers library category stripping
      temp = `${cat}${page.name.startsWith("wanderers:") ? page.name.replace("wanderers:","") : page.name}`
      let pageinfo = await this.translateSite.listPages({
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
      info.push({user, page, created, trans, rawname});
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
        this.reserveSite.delete(v.rawname).then(()=>{
          winston.verbose(`[Transres] Deleted "${v.rawname}"`);
        }).catch(e=>{
          winston.warn(`[Transres] ${e.name} at deleting "${v.rawname}": ${e.message}`);
        })
      }
      else {
        this.reserveSite.rename(v.rawname, `outdate:${v.page.name}`).then(()=>{
          winston.verbose(`[Transres] Renamed "${v.rawname}" to "outdate:${v.page.name}"`);
        }).catch(e=>{
          if (e.name==='page_exists') {
            this.reserveSite.delete(`outdate:${v.page.name}`).then(()=>{
              winston.verbose(`[Transres] Deleted "outdate:${v.page.name}"`);
              this.reserveSite.rename(v.rawname, `outdate:${v.page.name}`).then(()=>{
                winston.verbose(`[Transres] Renamed "${v.rawname}" to "outdate:${v.page.name}"`);
              }).catch(e=>{
                winston.warn(`[Transres] ${e.name} at renaming "${v.rawname}": ${e.message}`);
              })
            }).catch(e=>{
              winston.warn(`[Transres] ${e.name} at deleting "${v.rawname}": ${e.message}`);
            })
          }
          else winston.warn(`[Transres] ${e.name} at renaming "${v.rawname}": ${e.message}`);
        })
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
        winston.verbose(`[Transres] No source article for "${v.rawname}"`);
      } else if (v.trans.exist && v.created<=v.trans.created) {
        tag.push("已翻译")
      }
      if (tag.length) {
        this.reserveSite.tags(v.rawname, {add: tag}).catch(e=>{
          winston.warn(`[Transres] ${e.name} at tagging "${v.rawname}": ${e.message}`);
        })
      }
    })
    info2.forEach(v=>{
      if (!v.page.exist || v.trans.exist) {
        this.reserveSite.delete(v.rawname).then(()=>{
          winston.verbose(`[Transres] Deleted "${v.rawname}"`);
        }).catch(e=>{
          winston.warn(`[Transres] ${e.name} at deleting "${v.rawname}": ${e.message}`);
        })
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
        this.reserveSite.tags(v.rawname, {remove: "已翻译"}).catch(e=>{
          winston.warn(`[Transres] ${e.name} at tagging "${v.rawname}": ${e.message}`);
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
      this.reserveSite.delete(v.rawname).then(()=>{
        winston.verbose(`[Transres] Deleted "${v.rawname}"`);
      }).catch(e=>{
        winston.warn(`[Transres] ${e.name} at deleting "${v.rawname}": ${e.message}`);
      })
    })
  }

  async updateArchive(apiEndpoint, token) {
    let info = await this.getInfo({
      category: "reserve outdate",
      created_at: null,
    });
    let res = await got.post(apiEndpoint, {
      json: {
        token,
        data: info.map(v=>{
          return {
            user: v.user.displayName,
            userWikidotId: parseInt(v.user.id),
            wikipage: v.page.name,
            originWiki: v.page.originWiki,
            title: v.page.title,
            date: v.created,
            expired: v.rawname.startsWith("outdate"),
          }
        })
      },
    }).json();
    if (res.status == "ok") {
      winston.verbose(`[Archiver] updated archive.`);
    } else {
      winston.error(`[Archiver] ${res.error}: ${res.message}`);
    }
  }
  
  async debug() {
    return await this.getInfo({
      created_at: null,
      category: "outdate",
    })
  }

  async start() {
    this.schedule = {
      outdate: setInterval(()=>{
        return this.outdate().catch(e=>winston.error(e.stack));
      }, this.intervals.outdate),
      remove: setInterval(()=>{
        return this.remove().catch(e=>winston.error(e.stack));
      }, this.intervals.remove),
      expire: setInterval(()=>{
        return this.expire().catch(e=>winston.error(e.stack));
      }, this.intervals.expire),
      untag: setInterval(()=>{
        return this.untag().catch(e=>winston.error(e.stack));
      }, this.intervals.untag),
    }
    this.outdate().catch(e=>winston.error(e.stack));
    this.remove().catch(e=>winston.error(e.stack));
    this.expire().catch(e=>winston.error(e.stack));
    this.untag().catch(e=>winston.error(e.stack));
    if (this.config.archiver?.enabled) {
      this.schedule.archive = setInterval(()=>{
        return this.updateArchive(this.config.archiver.api, this.config.archiver.token).catch(e=>winston.error(e.stack));
      }, this.intervals.archive),
      this.updateArchive(this.config.archiver.api, this.config.archiver.token).catch(e=>winston.error(e.stack));
    }

    // this.debug().then(res=>{
    //   // fs.writeFileSync('./data/trans-reserve.json', JSON.stringify(res, null, 2), 'utf8')
    //   //console.log(res)
    //   console.log(`Retrieved ${res.length} records.`)
    // }).catch(e=>winston.error(e.stack))
  }

  async stop() {
    clearInterval(this.schedule.outdate);
    clearInterval(this.schedule.remove);
    clearInterval(this.schedule.expire);
    clearInterval(this.schedule.untag);
    if (this.config.archiver?.enabled) {
      clearInterval(this.schedule.archive);
    }
  }
}

module.exports = TransResModule;
