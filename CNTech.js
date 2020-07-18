const cheerio = require('cheerio');
const WD = require('./wikidot.js');
const EventEmitter = require('events');

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
    })
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
      [[#ifexpr %%form_raw{branch}%% == 15 | %%title%%[!-- ]] [[a href="http://[[#ifexpr %%form_raw{branch}%% == 00 | wanderers-library.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 01 | www.scp-wiki.net ]][[#ifexpr %%form_raw{branch}%% == 02 | scp-int.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 03 | scpfoundation.net ]][[#ifexpr %%form_raw{branch}%% == 04 | ko.scp-wiki.net ]][[#ifexpr %%form_raw{branch}%% == 05 | fondationscp.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 06 | scp-wiki.net.pl ]][[#ifexpr %%form_raw{branch}%% == 07 | scp-es.com ]][[#ifexpr %%form_raw{branch}%% == 08 | scp-th.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 09 | ja.scp-wiki.net ]][[#ifexpr %%form_raw{branch}%% == 10 | scp-wiki-de.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 11 | fondazionescp.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 12 | scp-ukrainian.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 13 | scp-pt-br.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 14 | scp-cs.wikidot.com ]]/%%name%%" target="_blank"]]%%title%%[[/a]][!-- --]
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
      console.log(`[DEBUG] Retreiving record ${i+1} of ${all.length}`)
      let meta = $(all[i]).children('td')
      let user = {
        displayName: $(meta[0]).text().trim(),
        unixname: $(meta[1]).text().trim(),
        id: $(meta[2]).text().trim(),
      }
      let a = $(meta[3]).find('a')
      let page = {
        url: a.attr('href'),
        name: a.attr('href').split('/').pop().trim(),
        title: a.text().trim(),
      }
      a = parseInt($(meta[4]).children('span').attr('class').split(' ')[1].substring(5)+'000')
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
      if (trans.exist||time.raw<=now-7776000000) {
        this.tech.delete(`reserve:${v.page.name}`).then(stat=>{
          if (stat.status==='ok') {
            console.log(`Successfully deleted "reserve:${v.page.name}"`)
          } else console.log(`${stat.status}: ${stat.message}`)
        })
      }
      else {
        this.tech.rename(`reserve:${v.page.name}`, `outdate:${v.page.name}`).then(stat=>{
          if (stat.status==='ok') {
            console.log(`Successfully renamed "reserve:${v.page.name}" to "outdate:${v.page.name}"`)
          } else console.log(`${stat.status}: ${stat.message}`)
        })
      }
    })
  }

  async remove() {
    let info = await this.getInfo({
      category: "outdate",
      created_at: "older than 90 day"
    })
    info.forEach(v=>{
      this.tech.delete(`outdate:${v.page.name}`).then(stat=>{
        if (stat.status==='ok') {
          console.log(`Successfully deleted "outdate:${v.page.name}"`)
        } else console.log(`${stat.status}: ${stat.message}`)
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
