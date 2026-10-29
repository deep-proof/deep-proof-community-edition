// Classify private engine diagnostics; never return their raw text to report readers.
export function analysisFailure(message=''){
 let code='unexpected';
 // Engine stderr can quote source text, so the empty-response signal is matched only at the end of the diagnostic.
 if(/completed without a final (assistant )?(response|message)\.?\s*$/i.test(message))code='empty_response';
 else if(/restarted|interrupted|server restart/i.test(message))code='interrupted';
 else if(/15-minute|time limit|timed out|timeout/i.test(message))code='timeout';
 else if(/validat|missing\. Write|evidence footnote|quote must/i.test(message))code='validation';
 else if(/unauthorized|authentication|sign in|login|api.?key|credential|permission denied|forbidden|rate.?limit|quota|billing|429|401|403/i.test(message))code='access';
 else if(/ALA was not found|engine.*could not start|Could not start.*engine|ENOENT/i.test(message))code='engine';
 return {code,retryable:['interrupted','timeout','empty_response','unexpected'].includes(code),reportAvailable:false};
}
