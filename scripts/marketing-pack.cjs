#!/usr/bin/env node
// Assemble existing PNG carousels into local, reviewable posting packs. No account credentials or uploads.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
function main(args) {
  const option = name => { const i=args.indexOf(name); return i < 0 ? null : args[i+1]; };
  if (!option('--source')) throw new Error('Usage: node scripts/marketing-pack.cjs --source <marketing-folder> [--out <folder>] [--deck <id>] [--videos]');
  const source = path.resolve(option('--source'));
  const out = path.resolve(option('--out') || path.join(source,'_exports'));
  if (source === out) throw new Error('Output must be a separate folder');
  const videos=args.includes('--videos');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const packs=[];
  for(const dir of fs.readdirSync(source,{withFileTypes:true}).filter(d=>d.isDirectory()&&!d.name.startsWith('_'))) {
    if(option('--deck') && dir.name!==option('--deck')) continue;
    const folder=path.join(source,dir.name);
    const images=fs.readdirSync(folder).filter(f=>/^\d{2}\.png$/i.test(f)).sort();
    if(!images.length)continue;
    for(let i=0;i<images.length;i++) {
      if(images[i]!==String(i+1).padStart(2,'0')+'.png')throw new Error(`Non-consecutive slides in ${dir.name}`);
      const png=fs.readFileSync(path.join(folder,images[i]));
      if(png.readUInt32BE(16)!==1080||png.readUInt32BE(20)!==1920)throw new Error(`Expected 1080x1920: ${dir.name}/${images[i]}`);
    }
    const rawCaption=fs.readFileSync(path.join(folder,'caption.txt'),'utf8');
    const caption=rawCaption.split(/\r?\n---\r?\n/)[0].trim();
    const hash=crypto.createHash('sha256').update(rawCaption);
    for(const img of images)hash.update(fs.readFileSync(path.join(folder,img)));
    const revision=hash.digest('hex').slice(0,12);
    const target=path.join(out,dir.name,revision);fs.mkdirSync(target,{recursive:true});
    for(const img of images)fs.copyFileSync(path.join(folder,img),path.join(target,img));
    fs.writeFileSync(path.join(target,'caption.txt'),caption+'\n');
    const video=path.join(target,'video.mp4');
    if(videos&&!fs.existsSync(video)) {
      const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-n','-framerate','1/4','-start_number','1','-i',path.join(target,'%02d.png'),
        '-vf','fps=30,format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','23','-movflags','+faststart','-an',video],{encoding:'utf8'});
      if(r.error||r.status!==0) { if(fs.existsSync(video))fs.unlinkSync(video); throw new Error(r.error?.message||r.stderr||'FFmpeg failed'); }
    }
    const relative=path.relative(out,target).split(path.sep).map(encodeURIComponent).join('/');
    packs.push({id:dir.name,revision,status:'copy-review-required',caption,slides:images.map(f=>`${relative}/${f}`),
      video:fs.existsSync(video)?`${relative}/video.mp4`:null,durationSeconds:images.length*4,source:folder});
    console.log(`${dir.name}: ${images.length} slides${fs.existsSync(video)?', video ready':''}`);
  }
  if(!packs.length)throw new Error('No matching slide decks found');
  const manifest={generatedAt:new Date().toISOString(),note:'Local drafts. Review factual claims, commercial disclosure, audio rights, and destination before scheduling.',packs};
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Crumb Control posting packs</title>
<style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:0 24px;background:#111;color:#eee}h1{font-size:32px}section{border-top:1px solid #555;padding:24px 0}p{max-width:70ch;line-height:1.6}a{color:#dfa567}.slides{display:flex;gap:12px;overflow:auto}img{width:162px;height:288px}textarea{width:100%;min-height:120px;background:#222;color:#eee;font:inherit;padding:12px;box-sizing:border-box}button{padding:12px;margin:12px 0;cursor:pointer}small{color:#ccc}</style>
<h1>Crumb Control posting packs</h1><p>${packs.length} decks. Existing slides are preserved. Videos are silent, four seconds per slide. Review copy before publishing; these packs have not been uploaded.</p>
${packs.map(p=>`<section><h2>${esc(p.id)}</h2><small>Copy review required ? ${p.slides.length} slides ? ${p.durationSeconds}s</small><p>${p.video?`<a href="${p.video}">Open MP4 video</a> ? `:''}<a href="${p.slides[0].replace('01.png','caption.txt')}">Clean caption</a></p><div class="slides">${p.slides.map((s,i)=>`<a href="${s}"><img src="${s}" alt="Slide ${i+1}" loading="lazy"></a>`).join('')}</div><p>Caption</p><textarea aria-label="${esc(p.id)} caption" readonly>${esc(p.caption)}</textarea><button>Copy caption</button></section>`).join('')}
<script>document.querySelectorAll('button').forEach(b=>b.onclick=async()=>{const t=b.previousElementSibling;try{await navigator.clipboard.writeText(t.value);b.textContent='Copied';}catch{t.select();b.textContent='Selected ? press Ctrl+C';}});</script>`);
  console.log(`Open ${path.join(out,'index.html')}`);
  return manifest;
}
module.exports={main};
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
