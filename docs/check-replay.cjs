const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const replay=require('../src/data/member3-replay.json');
async function run(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4175/admin/overview');
  await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  const results=[];
  for(const asOf of replay.availableAsOf){
   await page.locator('.filters select').first().selectOption(asOf);
   await page.waitForFunction(time=>document.querySelector('footer')?.innerText.includes(time.slice(0,10)),asOf);
   const result=await page.evaluate(async time=>{
    const {api}=await import('/src/api/index.ts');
    const stations=await api.getStations(time),overview=await api.getOverview(time),all=await api.getPrediction(24,time);
    const individual=await Promise.all(stations.map(s=>api.getPrediction(24,time,s.stationId)));
    const orders=await api.getOrders(time,24);
    const horizons=await Promise.all([1,6,24].map(h=>api.getPrediction(h,time,stations[0].stationId)));
    return {stations,overview,all,individual,orders,horizons};
   },asOf);
   assert.equal(result.all.forecastOrigin,asOf);
   assert.equal(result.all.points.length,24);
   assert.equal(result.overview.totalPiles,17);
   assert.equal(result.overview.installedCapacityKw,1004);
   for(let i=0;i<24;i++){
    assert.equal(result.all.points[i].predictedFreePiles,result.individual.reduce((a,p)=>a+p.points[i].predictedFreePiles,0));
    assert.ok(Math.abs(result.all.points[i].predictedLoadKw-result.individual.reduce((a,p)=>a+p.points[i].predictedLoadKw,0))<1e-8);
   }
   result.horizons.forEach((p,index)=>assert.equal(p.points.length,[1,6,24][index]));
   for(const p of result.individual){
    const delivered=replay.snapshots[asOf].bundles[p.stationId].prediction;
    assert.deepEqual(p.points.map(x=>x.predictedLoadKw),delivered.map(x=>x.predictedLoadKw));
    assert.deepEqual(p.points.map(x=>x.predictedFreePiles),delivered.map(x=>x.predictedFreePiles));
   }
   assert.equal(Object.values(result.orders.statuses).reduce((a,b)=>a+b,0),result.orders.total);
   await page.locator('.station-switcher>button').nth(1).click();
   assert.equal(await page.locator('.numbers strong').first().innerText(),'1');
   await page.locator('.station-switcher>button').first().click();
   results.push({asOf,stations:result.stations.length,points:result.all.points.length,orderCount:result.orders.total,totalPiles:result.overview.totalPiles,capacityKw:result.overview.installedCapacityKw,cityEqualsStationSum:true,unchangedPredictionValues:true});
  }
  await page.getByRole('button',{name:'模型评估',exact:true}).click();
  await page.getByText('2.048',{exact:false}).first().waitFor();
  assert.deepEqual(errors,[]);
  fs.writeFileSync('docs/replay-check-report.json',JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({results,errors}));
 }finally{await browser.close()}
}
run().catch(e=>{console.error(e);process.exit(1)});
