let BaseModule = require("./base");
const fs = require("fs");
const cheerio = require('cheerio');
const winston = require('winston');

/**
 * Module that handles deleting spam pages.
 */
class AntiSpamModule extends BaseModule {
  static id = "AntiSpam";

  constructor(config, sites) {
    super(config);

    this.site = sites[config.site];
  }
  
  async listToDelete(userId, perpage, page, filter) {
    let pageinfo = await this.site.listUserRev(userId, perpage, page);
    let delList = [];
    let delListId = [];
    let $ = cheerio.load(pageinfo.body);
    let list = $('div.changes-list-item').filter((i,el)=>{
      return filter($, i, el);
    });
    winston.info(`[AntiSpam] Found ${list.length} pages needing to be deleted.`)
    for (let i = 0; i < list.length; i++) {
      let url = $(list[i]).find('td.title > a').attr('href');
      let rev = $(list[i]).find('td.revision-no').text().trim();
      rev = parseInt(rev.substring(6, rev.length-1)) ?? 0;
      let id = parseInt(await this.site.getPageId(url.split('/').pop()));
      if (delListId.includes(id)) {
        /* the same page appears again */
      } else {
        delList.push({
          url: url,
          pageId: id,
          deleted: false,
        });
        delListId.push(id);
      }      
      if (progressAlert(i)) {
        winston.info(`[AntiSpam] Processing page delete info: ${i}/${list.length}`)
      }
    }
    winston.info(`[AntiSpam] Processing page delete info: ${list.length}/${list.length}`)
    winston.info(`[AntiSpam] Page delete list constructed.`)
    return delList;
  }
  
  async deleteSpam(delList) {
    let failedList = [];
    for (let i = 0; i < delList.length; i++) {
      this.site.action('WikiPageAction', {
        event: 'deletePage',
        page_id: delList[i].pageId,
      }).then(()=>{
        winston.verbose(`[AntiSpam] Deleted page :${this.site.base}:${delList[i].url.split('/').pop()}.`);
        delList[i].deleted = true;
      }).catch(e=>{
        failedList.push(delList[i]);
        winston.error(`[AntiSpam] Page :${this.site.base}:${delList[i].url.split('/').pop()} failed to delete: ${e.stack}`)
      });
      if (progressAlert(i)) {
        winston.info(`[AntiSpam] Batch delete progress: ${i}/${delList.length}`)
      }
      await delayMs(this.delayMs);
    }
    winston.info(`[AntiSpam] Delete progress: ${delList.length}/${delList.length}`)
    winston.info(`[AntiSpam] Batch delete completed.`)
    winston.info(`[AntiSpam] Successful page count: ${delList.length-failedList.length}/${delList.length}`)
    winston.info(`[AntiSpam] Failed page count: ${failedList.length}/${delList.length}`)
    return {delList, failedList};
  }

  async start() {
    this.listToDelete(this.config.targetUser, 2000, 1, ($,i,el)=>{
      return $(el).find('td.title').text().includes(this.config.keywords.title) && $(el).find('td.site').text().includes(this.config.keywords.site);
    }).then(res=>{
      fs.writeFileSync('./data/batch-delete-list.json', JSON.stringify(res, null, 2), 'utf8');
      // fs.writeFileSync('./data/delete-list.json', JSON.stringify(res, null, 2), 'utf8');
      process.exit(0);
    }).catch(e=>winston.error(e.stack))
    this.deleteSpam(JSON.parse(fs.readFileSync('./data/batch-delete-list.json','utf8')).filter(v=>!v.deleted)).then(({delList,failedList})=>{
      fs.writeFileSync('./data/delete-failed-list.json', JSON.stringify(failedList, null, 2), 'utf8');
      process.exit(0);
    }).catch(e=>winston.error(e.stack));
  }

  async stop() {}
}

module.exports = AntiSpamModule;
