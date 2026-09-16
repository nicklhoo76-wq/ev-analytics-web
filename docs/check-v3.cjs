const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
async function run(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const out=path.join(__dirname,'screenshots');fs.mkdirSync(out,{recursive:true});
 const ready=()=>page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
 await page.goto('http://127.0.0.1:4175/admin/overview');await ready();
 assert.equal(await page.locator('.station-status-grid>button').count(),8);
 const chips=page.locator('.station-switcher>button');
 for(const index of [1,3,2,2])await chips.nth(index).click();
 assert.equal(await chips.nth(2).getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('main').getAttribute('aria-busy'),'false');
 assert.equal(await page.locator('main').evaluate(e=>getComputedStyle(e).opacity),'1');
 assert.equal(await page.locator('.numbers strong').first().innerText(),'1');
 await chips.first().click();assert.equal(await page.locator('.numbers strong').first().innerText(),'8');
 const total=Number(await page.locator('.order-ring strong').innerText());
 await page.getByRole('button',{name:'7天',exact:true}).click();
 assert.ok(Number(await page.locator('.order-ring strong').innerText())>=total);
 await page.locator('.order-panel').getByRole('button',{name:'24h',exact:true}).click();
 await page.getByRole('slider',{name:'负荷预警阈值'}).fill('10');
 const replayMode=await page.evaluate(async()=>{const {useDashboardStore}=await import('/src/stores/dashboard.ts');return useDashboardStore().dataMode==='replay'});
 if(replayMode)assert.equal(await page.locator('.load-alerts>button').count(),0);
 else assert.ok(await page.locator('.load-alerts>button').count()>0);
 assert.ok((await page.locator('.forecast-panel').innerText()).includes('预警阈值'));
 await page.screenshot({path:path.join(out,'v3-admin-1920.png'),fullPage:true});
 // A single heat cell must expose station and load, rather than an axis-wide tooltip.
 const heat=await page.locator('.heat-panel .base-chart').boundingBox();
 await page.mouse.move(heat.x+heat.width/2,heat.y+heat.height/2);await page.waitForTimeout(400);
 assert.ok((await page.locator('.heat-panel').innerText()).includes('平均负荷'));
 await page.screenshot({path:path.join(out,'v3-heat-tooltip.png'),fullPage:true});
 await page.mouse.move(0,0);
 await page.getByRole('link',{name:'充电时空 出行视角'}).click();
 assert.ok(!/负荷|kW/.test(await page.locator('body').innerText()));
 await page.getByRole('link',{name:'全域态势 运营视角'}).click();
 await page.getByRole('slider',{name:'负荷预警阈值'}).fill('80');
 const grouped=await page.evaluate(async()=>{
  const {buildAlerts}=await import('/src/lib/operations.ts');
  const station={stationId:'test',stationName:'test',installedCapacityKw:100};
  const points=[90,95,80,null,99].map((predictedLoadKw,i)=>({intervalStart:`2023-01-01T0${i}:00:00Z`,intervalEnd:`2023-01-01T0${i+1}:00:00Z`,predictedLoadKw}));
  return buildAlerts([station],{test:{points}},80);
 });
 assert.equal(grouped.length,2);assert.equal(grouped[0].peakKw,99);assert.equal(grouped[1].end,'2023-01-01T02:00:00Z');
 await page.route('**/api/v1/analytics/orders?*',route=>route.fulfill({json:{data:{as_of:'2023-04-09T20:00:00+08:00',window_hours:24,total:1,statuses:{refund_approved:1},types:{'BJS-TOU-VALLEY':1}}}}));
 const apiOrder=await page.evaluate(async()=>{const {httpGateway}=await import('/src/api/httpGateway.ts');return httpGateway.getOrders('2023-04-09T20:00:00+08:00',24)});
 assert.equal(apiOrder.statuses.refund_approved,1);assert.equal(apiOrder.windowHours,24);
 const expectedThreshold=await page.evaluate(async()=>{const {api}=await import('/src/api/index.ts');const {useDashboardStore}=await import('/src/stores/dashboard.ts');return ((await api.getOverview(useDashboardStore().state.asOf)).installedCapacityKw*.8).toFixed(1)});
 const reports=[];
 for(const role of ['admin','user']){
  await page.goto(`http://127.0.0.1:4175/${role}/overview`);await ready();
  assert.equal(await page.locator('.station-status-grid>button').count(),8);
  if(role==='user'){
   assert.ok(!/负荷|kW|充电位状态/.test(await page.locator('body').innerText()));
   const columns=page.locator('.window-columns>button');
   assert.equal(await columns.count(),24);
   await columns.nth(3).hover();
   assert.ok((await page.locator('.window-head').innerText()).includes('正在查看'));
   const label=await columns.nth(3).getAttribute('aria-label');
   assert.ok(label.includes((await page.locator('.window-value b').innerText())));
   await columns.nth(3).click();await page.mouse.move(0,0);
   assert.ok((await page.locator('.window-head').innerText()).includes('已固定时点'));
   await page.getByRole('button',{name:'恢复推荐',exact:true}).click();
  }
  for(const [width,height] of [[1920,1080],[1366,768],[430,932]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(450);
   const dimensions=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight}));
   assert.ok(dimensions.scrollWidth<=width,JSON.stringify(dimensions));
   const cards=await page.locator('.station-status-grid').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight}));
   assert.ok(cards.scroll<=cards.height+1,`Station cards clipped: ${role} ${width} ${JSON.stringify(cards)}`);
   if(role==='admin')assert.ok((await page.locator('.forecast-panel').innerText()).includes(`预警阈值 ${expectedThreshold} kW`));
   await page.screenshot({path:path.join(out,`v3-${role}-${width}.png`),fullPage:true});
   reports.push({role,...dimensions});
  }
 }
 await page.evaluate(async()=>{const {useDashboardStore}=await import('/src/stores/dashboard.ts');useDashboardStore().state.scenario='no-prediction'});
 await page.getByRole('button',{name:'刷新数据'}).click();await ready();
 await page.waitForFunction(()=>document.querySelectorAll('.window-columns>button').length===0);
 await page.evaluate(async()=>{const {useDashboardStore}=await import('/src/stores/dashboard.ts');useDashboardStore().state.scenario='normal'});
 await page.getByRole('button',{name:'刷新数据'}).click();await ready();
 assert.equal(await page.locator('.window-columns>button').count(),24);
 await page.evaluate(async()=>{const {useDashboardStore}=await import('/src/stores/dashboard.ts');useDashboardStore().state.scenario='error'});
 await page.getByRole('button',{name:'刷新数据'}).click();await ready();
 assert.equal(await page.getByRole('alert').count(),1);
 assert.equal(await page.locator('.station-status-grid>button').count(),8);
 await page.evaluate(async()=>{const {useDashboardStore}=await import('/src/stores/dashboard.ts');useDashboardStore().state.scenario='normal'});
 await page.getByRole('button',{name:'重试',exact:true}).click();await ready();
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(__dirname,'v3-check-report.json'),JSON.stringify({reports,errors,stationSwitch:true,orders:true,alerts:true,heatTooltip:true,chargingHover:true,missingPrediction:true},null,2));
 console.log(JSON.stringify({reports,errors}));
 }finally{await browser.close()}
}
run().catch(e=>{console.error(e);process.exit(1)});
