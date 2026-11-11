/* ===== Bộ tách câu hỏi trắc nghiệm từ tài liệu (bank parser) =====
   Đầu vào: các dòng "giàu" {t, bold, ul} từ TXT/dán nội dung, DOCX (mammoth HTML), PDF (pdf.js).
   Đầu ra: {questions:[{q, opts:[...], a}], } — a = -1 nếu chưa nhận diện được đáp án.
   Nhận diện đáp án theo thứ tự: dòng "Đáp án: X" → dấu ✔/✓/* /(đúng) ở phương án →
   phương án in đậm/nghiêng gạch chân duy nhất → bảng đáp án ở cuối tài liệu. */
function bpNorm(s){ return String(s||"").replace(/ /g," ").replace(/\s+/g," ").trim(); }
function bpRichFromText(text){
  return String(text||"").split(/\r?\n/).map(function(t){ return {t: bpNorm(t), bold:false, ul:false}; }).filter(function(l){ return l.t; });
}
function bpDecodeEntities(s){
  return String(s||"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&apos;/g,"'");
}
function bpStripTags(s){ return String(s||"").replace(/<(?:"[^"]*"|'[^']*'|[^>"'])*>/g, " "); }
function bpRichFromHtml(html){
  var h = String(html||"")
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|div|tr)>/gi, "\n")
    .replace(/<(p|li|h[1-6]|div|tr)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, "\n");
  return h.split("\n").map(function(raw){
    var boldText = "", ulText = "", imgs = [];
    raw.replace(/<(strong|b)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, function(m, g1, g2, inner){ boldText += bpDecodeEntities(bpStripTags(inner)); return m; });
    raw.replace(/<u(\s[^>]*)?>([\s\S]*?)<\/u>/gi, function(m, g1, inner){ ulText += bpDecodeEntities(bpStripTags(inner)); return m; });
    raw.replace(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, function(tag){
      var sm = tag.match(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      if(sm) imgs.push(bpDecodeEntities(sm[1] || sm[2] || ""));
      return tag;
    });
    var text = bpNorm(bpDecodeEntities(bpStripTags(raw)));
    if(!text && !imgs.length) return null;
    var line = { t: text, bold: text.length > 0 && boldText.replace(/\s+/g,"").length >= 0.6 * text.replace(/\s+/g,"").length && boldText.trim().length > 0,
             ul: text.length > 0 && ulText.replace(/\s+/g,"").length >= 0.6 * text.replace(/\s+/g,"").length && ulText.trim().length > 0 };
    if(imgs.length) line.imgs = imgs;
    return line;
  }).filter(Boolean);
}
function bpExtractJson(text){
  var s = String(text||"");
  function normQs(arr){ 
    if(!Array.isArray(arr)) return null;
    var out = [];
    for(var i=0;i<arr.length;i++){ var it = arr[i];
      if(it && typeof it.q === "string" && Array.isArray(it.opts) && typeof it.a === "number" && it.opts.length >= 2){
        var o = {q: it.q, opts: it.opts.map(String), a: it.a};
        if(Array.isArray(it.imgs) && it.imgs.length) o.imgs = it.imgs.map(String);
        if(Array.isArray(it.optImgs) && it.optImgs.some(function(x){ return Array.isArray(x) && x.length; })) o.optImgs = it.optImgs.map(function(x){ return Array.isArray(x) ? x.map(String) : undefined; });
        out.push(o);
      }
    }
    return out.length ? out : null;
  }
  try { var j = JSON.parse(s); var r = normQs(j) || (j && typeof j === "object" ? normQs([].concat.apply([], Object.keys(j).map(function(k){ return Array.isArray(j[k]) ? j[k] : []; }))) : null); if(r) return r; } catch(e){}
  var i = s.indexOf('"opts"');
  if(i >= 0){
    var start = s.lastIndexOf("{", s.lastIndexOf("[", i));
    var depth = 0, k = s.indexOf("{", s.indexOf("=", 0) >= 0 ? 0 : 0);
    var oi = s.search(/=\s*\{/);
    if(oi >= 0){ var j0 = s.indexOf("{", oi); depth = 0;
      for(k = j0; k < s.length; k++){ var c = s[k]; if(c === "{") depth++; else if(c === "}"){ depth--; if(depth === 0){ k++; break; } } }
      try { var obj = JSON.parse(s.slice(j0, k)); var rr = normQs([].concat.apply([], Object.keys(obj).map(function(key){ return Array.isArray(obj[key]) ? obj[key] : []; }))); if(rr) return rr; } catch(e){}
    }
  }
  return null;
}
function bpParse(lines){
  var LET = "ABCD";
  var keyMap = {}, inKey = false;
  var rawBlocks = [];
  var cur = null;
  function pushCur(){ if(cur){ rawBlocks.push(cur); cur = null; } }
  function optLetterIdx(ch){ return LET.indexOf(String(ch||"").toUpperCase()); }
  var qStartRe = /^câu\s*(\d{1,4})\s*[.:)]?\s*(.*)$/i;
  var numStartRe = /^(\d{1,4})\s*[.)]\s+(.*)$/;
  var ansLineRe = /^(?:đáp án|đáp án|answer|đ\/a)\s*[:.]?\s*([A-Da-d])\b/i;
  var ansAnyRe = /\(?\s*(?:đáp án|answer)\s*[:.]?\s*([A-Da-d])\s*\)?\s*$/i;
  var keyHeadRe = /^(?:đáp án|bảng đáp án|answer key|key)\s*[:.]?\s*$/i;

  function attachToQuestion(line){
    if(!line || !line.imgs || !line.imgs.length || !cur) return;
    for(var ai = 0; ai < line.imgs.length; ai++) cur.imgs.push(line.imgs[ai]);
  }
  function attachLineImgs(line){
    if(!line || !line.imgs || !line.imgs.length || !cur) return;
    if(cur.curOpt >= 0){
      var arr = cur.optImgs[cur.curOpt] || (cur.optImgs[cur.curOpt] = []);
      for(var ai = 0; ai < line.imgs.length; ai++) arr.push(line.imgs[ai]);
    } else attachToQuestion(line);
  }
  function startBlock(num, firstText, line){
    pushCur();
    cur = { num: num, qParts: [], opts: [], optBold: [], optUl: [], a: -1, curOpt: -1, imgs: [], optImgs: [] };
    if(firstText) cur.qParts.push(firstText);
    if(line && line.bold) cur.qBold = true;
  }
  function addOption(letterCh, text, line){
    var idx = optLetterIdx(letterCh);
    if(idx < 0) return false;
    if(idx !== cur.opts.length) return false; /* chỉ nhận đúng thứ tự A→B→C→D */
    cur.opts.push(bpNorm(text)); cur.optBold.push(!!(line && line.bold)); cur.optUl.push(!!(line && line.ul));
    cur.curOpt = idx;
    detectMarker(cur, idx);
    attachLineImgs(line);
    return true;
  }
  function detectMarker(block, idx){
    var t = block.opts[idx];
    if(/[✔✓✅]/.test(t) || /\(\s*đúng\s*\)\s*$/i.test(t) || /\*\s*$/.test(t)){
      block.a = idx;
      block.opts[idx] = bpNorm(t.replace(/[✔✓✅]/g,"").replace(/\(\s*đúng\s*\)\s*$/i,"").replace(/\*\s*$/,"").replace(/\s*đáp án\s*$/i,""));
    }
  }
  function feedText(text, line){
    if(!cur) return;
    if(cur.curOpt >= 0){ cur.opts[cur.curOpt] = bpNorm(cur.opts[cur.curOpt] + " " + text); detectMarker(cur, cur.curOpt); }
    else cur.qParts.push(text);
  }
  function splitInline(text){
    /* tách 1 dòng chứa nhiều phương án: "... A. ... B. ... C. ... D. ..." */
    var re = /(^|\s)[\(]?([A-Da-d])[.)]\s+/g, m, marks = [];
    while((m = re.exec(text)) !== null){ marks.push({at: m.index + m[1].length, letter: m[2].toUpperCase(), end: re.lastIndex}); }
    if(marks.length < 2) return null;
    var letters = marks.map(function(x){ return x.letter; }).join("");
    for(var li2 = 1; li2 < letters.length; li2++){ if(LET.indexOf(letters[li2]) !== LET.indexOf(letters[0]) + li2) return null; }
    var segs = [];
    var head = bpNorm(text.slice(0, marks[0].at));
    if(head) segs.push({kind:"text", text: head});
    for(var i2 = 0; i2 < marks.length; i2++){
      var from = marks[i2].end, to = (i2 + 1 < marks.length) ? marks[i2+1].at : text.length;
      segs.push({kind:"opt", letter: marks[i2].letter, text: bpNorm(text.slice(from, to))});
    }
    return segs;
  }
  function feedLine(line){
    var t = line.t;
    if(keyHeadRe.test(t)){ pushCur(); inKey = true; return; }
    if(inKey){
      var km, found = false;
      var re1 = /(\d{1,4})\s*[.:)]?\s*([A-Da-d])\b/g;
      while((km = re1.exec(t)) !== null){ keyMap[parseInt(km[1],10)] = optLetterIdx(km[2]); found = true; }
      if(!found){ var re2 = /(\d{1,4})([A-Da-d])\b/g; while((km = re2.exec(t)) !== null){ keyMap[parseInt(km[1],10)] = optLetterIdx(km[2]); found = true; } }
      if(found && !qStartRe.test(t)) return;
      if(qStartRe.test(t)) inKey = false; else if(found) return; else inKey = false;
    }
    if(/^(?:đáp án|answer)/i.test(t) && !ansLineRe.test(t)){
      var kt = t, km2, kfound = false;
      var kre1 = /(\d{1,4})\s*[.:)]?\s*([A-Da-d])\b/g;
      while((km2 = kre1.exec(kt)) !== null){ keyMap[parseInt(km2[1],10)] = optLetterIdx(km2[2]); kfound = true; }
      if(!kfound){ var kre2 = /(\d{1,4})([A-Da-d])\b/g; while((km2 = kre2.exec(kt)) !== null){ keyMap[parseInt(km2[1],10)] = optLetterIdx(km2[2]); kfound = true; } }
      if(kfound){ pushCur(); inKey = true; return; }
    }
    var am = t.match(ansLineRe);
    if(am && cur){ cur.a = optLetterIdx(am[1]); return; }
    var aa = t.match(ansAnyRe);
    if(aa && cur && cur.opts.length){ cur.a = optLetterIdx(aa[1]); t = bpNorm(t.replace(ansAnyRe, "")); if(!t) return; }
    var qm = t.match(qStartRe);
    if(qm){
      var rest = qm[2] || "";
      var segs = rest ? splitInline(rest) : null;
      var lineQ = (line && line.imgs) ? { t: line.t, bold: line.bold, ul: line.ul } : line;
      startBlock(parseInt(qm[1],10), segs ? "" : rest, lineQ);
      attachToQuestion(line);
      if(segs){ for(var si = 0; si < segs.length; si++){ if(segs[si].kind === "text") feedText(segs[si].text, lineQ); else addOption(segs[si].letter, segs[si].text, lineQ); } }
      return;
    }
    var nm = t.match(numStartRe);
    if(nm && (!cur || cur.opts.length >= 2)){
      var rest2 = nm[2] || "";
      var segs2 = splitInline(rest2);
      var lineN = (line && line.imgs) ? { t: line.t, bold: line.bold, ul: line.ul } : line;
      startBlock(parseInt(nm[1],10), segs2 ? "" : rest2, lineN);
      attachToQuestion(line);
      if(segs2){ for(var sj = 0; sj < segs2.length; sj++){ if(segs2[sj].kind === "text") feedText(segs2[sj].text, lineN); else addOption(segs2[sj].letter, segs2[sj].text, lineN); } }
      return;
    }
    var segsIn = splitInline(t);
    if(segsIn && cur){
      var nextIdx = cur.opts.length, good = true;
      for(var s3 = 0; s3 < segsIn.length; s3++){ if(segsIn[s3].kind === "opt"){ if(optLetterIdx(segsIn[s3].letter) !== nextIdx){ good = false; break; } nextIdx++; } }
      if(good){ for(var s4 = 0; s4 < segsIn.length; s4++){ if(segsIn[s4].kind === "text") feedText(segsIn[s4].text, line); else addOption(segsIn[s4].letter, segsIn[s4].text, line); } return; }
    }
    var om = t.match(/^\(?([A-Da-d])\s*[.)]\s*(.*)$/) || t.match(/^([A-Da-d])\s*:\s*(.*)$/);
    if(om && cur){ if(addOption(om[1], om[2], line)) return; }
    if(t) feedText(t, line);
    attachLineImgs(line);
  }
  for(var li = 0; li < lines.length; li++) feedLine(lines[li]);
  pushCur();

  var out = [];
  rawBlocks.forEach(function(b, bi){
    if(b.a < 0){
      var boldIdx = [], ulIdx = [];
      b.optBold.forEach(function(v, i2){ if(v) boldIdx.push(i2); });
      b.optUl.forEach(function(v, i2){ if(v) ulIdx.push(i2); });
      if(boldIdx.length === 1) b.a = boldIdx[0];
      else if(ulIdx.length === 1) b.a = ulIdx[0];
    }
    if(b.a < 0 && b.num && keyMap[b.num] !== undefined) b.a = keyMap[b.num];
    if(b.a < 0 && keyMap[bi + 1] !== undefined && !b.num) b.a = keyMap[bi + 1];
    var oq = { q: bpNorm(b.qParts.join(" ")) || (b.imgs && b.imgs.length ? "Câu hỏi có hình ảnh" : ""), opts: b.opts, a: b.a, num: b.num || (bi + 1) };
    if(b.imgs && b.imgs.length) oq.imgs = b.imgs;
    if(b.optImgs && b.optImgs.some(function(x){ return x && x.length; })) oq.optImgs = b.optImgs;
    out.push(oq);
  });
  return out.filter(function(x){ return x.q && x.opts.length >= 2; });
}
function bpParseText(text){
  var j = bpExtractJson(text);
  if(j) return j.map(function(x, i){ var o = {q: x.q, opts: x.opts, a: x.a, num: i + 1}; if(x.imgs) o.imgs = x.imgs; if(x.optImgs) o.optImgs = x.optImgs; return o; });
  if(/<(img|p|div|li|h[1-6]|table|span|strong|b)\b/i.test(String(text || ""))) return bpParse(bpRichFromHtml(text));
  return bpParse(bpRichFromText(text));
}

export { bpParse, bpParseText, bpRichFromText, bpRichFromHtml, bpExtractJson, bpNorm, bpStripTags };
