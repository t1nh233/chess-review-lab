const path = require("node:path");
const fs = require("node:fs");
const { Chess } = require("chess.js");
const initEngine = require("stockfish");

const fixture = path.resolve("tests/fixtures/chesscom-low-rating-001.pgn");
const enginePath = path.resolve("node_modules/stockfish/bin/stockfish-18-lite-single.js");
const depth = Number(process.env.COMPATIBILITY_DEPTH || 12);
const references = new Map(Object.entries({
  "6...Be6":"Blunder", "7.Nxe6":"Great", "11.Bxe7":"Inaccuracy", "14.Rd1":"Inaccuracy", "14...Nd4":"Mistake", "15.e3":"Inaccuracy", "17.Ne7+":"Mistake", "19.cxd5":"Mistake", "19...Be5":"Inaccuracy", "21.g3":"Mistake", "21...Rhe8":"Inaccuracy", "22.Bg2":"Inaccuracy", "24.Bf3":"Blunder", "24...Rxe3+":"Great", "25...Ra3":"Inaccuracy", "26.Ra1":"Mistake", "28.Rhd1":"Mistake", "28...Bxa1":"Great", "30...Ree3":"Inaccuracy", "31...h5":"Inaccuracy", "32.Rd1":"Mistake", "35.h3":"Mistake", "43.Rxa5":"Inaccuracy", "53.Kg3":"Mistake",
}));
const originalLog = console.log; const listeners = new Set();
console.log = (...args) => { const line = args.map(String).join(" "); for (const listener of [...listeners]) listener(line); };
function waitFor(predicate, command) { return new Promise((resolve, reject) => { const listener = (line) => { if (!predicate(line)) return; clearTimeout(timer); listeners.delete(listener); resolve(line); }; const timer = setTimeout(() => { listeners.delete(listener); reject(new Error("Stockfish compatibility benchmark timed out.")); }, 180000); listeners.add(listener); command(); }); }
async function search(engine, fen, multiPv) {
  const byPv = new Map(); const collect = (line) => {
    if (!line.startsWith("info ") || !line.includes(" pv ")) return;
    const item = { depth:Number(/\bdepth (\d+)/.exec(line)?.[1]||0), multipv:Number(/\bmultipv (\d+)/.exec(line)?.[1]||1), cp:/\bscore cp (-?\d+)/.test(line)?Number(/\bscore cp (-?\d+)/.exec(line)[1]):undefined, mate:/\bscore mate (-?\d+)/.test(line)?Number(/\bscore mate (-?\d+)/.exec(line)[1]):undefined, moves:line.split(" pv ")[1].trim().split(/\s+/) };
    const prior=byPv.get(item.multipv); if (!prior || item.depth>=prior.depth) byPv.set(item.multipv,item);
  };
  listeners.add(collect);
  try { const best = await waitFor((line)=>line.startsWith("bestmove "),()=>{ engine.sendCommand(`setoption name MultiPV value ${multiPv}`); engine.sendCommand(`position fen ${fen}`); engine.sendCommand(`go depth ${depth}`); }); return { bestMove:best.split(/\s+/)[1], lines:[...byPv.values()].sort((a,b)=>a.multipv-b.multipv) }; }
  finally { listeners.delete(collect); }
}
function whiteCp(line, fen) { const raw=line.mate!==undefined?Math.sign(line.mate)*(100000-Math.min(Math.abs(line.mate),100)*100):(line.cp||0); return fen.split(" ")[1]==="b"?-raw:raw; }
function ep(cp, rating) { const scale=Math.max(180,Math.min(260,190+(1500-rating)*.035)); const logistic=1/(1+Math.exp(-cp/scale)); const low=Math.max(0,Math.min(1,(1500-rating)/1000)); const floor=Math.min(.02,.004+low*(.02-.004)); return Math.max(0,Math.min(1,floor+(1-2*floor)*logistic)); }
function classify(loss, best) { if (best) return "Best"; if(loss<=.02)return "Excellent"; if(loss<=.05)return "Good"; if(loss<=.10)return "Inaccuracy"; if(loss<=.20)return "Mistake"; return "Blunder"; }
function criticality(epBefore, uniqueness, loss) { const closeness=1-Math.min(1,Math.abs(epBefore-.5)*2); return Math.max(0,Math.min(1,.35*closeness+.4*Math.min(1,uniqueness/.25)+.25*Math.min(1,loss/.25))); }
function accuracy(loss, critical, context={}) { const adjusted=Math.max(0,loss)+(context.mateLoss?.12:0); const raw=Math.max(0,Math.min(100,100*Math.exp(-5.2*adjusted))); const criticalWeight=.45+(1.55-.45)*Math.max(0,Math.min(1,critical)); const relevance=1-.65*Math.max(0,Math.min(1,context.decidedness||0))*(1-Math.min(1,adjusted/.2)); const weight=Math.max(.12,criticalWeight*relevance*(context.forced?.25:1)); return {raw,weight}; }
function aggregate(items) { if(!items.length)return 0; const total=items.reduce((sum,item)=>sum+item.weight,0); const powered=items.reduce((sum,item)=>sum+Math.pow(100-Math.max(0,Math.min(100,item.raw)),1.6)*item.weight,0)/total; return Math.max(0,Math.min(100,100-Math.pow(powered,1/1.6))); }
function whiteMate(line,fen){if(line.mate===undefined)return undefined;return fen.split(" ")[1]==="b"?-line.mate:line.mate;}
function diagnostics(rows) { const labels=[...new Set(rows.map(row=>row.reference))].sort(); const confusion={}; const perClass={}; for(const label of labels){const selected=rows.filter(row=>row.reference===label); confusion[label]={}; for(const row of selected)confusion[label][row.prediction]=(confusion[label][row.prediction]||0)+1; const matched=selected.filter(row=>row.match).length;perClass[label]={matched,total:selected.length,agreement:Number((matched/selected.length*100).toFixed(1))};} return {confusionMatrix:confusion,perClassAgreement:perClass}; }

