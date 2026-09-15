// Build compact presentation aggregates; raw orders and user identifiers stay outside the web bundle.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../phase2-data-generator/output/beijing-development-seed-20260914');
const read = name => fs.readFileSync(path.join(root, name, 'part-00000.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
const orders = read('fact_order');
const events = new Map();
for (const e of read('fact_order_event')) { const list=events.get(e.order_id)||[];list.push(e);events.set(e.order_id,list); }
const times=['2023-04-04T12:00:00+08:00','2023-04-09T20:00:00+08:00','2023-04-30T23:00:00+08:00'];
const snapshots=[];
for(const asOf of times)for(const windowHours of [24,168]){
 const end=Date.parse(asOf),start=end-windowHours*3600000;
 const byStation={};
 for(const order of orders){
  if(Date.parse(order.created_at)<start || Date.parse(order.created_at)>=end)continue;
  const available=(events.get(order.order_id)||[]).filter(e=>Date.parse(e.event_time)<=end).sort((a,b)=>Date.parse(a.event_time)-Date.parse(b.event_time));
  const state=available.at(-1)?.event_type || 'created';
  const group=byStation[order.station_id] ||= {stationId:order.station_id,total:0,statuses:{},types:{}};
  group.total++;group.statuses[state]=(group.statuses[state]||0)+1;
  group.types[order.tariff_id]=(group.types[order.tariff_id]||0)+1;
 }
 snapshots.push({asOf,windowHours,stations:Object.values(byStation)});
}
fs.mkdirSync(path.resolve(__dirname,'../src/data'),{recursive:true});
fs.writeFileSync(path.resolve(__dirname,'../src/data/order-summaries.json'),JSON.stringify(snapshots));
console.log(`Prepared ${snapshots.length} order windows from ${orders.length} orders`);
