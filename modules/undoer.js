let BaseModule = require("./base");
const fs = require("fs");
const cheerio = require('cheerio');
const winston = require('winston');

/**
 * Module that handles mass revision rollbacks.
 */
class UndoerModule extends BaseModule {
  static id = "Undoer";

  constructor(config, sites) {
    super(config);

    this.site = sites[config.site];
  }
  
  async listToUndo(userId, perpage, page, filter) {
    let pageinfo = await this.site.listUserRev(userId, perpage, page);
    let undoList = [];
    let undoListId = [];
    let $ = cheerio.load(pageinfo.body);
    let list = $('div.changes-list-item').filter((i,el)=>{
      return filter($, i, el);
    });
    winston.info(`[Undoer] Found ${list.length} pages needing to be reverted.`)
    for (let i = 0; i < list.length; i++) {
      let url = $(list[i]).find('td.title > a').attr('href');
      let rev = $(list[i]).find('td.revision-no').text().trim();
      rev = parseInt(rev.substring(6, rev.length-1)) ?? 0;
      let id = parseInt(await this.site.base.getPageId(url.split('/').pop()));
      let latestRev = parseInt(cheerio.load((await this.site.base.listPages({
        category: '*',
        fullname: url.split('/').pop(),
        module_body: `%%revisions%%`,
      })).body)('p').text().trim()) ?? 0;
      if (undoListId.includes(id)) {
        /* the same page appears again */
        let idx = undoListId.indexOf(id);
        if (rev < undoList[idx].rev) undoList[idx].rev = rev;
        else if (rev > undoList[idx].newrev) {
          undoList[idx].reverted = parseInt(latestRev) > rev;
          undoList[idx].newrev = rev;
        }
      } else {
        undoList.push({
          url: url,
          pageId: id,
          rev: rev,
          newrev: rev,
          latestRev: latestRev,
          reverted: parseInt(latestRev) > rev,
        });
        undoListId.push(id);
      }      
      if (progressAlert(i)) {
        winston.info(`[Undoer] Processing page revert info: ${i}/${list.length}`)
      }
    }
    winston.info(`[Undoer] Processing page revert info: ${list.length}/${list.length}`)
    winston.info(`[Undoer] Page revert list constructed.`)
    return undoList;
  }
  
  async undoRev(undoList) {
    let failedList = [];
    for (let i = 0; i < undoList.length; i++) {
      let res = await this.site.module('history/PageRevisionListModule', {
        page_id: undoList[i].pageId,
        options: '{"all":true}',
        perpage: 20,
        page: 1,
      });
      let $ = cheerio.load(res.body);
      let rev = $('tr[id|="revision-row"]').filter((_i,el)=>{
        return $($(el).children('td')[0]).text().trim()==`${undoList[i].rev-1}.`
      });
      let revId = rev.find('input').attr('id');
      this.site.action('WikiPageAction', {
        event: 'revert',
        pageId: undoList[i].pageId,
        revisionId: revId,
      }).then(()=>{
        winston.verbose(`[Undoer] Reverted page :${this.site.base}:${undoList[i].url.split('/').pop()} to revision ${undoList[i].rev-1}.`);
      }).catch(e=>{
        failedList.push(undoList[i]);
        winston.error(`[Undoer] Page :${this.site.base}:${undoList[i].url.split('/').pop()} failed to revert: ${e.stack}`)
      });
      if (progressAlert(i)) {
        winston.info(`[Undoer] Batch revert progress: ${i}/${undoList.length}`)
      }
    }
    winston.info(`[Undoer] Revert progress: ${undoList.length}/${undoList.length}`)
    winston.info(`[Undoer] Batch revert completed.`)
    winston.info(`[Undoer] Successful page count: ${undoList.length-failedList.length}/${undoList.length}`)
    winston.info(`[Undoer] Failed page count: ${failedList.length}/${undoList.length}`)
    return failedList;
  }

  async start() {
    this.listToUndo(this.config.targetUser, 2000, 1, ($,i,el)=>{
      return $(el).find('div.comments').text().includes(this.config.keywords.comment) && $(el).find('td.site').text().includes(this.config.keywords.site);
    }).then(res=>{
      fs.writeFileSync('./data/batch-undo-list.json', JSON.stringify(res.filter(v=>!!v.rev), null, 2), 'utf8')
      fs.writeFileSync('./data/delete-list.json', JSON.stringify(res.filter(v=>!v.rev), null, 2), 'utf8')
      process.exit(0)
    }).catch(e=>winston.error(e.stack))
    this.undoRev(JSON.parse(fs.readFileSync('./data/batch-undo-list.json','utf8')).filter(v=>!v.reverted)).then(failedList=>{
      fs.writeFileSync('./data/undo-failed-list.json', JSON.stringify(failedList, null, 2), 'utf8')
      process.exit(0)
    }).catch(e=>winston.error(e.stack));
  }

  async stop() {}
}

module.exports = UndoerModule;
