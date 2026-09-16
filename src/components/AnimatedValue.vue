<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
const props=defineProps<{value:string|number}>();const display=ref(String(props.value));let frame=0,current=Number(props.value)
watch(()=>props.value,value=>{
 cancelAnimationFrame(frame);const to=Number(value),from=Number.isFinite(current)?current:to
 if(!Number.isFinite(to) || document.visibilityState==='hidden' || window.matchMedia('(prefers-reduced-motion: reduce)').matches){display.value=String(value);current=to;return}
 const precision=String(value).includes('.')?String(value).split('.')[1].length:0,start=performance.now()
 const tick=(now:number)=>{const t=Math.min(1,(now-start)/420);current=from+(to-from)*(1-Math.pow(1-t,3));display.value=current.toFixed(precision);if(t<1)frame=requestAnimationFrame(tick)}
 frame=requestAnimationFrame(tick)
})
onBeforeUnmount(()=>cancelAnimationFrame(frame))
</script>
<template><span>{{display}}</span></template>
