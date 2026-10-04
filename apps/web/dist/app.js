const state={view:'start',theme:'light',reviewed:0,demoScene:0,demo:false,evidence:[],selectedEvidence:null,loadingEvidence:false,roadmap:null,loadingRoadmap:false};
const qs=(selector,root=document)=>root.querySelector(selector);
const qsa=(selector,root=document)=>[...root.querySelectorAll(selector)];
const labels={start:'لم يبدأ جمع الأدلة بعد',plan:'الخطة جاهزة للمراجعة',evidence:'مراجعة المصادر والسياق',coverage:'الحقيبة جاهزة للمراجعة'};

function showView(view){
  state.view=view;
  qsa('.screen').forEach(el=>el.classList.toggle('active',el.dataset.screen===view));
  qsa('.nav-item').forEach((el,index)=>{const active=el.dataset.view===view;el.classList.toggle('active',active);el.classList.toggle('complete',index<['start','plan','evidence','coverage'].indexOf(view));});
  qs('#context-label').textContent=labels[view];
  qs('.sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
}
function toast(message){const el=qs('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2800)}
qsa('[data-view]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));
qsa('[data-example]').forEach(button=>button.addEventListener('click',()=>{qs('#topic').value=button.dataset.example;qs('#topic').focus()}));
qs('#research-form').addEventListener('submit',buildRoadmap);
qs('#approve-plan').addEventListener('click',async()=>{if(!state.roadmap||state.loadingEvidence)return;showView('evidence');await loadDemoEvidence()});
qs('#plan-list').addEventListener('click',event=>{const card=event.target.closest('.plan-card');if(!card)return;qsa('.plan-card').forEach(item=>item.classList.remove('selected'));card.classList.add('selected')});
function filterEvidence(type){
  qsa('.filter').forEach(button=>button.classList.toggle('active',button.dataset.filter===type));
  qsa('.source-item').forEach(button=>button.classList.toggle('active',button.dataset.sourceFilter===type));
  qsa('.evidence-card').forEach(card=>card.hidden=type!=='all'&&card.dataset.type!==type);
}
qsa('.filter').forEach(button=>button.addEventListener('click',()=>filterEvidence(button.dataset.filter)));
qs('#source-list').addEventListener('click',event=>{const button=event.target.closest('[data-source-filter]');if(button)filterEvidence(button.dataset.sourceFilter)});

async function api(path,body){
  const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||'تعذر إكمال الطلب');
  return data;
}
function escapeHtml(value){
  return String(value).replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}
const axisLabels={foundation:'المحور المؤسس',context:'محور السياق',application:'المحور التطبيقي',outcome:'محور الأثر'};
const sourceLabels={quran:'قرآن',hadith:'حديث',tafsir:'تفسير',sirah:'سيرة',approved_research:'دراسات معتمدة'};
function renderRoadmap(roadmap){
  const list=qs('#plan-list');
  list.innerHTML=roadmap.axes.map((axis,index)=>`<article class="plan-card${index===0?' selected':''}" data-axis-id="${escapeHtml(axis.axis_id)}"><span class="drag-handle" aria-hidden="true">⋮⋮</span><span class="plan-number">${String(index+1).padStart(2,'0')}</span><div><label>${escapeHtml(axisLabels[axis.role]||'محور بحث')}</label><h2>${escapeHtml(axis.title)}</h2><p>${escapeHtml(axis.research_question)}</p><div class="source-pills">${axis.evidence_requirements.map(source=>`<span>${escapeHtml(sourceLabels[source]||source)}</span>`).join('')}<span>${axis.time_minutes} د</span></div></div><button class="icon-button" type="button" aria-label="تفاصيل المحور" title="وظيفة المحور: ${escapeHtml(axis.purpose)}">i</button></article>`).join('');
  qs('#axis-count').textContent=roadmap.axes.length;
  qs('#summary-topic').textContent=roadmap.brief.topic;
  qs('#summary-audience').textContent=`${roadmap.brief.target_audience} · ${roadmap.brief.country_or_context}`;
  qs('#summary-format').textContent=`${roadmap.brief.format} · ${roadmap.brief.duration}`;
  const gateOpen=roadmap.policy_gate.decision!=='hold_for_verification';
  qs('#policy-note').innerHTML=`<b>بوابة التعليمات · ${gateOpen?'تصريح المستخدم مسجل':'تحتاج تحققًا'}</b>${escapeHtml(roadmap.policy_gate.note)}`;
  qs('#plan-status').textContent='بُنيت الخارطة بمنهجية مَظَانّ الحتمية؛ لم تُولد إحالات أو أحكام من ذاكرة نموذج. راجعها قبل جمع الأدلة.';
  qs('#approve-plan').disabled=!gateOpen;
  qs('#approve-plan').title=gateOpen?'اعتماد الخطة وبدء الاسترجاع':'ارجع إلى التكليف وسجل أنك تحققت من حالة التوجيه الرسمي';
}
async function buildRoadmap(event){
  event.preventDefault();
  if(state.loadingRoadmap)return;
  const button=qs('#build-roadmap');
  state.loadingRoadmap=true;button.disabled=true;button.textContent='جارٍ بناء الخارطة…';
  try{
    const roadmap=await api('/api/research/roadmap',{
      topic:qs('#topic').value,
      target_audience:qs('#audience').value,
      country_or_context:qs('#context').value,
      format:qs('#format').value,
      duration:qs('#duration').value,
      official_instruction_state:qs('#official-instruction').value,
      language:'ar'
    });
    state.roadmap=roadmap;renderRoadmap(roadmap);showView('plan');
  }catch(error){
    toast(error.message);qs('#topic').focus();
  }finally{
    state.loadingRoadmap=false;button.disabled=false;button.textContent='بناء خطة البحث';
  }
}
function evidenceTitle(item){
  if(item.record.content_type==='ayah')return `سورة النساء، الآية ${item.record.metadata.ayah}`;
  return item.record.metadata.title||`حديث رقم ${item.record.metadata.hadith_id}`;
}
function evidenceLocation(item){
  if(item.record.content_type==='ayah')return `النساء · ${item.record.metadata.ayah}`;
  return `HadeethEnc · ${item.record.metadata.hadith_id}`;
}
function updateEvidenceCounts(){
  const counts={all:state.evidence.length,quran:0,hadith:0};
  state.evidence.forEach(item=>counts[item.record.source_family]++);
  qsa('#evidence-filters [data-filter]').forEach(button=>{const count=counts[button.dataset.filter]||0;qs('span',button).textContent=count});
  qs('#evidence-count').textContent=state.evidence.length;
  state.reviewed=state.evidence.filter(item=>item.decision).length;
  qs('#reviewed-count').textContent=state.reviewed;
  qs('#source-rail h2').textContent=state.evidence.length===2?'موضعان موثقان':`${state.evidence.length} مواضع موثقة`;
  qs('#source-list').innerHTML=`<button class="source-item active" data-source-filter="all" type="button"><span class="source-glyph">✦</span><span><b>جميع المصادر</b><small>${state.evidence.length} سجل كامل · ${state.evidence.filter(item=>item.decision==='accepted').length} معتمد</small></span><i>${state.evidence.length}</i></button>${counts.quran?`<button class="source-item" data-source-filter="quran" type="button"><span class="source-glyph quran">ق</span><span><b>القرآن الكريم</b><small>QuranEnc · سجل كامل</small></span><i>${counts.quran}</i></button>`:''}${counts.hadith?`<button class="source-item" data-source-filter="hadith" type="button"><span class="source-glyph hadith">ح</span><span><b>موسوعة الأحاديث</b><small>HadeethEnc · حكم ظاهر</small></span><i>${counts.hadith}</i></button>`:''}`;
}
function renderEvidence(){
  const feed=qs('#evidence-feed');
  if(!state.evidence.length){feed.innerHTML='<div class="evidence-empty"><b>لم يصل سجل صالح</b><p>لم يعوض النظام النقص من ذاكرته. راجع حالة المصدر أو حاول لاحقًا.</p></div>';updateEvidenceCounts();return}
  feed.innerHTML=state.evidence.map(item=>{
    const record=item.record;const type=record.source_family;const mode=item.retrieval_mode==='live'?'اتصال حي':'نسخة مخزنة';const accepted=item.decision==='accepted'?' is-accepted':'';const selected=item.record.id===state.selectedEvidence?' selected':'';
    const body=record.content_type==='ayah'?`<blockquote>${record.text}</blockquote><p>${record.metadata.translation||'لا يوجد شرح منشور في السجل.'}</p>`:`<h2>${evidenceTitle(item)}</h2><p>المتن الكامل متاح في مفتش المصدر. الحكم المنشور: <b>${record.metadata.grade||'غير متاح'}</b>.</p>`;
    return `<article class="evidence-card${accepted}${selected}" data-type="${type}" data-record-id="${record.id}"><header><div><span class="type-badge ${type}">${type==='quran'?'قرآن':'حديث'}</span><span class="verified-badge">✓ سجل كامل · ${mode}</span></div></header>${body}<footer><span>${evidenceLocation(item)}</span><a href="${record.citation_url}" target="_blank" rel="noreferrer">فتح المصدر</a></footer></article>`;
  }).join('');
  updateEvidenceCounts();
  qsa('.evidence-card',feed).forEach(card=>card.addEventListener('click',event=>{if(event.target.closest('a'))return;selectEvidence(card.dataset.recordId)}));
}
function selectEvidence(id){
  state.selectedEvidence=id;const item=state.evidence.find(entry=>entry.record.id===id);if(!item)return;
  qsa('.evidence-card').forEach(card=>card.classList.toggle('selected',card.dataset.recordId===id));
  const panel=qs('#source-inspector');panel.classList.remove('is-refreshing');void panel.offsetWidth;panel.classList.add('is-refreshing');
  qs('h2',panel).textContent=evidenceTitle(item);qs('.original-text p',panel).textContent=item.record.text;qs('.verified-seal',panel).textContent='✓';
  const meta=qsa('.source-meta b',panel);meta[0].textContent=item.record.origin_platform;meta[1].textContent=evidenceLocation(item);meta[2].textContent=item.retrieval_mode==='live'?'حي من المصدر':'نسخة مخزنة موثقة';meta[2].classList.add('mint-text');
  qs('.relevance p',panel).textContent=item.record.content_type==='ayah'?`التفسير المنشور محفوظ منفصلًا عن نص الآية. البصمة: ${item.record.checksum_sha256.slice(0,12)}…`:`الحكم المنشور: ${item.record.metadata.grade||'غير متاح'}. الشرح محفوظ منفصلًا عن المتن. البصمة: ${item.record.checksum_sha256.slice(0,12)}…`;
  qs('#accept-evidence').disabled=false;qs('#reject-evidence').disabled=false;
}
async function loadDemoEvidence(){
  state.loadingEvidence=true;state.evidence=[];state.selectedEvidence=null;qs('#retrieval-status').textContent='جارٍ طلب السجلين الكاملين والتحقق من المرجع والبصمة…';qs('#evidence-feed').innerHTML='<div class="evidence-empty"><b>جارٍ الاتصال بالمصدر</b><p>لن يظهر مقتطف البحث بوصفه دليلًا.</p></div>';
  const requests=[api('/api/evidence/quran',{surah:4,ayah:58,language:'ar'}),api('/api/evidence/hadith',{id:'3016',language:'ar'})];
  const results=await Promise.allSettled(requests);state.evidence=results.filter(result=>result.status==='fulfilled').map(result=>({...result.value,decision:null}));
  const failures=results.filter(result=>result.status==='rejected');const cacheCount=state.evidence.filter(item=>item.retrieval_mode==='cache').length;
  qs('#retrieval-status').textContent=`وصل ${state.evidence.length} سجل كامل صالح${cacheCount?` · ${cacheCount} من النسخة المخزنة`:''}${failures.length?` · تعذر ${failures.length} ولم يُستبدل بمحتوى مولد`:''}.`;
  renderEvidence();if(state.evidence[0])selectEvidence(state.evidence[0].record.id);state.loadingEvidence=false;
}
qs('#accept-evidence').addEventListener('click',()=>{const item=state.evidence.find(entry=>entry.record.id===state.selectedEvidence);if(!item)return;item.decision='accepted';renderEvidence();selectEvidence(item.record.id);toast('أُضيف السجل الكامل إلى الحقيبة مع مرجعه وبصمته')});
qs('#reject-evidence').addEventListener('click',()=>{const item=state.evidence.find(entry=>entry.record.id===state.selectedEvidence);if(!item)return;item.decision='excluded';renderEvidence();selectEvidence(item.record.id);toast('استُبعد الدليل وبقي قرار الاستبعاد قابلًا للمراجعة')});
qs('#export-button').addEventListener('click',()=>toast('محاكاة فقط: التصدير الفعلي غير متصل في هذه النسخة'));
qs('#theme-toggle').addEventListener('click',()=>{state.theme=state.theme==='light'?'dark':'light';document.body.classList.toggle('dark',state.theme==='dark');qs('#theme-label').textContent=state.theme==='dark'?'داكن':'فاتح'});
qs('#mobile-menu').addEventListener('click',()=>qs('.sidebar').classList.toggle('open'));
qs('#prototype-info').addEventListener('click',()=>{qs('#info-modal').hidden=false;qs('.modal-close').focus()});
qsa('[data-close-modal]').forEach(el=>el.addEventListener('click',()=>{qs('#info-modal').hidden=true;qs('#prototype-info').focus()}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'){qs('#info-modal').hidden=true;qs('.sidebar').classList.remove('open')}});

const motionGroups={
  start:['.hero-copy','.identity-emblem','.research-brief','.scenario-strip button'],
  plan:['.section-heading > *','.plan-card','.plan-summary'],
  evidence:['.evidence-top > *','.filter-row','.evidence-card','.source-inspector','.source-rail'],
  coverage:['.section-heading > *','.coverage-map','.export-panel','.gap-card','.checklist']
};
Object.entries(motionGroups).forEach(([view,selectors])=>{
  const screen=qs(`[data-screen="${view}"]`);let index=0;
  selectors.forEach(selector=>qsa(selector,screen).forEach(element=>{element.classList.add('motion-item');element.style.setProperty('--mz-index',Math.min(index++,5))}));
});
requestAnimationFrame(()=>document.body.classList.add('motion-ready'));

const demoScenes=[
  {view:'start',title:'من السؤال إلى تكليف بحثي واضح'},
  {view:'plan',title:'خطة منهجية يعتمدها الباحث أولًا'},
  {view:'evidence',title:'النص الأصلي والمصدر والسياق في موضع واحد'},
  {view:'coverage',title:'حقيبة موثقة تُظهر القوة والفجوات'}
];
function renderDemoScene(){
  const scene=demoScenes[state.demoScene];
  qs('#topic').value='أثر الأمانة في بناء الثقة داخل المجتمع';
  qs('#summary-topic').textContent=qs('#topic').value;
  showView(scene.view);
  qs('#demo-scene-title').textContent=scene.title;
  qs('#demo-scene-count').textContent=`${state.demoScene+1} / ${demoScenes.length}`;
  qs('.demo-progress i').style.width=`${((state.demoScene+1)/demoScenes.length)*100}%`;
  qs('#demo-prev').disabled=state.demoScene===0;
  qs('#demo-next').disabled=state.demoScene===demoScenes.length-1;
}
function setDemoMode(enabled){
  state.demo=enabled;document.body.classList.toggle('demo-mode',enabled);
  qs('#demo-mode').classList.toggle('is-active',enabled);
  qs('#demo-controller').hidden=!enabled;
  if(enabled){state.demoScene=['start','plan','evidence','coverage'].indexOf(state.view);renderDemoScene()}
}
qs('#demo-mode').addEventListener('click',()=>setDemoMode(!state.demo));
qs('#demo-exit').addEventListener('click',()=>setDemoMode(false));
qs('#demo-next').addEventListener('click',()=>{if(state.demoScene<demoScenes.length-1){state.demoScene++;renderDemoScene()}});
qs('#demo-prev').addEventListener('click',()=>{if(state.demoScene>0){state.demoScene--;renderDemoScene()}});
document.addEventListener('keydown',event=>{if(!state.demo)return;if(event.key==='ArrowLeft'&&state.demoScene<demoScenes.length-1){state.demoScene++;renderDemoScene()}if(event.key==='ArrowRight'&&state.demoScene>0){state.demoScene--;renderDemoScene()}if(event.key==='Escape')setDemoMode(false)});

const topbar=qs('.topbar');
const syncTopbar=()=>topbar.classList.toggle('scrolled',window.scrollY>10);
window.addEventListener('scroll',syncTopbar,{passive:true});syncTopbar();

const requestedView=new URLSearchParams(window.location.search).get('view');
if(['start','plan','evidence','coverage'].includes(requestedView))showView(requestedView);
if(requestedView==='evidence'&&new URLSearchParams(window.location.search).get('demoEvidence')==='1')loadDemoEvidence();
