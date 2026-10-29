// Time allowed for one run. The chosen limit is the TOTAL: the last part of it is reserved for a short
// wrap-up turn in which the agent writes down what it verified, so reaching the limit is a state with a result,
// never an error. Limits belong to the kind of run: checks offer a choice per run, analyses use the
// administrator's setting, skill generation keeps a fixed short limit.
const minutes=n=>n*60*1000;
export const CHECK_MINUTES=[10,15,20,35,60,90];
export const ANALYSIS_MINUTES=[30,60,90,120,240];
export const DEFAULT_ANALYSIS_MINUTES=60;
export const defaultCheckMinutes=depth=>depth==='triage'?15:35;
// A value outside the offered choices is rejected, so a request cannot set an arbitrary limit.
export function chooseMinutes(value,allowed,fallback){
 if(value===undefined||value===null||value==='')return fallback;
 const n=Number(value);if(!allowed.includes(n))throw Error('Choose one of the offered time limits.');return n;
}
// 15% of the limit, between 1 and 5 minutes, is kept for the write-up.
export const wrapUpMinutes=total=>Math.min(5,Math.max(1,Math.round(total*0.15)));
// DEEP_PROOF_WORK_MS and DEEP_PROOF_WRAPUP_MS (positive integers, milliseconds) override the limits, so the
// time-limit behaviour can be exercised in seconds instead of minutes.
const override=(env,name,fallback)=>{const value=Number(env[name]);return Number.isInteger(value)&&value>0?value:fallback;};
export function runLimits(kind,input={},env=process.env){
 if(kind!=='analysis')return {workMs:minutes(15),wrapUpMs:0};
 const total=Number(input.timeLimitMinutes)>0?Number(input.timeLimitMinutes):input.kind==='quality'?defaultCheckMinutes(input.qualityOptions?.depth):DEFAULT_ANALYSIS_MINUTES;
 const wrapUp=wrapUpMinutes(total);
 return {totalMinutes:total,workMs:override(env,'DEEP_PROOF_WORK_MS',minutes(total-wrapUp)),wrapUpMs:override(env,'DEEP_PROOF_WRAPUP_MS',minutes(wrapUp))};
}
