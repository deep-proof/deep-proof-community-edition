// Hand-authored metadata for offline catalog/UI tests; never an AI agent or model response.
import {createALACatalog} from '../../src/ala-catalog.mjs';
export const testCatalog=()=>createALACatalog(process.cwd(),{read:async agent=>agent?{models:agent==='codex'?[{id:'gpt-6-luna',label:'Luna'},{id:'test-codex-model',label:'Test Codex Model'}]:[{id:'test-claude-model',label:'Test Claude Model'}]}:{agents:[{id:'codex',label:'Codex',available:true},{id:'claude',label:'Claude',available:true},{id:'offline-agent',label:'Offline Agent',available:false}]}});
