from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def add_rects(page):
    page.evaluate("""() => {
      const rr = (t,b) => ({top:t,left:200,width:1000,height:70,bottom:b,right:1200});
      const root=document.querySelector('[jsname=tgaKEf]');
      root.getBoundingClientRect=()=>({top:580,left:150,width:1100,height:210,bottom:790,right:1250});
      [...document.querySelectorAll('.row')].forEach((r,i)=>r.getBoundingClientRect=()=>rr(590+i*80,660+i*80));
      [...document.querySelectorAll('[jsname=r4nke]')].forEach((r,i)=>r.getBoundingClientRect=()=>rr(610+i*80,650+i*80));
    }""")

with sync_playwright() as p:
    b=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1400,'height':800})

    page.set_content('''<div jsname="tgaKEf">
      <div class="row"><span class="speaker">Interviewee A</span><span jsname="r4nke">お名前は何ですか？</span></div>
      <div class="row"><span class="speaker">You</span><span jsname="r4nke">あなたの名前は何ですか？</span></div>
    </div>''')
    page.add_script_tag(path=str(ROOT/'extension/src/caption-utils.js'))
    page.add_script_tag(path=str(ROOT/'extension/src/meet-caption-engine.js'))
    add_rects(page)
    rows=page.evaluate("extractCaptionRows(document,'google_meet','jp-live-translator-host').rows.map(r=>({speaker:r.speaker,isSelf:r.isSelf,text:r.text,bottom:r.bottom,method:r.method}))")
    assert rows[0]['speaker']=='Interviewee A' and rows[0]['isSelf'] is False
    assert rows[1]['speaker']=='You' and rows[1]['isSelf'] is True

    # Exact rolling-captions shape from the recording: historical rows should be available
    # to the engine, while the processor chooses only the newest row per speaker.
    page.set_content('''<div jsname="tgaKEf">
      <div class="row"><span class="speaker">Interviewee A</span><span jsname="r4nke">こんにちは。</span></div>
      <div class="row"><span class="speaker">You</span><span jsname="r4nke">私はサイェムです。</span></div>
      <div class="row"><span class="speaker">Interviewee A</span><span jsname="r4nke">こんにちは。今どこに住んでいますか？</span></div>
    </div>''')
    page.add_script_tag(path=str(ROOT/'extension/src/caption-utils.js'))
    page.add_script_tag(path=str(ROOT/'extension/src/meet-caption-engine.js'))
    add_rects(page)
    rows=page.evaluate("extractCaptionRows(document,'google_meet','jp-live-translator-host').rows")
    assert any(r['speaker']=='Interviewee A' for r in rows)
    assert any(r['speaker']=='You' and r['isSelf'] for r in rows)

    b.close()
print('caption-engine: 2/2 scenarios passed')
