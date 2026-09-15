const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
async function run(){
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 const page = await browser.newPage({viewport:{width:1920,height:1080}, reducedMotion:'reduce'});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const out=path.join(__dirname,'screenshots');fs.mkdirSync(out,{recursive:true});
 const report=[];
 for(const role of ['admin','user']){
  await page.goto(`http://127.0.0.1:4174/${role}/overview`);
  await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  await page.screenshot({path:path.join(out,`v2-${role}-1920.png`),fullPage:true});
  report.push({role,...await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,charts:document.querySelectorAll('.base-chart svg').length}))});
 }
 await page.getByRole('link',{name:'全域态势 运营视角'}).click();
 const select=page.locator('.filters select').nth(1);
 await select.selectOption('BJS-S0001');
 await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
 if(await page.locator('.numbers article').first().locator('strong').innerText()!=='1')throw new Error('Station filter failed');
  await select.selectOption('');
  await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
 await page.getByRole('button',{name:'查看全部站点'}).click();
 await page.getByRole('button',{name:'关闭站点详情'}).click();
 for(const width of [1366,430]){
  await page.setViewportSize({width,height:width===1366?768:932});
  await page.waitForTimeout(350);
  await page.screenshot({path:path.join(out,`v2-admin-${width}.png`),fullPage:true});
  const size=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  if(size.scrollWidth>size.width)throw new Error(`Overflow ${JSON.stringify(size)}`);
  report.push(size);
 }
 await page.setViewportSize({width:1920,height:1080});
 await page.getByRole('button',{name:'1h',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
 await page.getByRole('button',{name:'24h',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
 await page.evaluate(async()=>{ const {useDashboardStore}=await import('/src/stores/dashboard.ts');useDashboardStore().state.scenario='no-prediction' });
 await page.getByRole('button',{name:'刷新数据'}).click();
 await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
 await page.getByText('暂无该时段预测').waitFor();
 await page.evaluate(async()=>{ const {useDashboardStore}=await import('/src/stores/dashboard.ts');useDashboardStore().state.scenario='error' });
 await page.getByRole('button',{name:'刷新数据'}).click();
 await page.getByRole('alert').waitFor();
 await page.evaluate(async()=>{ const {useDashboardStore}=await import('/src/stores/dashboard.ts');useDashboardStore().state.scenario='normal' });
 await page.getByRole('button',{name:'重试',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
 if(errors.length)throw new Error(errors.join('\n'));
 fs.writeFileSync(path.join(__dirname,'visual-report.json'),JSON.stringify({report,errors,stationFilter:true,drawer:true},null,2));
 console.log(JSON.stringify({report,errors}));await browser.close();
}
run().catch(e=>{console.error(e);process.exit(1)});

