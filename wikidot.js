const got = require('got');
const cheerio = require('cheerio');
class WD {
  constructor(base) {
    this.wiki(base);
    this.cookie = {
      auth: '',
      sess: '',
      expire: null
    };
  }
  wiki(base) {
    if (!base.startsWith("http")) { base = `http://${base}.wikidot.com` }
    this.base = base;
    this.ajax = `${base}/ajax-module-connector.php`;
    return this;
  }
  setCookies(v) { Object.assign(this.cookie, v) }

  async req(params) {
    const wikidotToken7 = Math.random().toString(36).substring(4);
    return await got.post(this.ajax, {
      headers: {Cookie: `${this.cookie.auth}wikidot_token7=${wikidotToken7}`},
      form: Object.assign({wikidot_token7: wikidotToken7, callbackIndex: 0}, params)
    }).json();
  };

  async module(moduleName, params) {
    return await this.req(Object.assign({moduleName: moduleName}, params))
  }

  async action(action, params) {
    return await this.req(Object.assign({action: action, moduleName: "Empty"}, params))
  }

  async login(username, password) {
    const wikidotToken7 = Math.random().toString(36).substring(4);
    let res = await got.post('https://www.wikidot.com/default--flow/login__LoginPopupScreen', {
      headers: {Cookie: `wikidot_token7=${wikidotToken7}`},
      form: {
				login: username,
				password: password,
				action: 'Login2Action',
				event: 'login',
        wikidot_token7: wikidotToken7,
        callbackIndex: 0
			}
			})
    if (res.body.includes("The login and password do not match.")) {throw new Error("The login and password do not match.")}
    let tmp = res.headers['set-cookie'][1].split("; ")
  	this.cookie.sess = tmp[0]
  	this.cookie.expire = tmp[1].split("=")[1]
    this.cookie.auth = `${this.cookie.sess}; wikidot_udsession=1; `
    return this;
  }

  async getPageId(page) {
    let pg = await got.get(`${this.base}/${page}`).text()
  	pg = cheerio.load(pg)
  	let page_id;
  	pg(pg("head").children("script")
				.filter((i,el)=>pg(el).html().includes("WIKIREQUEST"))).html()
		    .replace(/WIKIREQUEST\.info\.pageId *?= *?(\d+);/g, (_, id)=>{
			page_id = id
		})
    return page_id;
  }

  async source(wiki_page) {
    let page_id = await this.getPageId(wiki_page);
  	let info = await this.module("viewsource/ViewSourceModule", {
  		page_id: page_id
  	})
  	return info.body
  }

  async edit(wiki_page, params) {
    var lock = await this.module('edit/PageEditModule', {
            mode: 'page',
            wiki_page: wiki_page,
            force_lock: true})
    return await this.action('WikiPageAction', Object.assign({
      event: 'savePage',
      wiki_page: wiki_page,
      lock_id: lock.lock_id,
      lock_secret: lock.lock_secret,
      revision_id: lock.page_revision_id||null,
    }, params))
  }

  async delete(wiki_page, params) {
    let page_id = await this.getPageId(wiki_page);
    return await this.action('WikiPageAction', Object.assign({
      event: 'deletePage',
      page_id: page_id,
    }, params))
  }

  async rename(wiki_page, new_name, params) {
    let page_id = await this.getPageId(wiki_page);
    return await this.action('WikiPageAction', Object.assign({
      event: 'renamePage',
      page_id: page_id,
      new_name: new_name,
    }, params))
  }
}
module.exports = WD;
