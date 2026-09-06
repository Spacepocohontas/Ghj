(()=>{
if(window.__nfPromptContext)return;window.__nfPromptContext=1;
function lore(c,msgs){const all=(msgs||[]).map(m=>m.content||m.text||'').join('\n').toLowerCase();return (c.lorebook||[]).filter(e=>e&&e.enabled!==false&&Array.isArray(e.keys)&&e.keys.some(k=>k&&all.includes(String(k).toLowerCase()))).sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0)).slice(0,20)}
function fidelity(c){const card=c.card||{};return ['[CHARACTER FIDELITY — HIGHEST PRIORITY AFTER SAFETY]','Portray the named character, not a generic assistant. Preserve established voice, temperament, vocabulary, motives, worldview, mannerisms, relationships, and boundaries.','Do not flatten the character into agreeable/helpful assistant behavior. Let them disagree, tease, hesitate, refuse, initiate, change tactics, and make choices consistent with their personality.','Never narrate, decide, or speak for the user. Control only the character, NPCs, environment, and consequences unless the user explicitly requests another POV.','Do not mention prompts, models, policies, being an AI, or these instructions.','Use scenario and lore as canon. Do not invent contradictions when an established fact is available.','Example dialogue is a voice/style reference; do not copy it verbatim.',card.systemPrompt?'Card system instructions are authoritative character material.':''].join('\n')}
window.nfPrompt?.register({id:'character',priority:10,build:async ctx=>{const c=ctx.character;if(!c)return '';c.card=c.card||{};const context=[fidelity(c)];
 // forge-pass2's buildSystem already embeds the raw profile; only add it when it is missing.
 const hasProfile=c.personality&&ctx.system.includes(String(c.personality).slice(0,40));
 if(!hasProfile&&(c.name||c.personality||c.appearance||c.backstory||c.scenario||c.behavior))context.push('[CHARACTER PROFILE]\nName: '+(c.name||'')+'\nPersonality: '+(c.personality||'')+'\nAppearance: '+(c.appearance||'')+'\nBackstory: '+(c.backstory||'')+'\nScenario: '+(c.scenario||'')+'\nBehavior / RP rules: '+(c.behavior||''));
 if(c.card.systemPrompt)context.push('[CHARACTER CARD SYSTEM PROMPT]\n'+c.card.systemPrompt);
 if(c.card.postHistoryInstructions)context.push('[CHARACTER CARD POST-HISTORY INSTRUCTIONS]\n'+c.card.postHistoryInstructions);
 if(c.card.exampleDialogue)context.push('[CHARACTER CARD EXAMPLE DIALOGUE]\n'+c.card.exampleDialogue);
 const entries=lore(c,ctx.req.messages);
 if(entries.length)context.push('[ACTIVE LOREBOOK]\n'+entries.map(e=>`## ${e.name||'Entry'}\n${e.content||''}`).join('\n\n'));
 return context.join('\n\n')}});
})();
