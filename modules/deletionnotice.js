let BaseModule = require("./base");
const cheerio = require('cheerio');
const winston = require('winston');
const { parseTime, delayMs } = require('../util');
let fs = require("fs");

/**
 * Module that handles sending deletion notice.
 */
class DeletionNoticeModule extends BaseModule {
  static id = "DeletionNotice";
  interval = 10800000;   //  3h
  filters = [];
  whitelist = [];
  deletionTags = "";

  constructor(config, sites) {
    super(config);

    this.filters = config.filters || [];
    this.whitelist = config.whitelist || [];
    this.title = config.title;
    this.source = config.source;
    this.deletionTags = config.tags;
    /**
     * @type {import("../wikidot.js")}
     */
    this.site = sites[config.site];
    for (let i = 0; i < this.filters.length; i++) {
      this.filters[i].countdown = parseTime(this.filters[i].countdown);
    }
    if (config.schedule) this.interval = parseTime(config.schedule);
  }

  async getInfo(params) {
    let info = [];
    let res = await this.site.listPages(Object.assign({
      category: "*",
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
      %%rating%%
      [[/cell]]
      [[/row]]
      [[/body]]
      [[foot]]
      [[/table]]
      [[/foot]]`
    }, params));
    let $ = cheerio.load(res.body);
    // console.log(res.body)

    let all = $('table').find('tr');
  
    // find pagination to see if we have missed things
    let pager = $('.pager');
    let isPaginated = !!pager.length;
    let pages = 1;
    if (isPaginated) {
      let pagerNum = pager.find("span.pager-no").text().trim();
      pages = pagerNum.match(/page \d+ of (\d+)/i)?.[1];
      winston.debug(`[DeletionNotice] Found ${pages} pages of with ${all.length} per page.`)
    }

    for (let i = 0; i < all.length; i++) {
      winston.debug(`[DeletionNotice] Retrieving record ${i+1} of ${all.length}`)
      let meta = $(all[i]).children('td')
      let rawname = $(meta[4]).text().trim()
      if (this.whitelist.includes(rawname)) continue;
      let user = {
        displayName: $(meta[0]).text().trim(),
        unixname: $(meta[0]).text().trim()==="(user deleted)" ? null : $(meta[1]).text().trim(),
        id: $(meta[2]).text().trim(),
      }
      // extract user id if user is deleted
      if ($(meta[0]).text().trim()==="(user deleted)") {
        await delayMs(this.delayMs);
        let $ = await this.site.history(rawname, {});
        $ = cheerio.load($.body);
        user.id = $("tbody").children("tr").last().find(`span[class="printuser deleted"]`).attr("data-id")
      }
      await delayMs(this.delayMs);
      let pageId = await this.site.resolvePageId(rawname)
      let threadId = await this.site.resolvePageDiscussion(pageId);
      // extract page data
      let page = {
        url: `${this.site.base}/${rawname}`,
        rawname,
        id: pageId,
        author: user,
        title: $(meta[5]).text().trim(),
        score: parseInt($(meta[7]).text().trim()),
        created: parseInt($(meta[6]).children('span').attr('class').split(' ')[1].substring(5)+'000'),
        threadId,
      }
      info.push(page);
    };
    return info;
  }

  /**
   * @param {string|number} page_or_id
   * @param {number} rating Rating at the time the notice is sent
   * @param {Date} expiry Expiry time for countdown timer
   */
  async sendNotice(page_or_id, rating, expiry) {
    let threadId = await this.site.resolvePageDiscussion(page_or_id);
    await delayMs(this.delayMs);
    return await this.site.sendForumPost(threadId, {
      title: this.title,
      source: this.source.replace("{$rating}", rating).replace("{$expiry}", encodeURIComponent(expiry.toISOString())),
    })
  }

  async notice() {
    for (let i = 0; i < this.filters.length; i++) {
      let info = await this.getInfo({
        tags: this.filters[i].tags,
        category: this.filters[i].category,
        rating: `<=${this.filters[i].threshold}`,
      });
      if (this.filters[i].instakill !== undefined) info = info.filter(v=>v.score > this.filters[i].instakill);
      await delayMs(this.delayMs);
      for (let v of info) {
        if (v.score <= this.filters[i].threshold) {
          try {
            await this.sendNotice(v.id, v.score, new Date(Date.now() + this.filters[i].countdown));
            winston.verbose(`[DeletionNotice] Sent deletion notice for "${v.rawname}"`);
          } catch (e) {
            winston.warn(`[DeletionNotice] ${e.name} at sending deletion notice for "${v.rawname}": ${e.message}`);
          }
          try {
            await this.site.setTags(v.id, this.deletionTags);
            winston.verbose(`[DeletionNotice] Set deletion tags for "${v.rawname}"`);
          } catch (e) {
            winston.warn(`[DeletionNotice] ${e.name} at setting deletion tags for "${v.rawname}": ${e.message}`);
          }
          await delayMs(this.delayMs);
        }
      }
    }
  }

  async debug() {
    return await this.getInfo({
      tags: this.filters[0].tags,
      category: this.filters[0].category,
      rating: `<=${this.filters[0].threshold}`,
    });
  }

  async start() {
    this.schedule = {
      notice: setInterval(()=>{
        return this.notice().catch(e=>winston.error(e.stack));
      }, this.interval),
    }
    this.notice().catch(e=>winston.error(e.stack));

    // this.debug().then(res=>{
    //   fs.writeFileSync('./data/deletion-notice.json', JSON.stringify(res, null, 2), 'utf8')
    //   //console.log(res)
    //   winston.debug(`[DeletionNotice] Retrieved ${res.length} records excluding whitelisted pages.`)
    // }).catch(e=>winston.error(e.stack))
  }

  async stop() {
    clearInterval(this.schedule.notice);
  }
}

module.exports = DeletionNoticeModule;