(async()=>{ let engine; try {
  const pgn=fs.readFileSync(fixture,"utf8"); const parsed=new Chess(); parsed.loadPgn(pgn,{strict:false}); const history=parsed.history({verbose:true}); const replay=new Chess(); const fens=[replay.fen()]; for(const move of history){replay.move({from:move.from,to:move.to,promotion:move.promotion});fens.push(replay.fen());}
  engine=await initEngine(enginePath); await waitFor((line)=>line==="uciok",()=>engine.sendCommand("uci")); engine.sendCommand("setoption name Hash value 64"); engine.sendCommand("ucinewgame"); await waitFor((line)=>line==="readyok",()=>engine.sendCommand("isready"));
  const results=[]; for(let i=0;i<fens.length-1;i++) results.push(await search(engine,fens[i],1)); results.push({bestMove:null,lines:[{mate:-1}]});
  const rows=[]; const scores={white:[],black:[]}; for(let i=0;i<history.length;i++){ const move=history[i]; const key=`${Math.floor(i/2)+1}${i%2?"...":"."}${move.san}`; const color=i%2?"black":"white"; const rating=color==="white"?Number(parsed.getHeaders().WhiteElo):Number(parsed.getHeaders().BlackElo); const beforeWhite=whiteCp(results[i].lines[0],fens[i]); const afterWhite=i===history.length-1?-99900:whiteCp(results[i+1].lines[0],fens[i+1]); const before=color==="white"?ep(beforeWhite,rating):1-ep(beforeWhite,rating); const after=color==="white"?ep(afterWhite,rating):1-ep(afterWhite,rating); const loss=Math.max(0,before-after); const played=`${move.from}${move.to}${move.promotion||""}`; let prediction=classify(loss,results[i].bestMove===played); let uniqueness=0;
    const legalMoveCount=new Chess(fens[i]).moves().length; if(prediction==="Best" && legalMoveCount>1){const expanded=await search(engine,fens[i],3); if(expanded.lines[1]){const secondWhite=whiteCp(expanded.lines[1],fens[i]);const second=color==="white"?ep(secondWhite,rating):1-ep(secondWhite,rating);uniqueness=Math.max(0,before-second);if(uniqueness>=.12)prediction="Great";}}
    const critical=criticality(before,uniqueness,loss); const beforeMate=whiteMate(results[i].lines[0],fens[i]); const afterMate=whiteMate(results[i+1].lines[0],fens[i+1]); const moverBeforeMate=color==="white"?beforeMate:beforeMate===undefined?undefined:-beforeMate; const moverAfterMate=color==="white"?afterMate:afterMate===undefined?undefined:-afterMate; const mateLoss=moverAfterMate!==undefined&&moverAfterMate<0&&(moverBeforeMate===undefined||moverBeforeMate>=0); const moveAccuracy=accuracy(loss,critical,{forced:legalMoveCount===1,decidedness:Math.abs(before-.5)*2,mateLoss}); scores[color].push(moveAccuracy);
    if(references.has(key))rows.push({move:key,reference:references.get(key),prediction,match:prediction===references.get(key),ratingUsed:rating,evalBeforeCp:beforeWhite,evalAfterCp:afterWhite,expectedPointsBefore:Number(before.toFixed(4)),expectedPointsAfter:Number(after.toFixed(4)),expectedPointsLoss:Number(loss.toFixed(4)),criticality:Number(critical.toFixed(4)),moveAccuracy:Number(moveAccuracy.raw.toFixed(1)),gameAccuracyWeight:Number(moveAccuracy.weight.toFixed(4)),mateState:{before:results[i].lines[0].mate??null,after:results[i+1].lines[0].mate??null},engineRank:results[i].bestMove===played?1:null});
  }
  const matched=rows.filter(r=>r.match).length; originalLog(JSON.stringify({fixture:path.basename(fixture),depth,ratingPolicy:"WhiteElo/BlackElo by mover",matched,total:rows.length,matchRate:Number((matched/rows.length*100).toFixed(1)),...diagnostics(rows),estimatedAccuracy:{white:Number(aggregate(scores.white).toFixed(1)),black:Number(aggregate(scores.black).toFixed(1))},rows},null,2));
} finally {if(engine?.sendCommand)engine.sendCommand("quit");console.log=originalLog;}})().catch((error)=>{console.log=originalLog;console.error(error);process.exitCode=1;});
