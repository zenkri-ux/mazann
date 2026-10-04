const state={view:'start',theme:'light',reviewed:0,demoScene:0,demo:false,evidence:[],selectedEvidence:null,loadingEvidence:false,roadmap:null,loadingRoadmap:false,projectId:null,savingProject:false,plannerProgressTimer:null,retrievalProgressTimer:null};
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
function syncInstructionFields(){
  const value=qs('input[name="instruction-state"]:checked').value;const supplied=value==='verified';
  qs('#instruction-fields').hidden=!supplied;
  qsa('#instruction-fields input,#instruction-fields textarea').forEach(field=>field.required=supplied);
  const labels={none_declared:'غير مستخدم — الموضوع من اختيارك',verified:'سيُراعى التعميم في الخطة',unverified:'سيظهر تذكير قبل الاعتماد'};qs('#instruction-summary').textContent=labels[value];
}
qsa('input[name="instruction-state"]').forEach(input=>input.addEventListener('change',syncInstructionFields));
syncInstructionFields();
qs('#research-form').addEventListener('submit',buildRoadmap);
qs('#approve-plan').addEventListener('click',async()=>{if(!state.roadmap||state.loadingEvidence)return;showView('evidence');await loadRoadmapEvidence()});
qs('#plan-list').addEventListener('click',event=>{
  const action=event.target.closest('[data-axis-action]');const card=event.target.closest('.plan-card');
  if(action&&card){handleAxisAction(action.dataset.axisAction,card.dataset.axisId);return}
  if(event.target.closest('#add-axis')){openAxisEditor();return}
  if(!card)return;qsa('.plan-card').forEach(item=>item.classList.remove('selected'));card.classList.add('selected');
});
function filterEvidence(type){
  qsa('.filter').forEach(button=>button.classList.toggle('active',button.dataset.filter===type));
  qsa('.source-item').forEach(button=>button.classList.toggle('active',button.dataset.referenceFilter==='all'));
  qsa('.evidence-card').forEach(card=>card.hidden=type!=='all'&&card.dataset.type!==type);
}
function filterReferenceEvidence(key){
  qsa('.filter').forEach(button=>button.classList.toggle('active',button.dataset.filter==='all'));
  qsa('.source-item').forEach(button=>button.classList.toggle('active',button.dataset.referenceFilter===key));
  qsa('.evidence-card').forEach(card=>card.hidden=key!=='all'&&card.dataset.referenceKey!==key);
}
qsa('.filter').forEach(button=>button.addEventListener('click',()=>filterEvidence(button.dataset.filter)));
qs('#source-list').addEventListener('click',event=>{const button=event.target.closest('[data-reference-filter]');if(button)filterReferenceEvidence(button.dataset.referenceFilter)});

async function api(path,body){
  const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||'تعذر إكمال الطلب');
  return data;
}
async function apiGet(path){
  const response=await fetch(path,{headers:{accept:'application/json'}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||'تعذر إكمال الطلب');
  return data;
}
function escapeHtml(value){
  return String(value).replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}
function safeExternalUrl(value){
  try{const url=new URL(value);return url.protocol==='https:'?url.href:'#'}catch{return '#'}
}
const axisLabels={foundation:'المحور المؤسس',context:'محور السياق',application:'المحور التطبيقي',outcome:'محور الأثر'};
const sourceLabels={quran:'قرآن',hadith:'حديث',tafsir:'تفسير',sirah:'سيرة',approved_research:'دراسات معتمدة'};
function renderRoadmap(roadmap){
  const list=qs('#plan-list');
  list.innerHTML=roadmap.axes.map((axis,index)=>`<article class="plan-card${index===0?' selected':''}" data-axis-id="${escapeHtml(axis.axis_id)}"><span class="plan-number">${String(index+1).padStart(2,'0')}</span><div><label>${escapeHtml(axisLabels[axis.role]||'محور بحث')}</label><h2>${escapeHtml(axis.title)}</h2><p>${escapeHtml(axis.research_question)}</p><div class="source-pills">${axis.evidence_requirements.map(source=>`<span>${escapeHtml(sourceLabels[source]||source)}</span>`).join('')}<span>${axis.time_minutes} د</span></div></div><div class="axis-actions" aria-label="إدارة المحور"><button data-axis-action="up" type="button" aria-label="نقل المحور للأعلى" ${index===0?'disabled':''}>↑</button><button data-axis-action="down" type="button" aria-label="نقل المحور للأسفل" ${index===roadmap.axes.length-1?'disabled':''}>↓</button><button class="axis-edit" data-axis-action="edit" type="button">تعديل</button><button class="axis-delete" data-axis-action="delete" type="button">حذف</button></div></article>`).join('')+`<button class="add-axis" id="add-axis" type="button" ${roadmap.axes.length>=6?'disabled':''}><span>＋</span> إضافة محور من عندي</button>`;
  qs('#axis-count').textContent=roadmap.axes.length;
  qs('#summary-topic').textContent=roadmap.brief.topic;
  qs('#summary-audience').textContent=`${roadmap.brief.target_audience} · ${roadmap.brief.country_or_context}`;
  qs('#summary-format').textContent=`${roadmap.brief.format} · ${roadmap.brief.duration}`;
  const instructionLabels={none_declared:'موضوع اختاره المستخدم',verified:'الخطة تراعي تعميمًا رسميًا',unverified:'حالة التعميم تحتاج تحققًا'};
  qs('#policy-note').innerHTML=`<b>${escapeHtml(instructionLabels[roadmap.policy_gate.official_instruction_state])}</b>${escapeHtml(roadmap.policy_gate.note)}`;
  qs('#plan-status').textContent=roadmap.generation_mode==='model_assisted'
    ?'حلل النموذج الموضوع والجمهور، ثم قُيدت مخرجاته بعقد مَظَانّ وبوابة المراجعة. لم يولد أدلة أو أحكامًا.'
    :roadmap.planner_status?.state==='fallback'
      ?'تعذر التخطيط بالنموذج، فاستُخدمت الخارطة المنهجية الآمنة. راجع المحاور قبل جمع الأدلة.'
      :'بُنيت الخارطة بمنهجية مَظَانّ الحتمية؛ لم تُولد إحالات أو أحكام من ذاكرة نموذج. راجعها قبل جمع الأدلة.';
  qs('#approve-plan').disabled=false;
  qs('#approve-plan').title='اعتماد الخطة وبدء الاسترجاع';
}
function openAxisEditor(axisId=null){
  const axis=axisId?state.roadmap.axes.find(item=>item.axis_id===axisId):null;const modal=qs('#axis-modal');
  qs('#axis-dialog-title').textContent=axis?'تعديل المحور':'إضافة محور جديد';qs('#axis-edit-id').value=axis?.axis_id||'';qs('#axis-title').value=axis?.title||'';qs('#axis-question').value=axis?.research_question||'';qs('#axis-purpose').value=axis?.purpose||'';qs('#axis-time').value=axis?.time_minutes||3;
  qsa('.axis-sources input').forEach(input=>input.checked=(axis?.evidence_requirements||['quran','hadith']).includes(input.value));modal.hidden=false;qs('#axis-title').focus();
}
function handleAxisAction(action,axisId){
  const index=state.roadmap.axes.findIndex(axis=>axis.axis_id===axisId);if(index<0)return;
  if(action==='edit'){openAxisEditor(axisId);return}
  if(action==='delete'){if(state.roadmap.axes.length<=1){toast('يجب أن تبقي محورًا واحدًا على الأقل');return}state.roadmap.axes.splice(index,1);renderRoadmap(state.roadmap);toast('حُذف المحور من المسودة');return}
  const target=action==='up'?index-1:index+1;if(target<0||target>=state.roadmap.axes.length)return;[state.roadmap.axes[index],state.roadmap.axes[target]]=[state.roadmap.axes[target],state.roadmap.axes[index]];renderRoadmap(state.roadmap);toast('تغير ترتيب المحاور');
}
qs('#axis-form').addEventListener('submit',event=>{
  event.preventDefault();const requirements=qsa('.axis-sources input:checked').map(input=>input.value);if(!requirements.length){toast('اختر نوع دليل واحدًا على الأقل');return}
  const id=qs('#axis-edit-id').value;const existing=id?state.roadmap.axes.find(axis=>axis.axis_id===id):null;const axis={...(existing||{}),axis_id:id||`custom_${Date.now()}`,role:existing?.role||'application',title:qs('#axis-title').value.trim(),research_question:qs('#axis-question').value.trim(),purpose:qs('#axis-purpose').value.trim(),rationale:existing?.rationale||'محور أضافه الباحث ويحتاج مراجعته قبل الاسترجاع.',evidence_requirements:requirements,time_minutes:Number(qs('#axis-time').value)};
  if(existing)Object.assign(existing,axis);else state.roadmap.axes.push(axis);qs('#axis-modal').hidden=true;renderRoadmap(state.roadmap);toast(existing?'حُفظ تعديل المحور':'أُضيف المحور إلى خطة البحث');
});
async function buildRoadmap(event){
  event.preventDefault();
  if(state.loadingRoadmap)return;
  const button=qs('#build-roadmap');
  state.loadingRoadmap=true;button.disabled=true;button.textContent='يبني الخطة الآن…';startPlannerProgress();
  try{
    const roadmap=await api('/api/research/roadmap',currentBrief());
    state.roadmap=roadmap;renderRoadmap(roadmap);showView('plan');
  }catch(error){
    toast(error.message);qs('#topic').focus();
  }finally{
    state.loadingRoadmap=false;button.disabled=false;button.textContent='بناء خطة البحث';stopPlannerProgress();
  }
}
function startPlannerProgress(){
  const panel=qs('#planner-progress');const titles=['يفهم الموضوع والجمهور والسياق…','يصوغ محاور مختلفة وأسئلة قابلة للبحث…','يفحص التكرار والحدود ومتطلبات الأدلة…'];let index=0;panel.hidden=false;qsa('li',panel).forEach((item,i)=>item.classList.toggle('active',i===0));qs('#planner-progress-title').textContent=titles[0];
  clearInterval(state.plannerProgressTimer);state.plannerProgressTimer=setInterval(()=>{index=Math.min(index+1,titles.length-1);qs('#planner-progress-title').textContent=titles[index];qsa('li',panel).forEach((item,i)=>item.classList.toggle('active',i===index))},4200);
}
function stopPlannerProgress(){clearInterval(state.plannerProgressTimer);state.plannerProgressTimer=null;qs('#planner-progress').hidden=true}
function currentBrief(){
  const instructionState=qs('input[name="instruction-state"]:checked').value;
  const contextPreset=qs('#context').value;const contextDetail=qs('#context-detail').value.trim();
  return {
    topic:qs('#topic').value,
    target_audience:qs('#audience').value,
    country_or_context:contextDetail?`${contextPreset} — ${contextDetail}`:contextPreset,
    context_preset:contextPreset,
    context_detail:contextDetail,
    format:qs('#format').value,
    duration:qs('#duration').value,
    official_instruction_state:instructionState,
    governing_instruction:instructionState==='verified'?{
      issuing_authority:qs('#instruction-authority').value,
      title:qs('#instruction-title').value,
      reference:qs('#instruction-reference').value,
      required_points:qs('#instruction-points').value
    }:undefined,
    language:'ar'
  };
}
function restoreBrief(brief={}){
  if(brief.topic)qs('#topic').value=brief.topic;
  if(brief.target_audience)qs('#audience').value=brief.target_audience;
  const storedContext=brief.country_or_context||'';const knownContext=[...qs('#context').options].some(option=>option.value===storedContext);const contextPreset=brief.context_preset||(knownContext?storedContext:'سياق آخر أو غير محدد');qs('#context').value=contextPreset;
  qs('#context-detail').value=brief.context_detail||(!brief.context_preset&&!knownContext?storedContext:'');
  if(brief.format)qs('#format').value=brief.format;
  if(brief.duration)qs('#duration').value=brief.duration;
  const instructionState=brief.official_instruction_state||'none_declared';
  const radio=qs(`input[name="instruction-state"][value="${instructionState}"]`);if(radio)radio.checked=true;
  const instruction=brief.governing_instruction||{};
  qs('#instruction-authority').value=instruction.issuing_authority||'';
  qs('#instruction-title').value=instruction.title||'';
  qs('#instruction-reference').value=instruction.reference||'';
  qs('#instruction-points').value=Array.isArray(instruction.required_points)?instruction.required_points.join('\n'):(instruction.required_points||'');
  syncInstructionFields();
}
function evidenceTitle(item){
  if(item.record.content_type==='ayah')return `سورة النساء، الآية ${item.record.metadata.ayah}`;
  return item.record.metadata.title||`حديث رقم ${item.record.metadata.hadith_id}`;
}
function evidenceLocation(item){
  return item.record.reference?.locator_ar||(item.record.content_type==='ayah'?`السورة ${item.record.metadata.surah}، الآية ${item.record.metadata.ayah}`:`سجل الحديث ${item.record.metadata.hadith_id}`);
}
function referenceLabel(item){return item.record.reference?.source_label_ar||'مرجع يحتاج استكمالًا'}
function referenceKey(item){return item.record.reference?.key||`unknown:${item.record.id}`}
function updateEvidenceCounts(){
  const counts={all:state.evidence.length,quran:0,hadith:0};
  state.evidence.forEach(item=>counts[item.record.source_family]++);
  qsa('#evidence-filters [data-filter]').forEach(button=>{const count=counts[button.dataset.filter]||0;qs('span',button).textContent=count});
  qs('#evidence-count').textContent=state.evidence.length;
  state.reviewed=state.evidence.filter(item=>item.decision).length;
  qs('#reviewed-count').textContent=state.reviewed;
  qs('#source-rail h2').textContent=state.evidence.length===2?'موضعان موثقان':`${state.evidence.length} مواضع موثقة`;
  const groups=new Map();state.evidence.forEach(item=>{const key=referenceKey(item);const group=groups.get(key)||{key,label:referenceLabel(item),family:item.record.source_family,count:0,precise:true};group.count++;group.precise=group.precise&&Boolean(item.record.reference?.primary_locator_available);groups.set(key,group)});
  const sources=[...groups.values()].map(group=>`<button class="source-item" data-reference-filter="${escapeHtml(group.key)}" type="button"><span class="source-glyph ${escapeHtml(group.family)}">${group.family==='quran'?'ق':'ح'}</span><span><b>${escapeHtml(group.label)}</b><small>${group.precise?'موضع أصلي محدد':'اسم المصدر متاح · الموضع يحتاج استكمالًا'}</small></span><i>${group.count}</i></button>`).join('');
  qs('#source-list').innerHTML=`<button class="source-item active" data-reference-filter="all" type="button"><span class="source-glyph">✦</span><span><b>جميع المراجع</b><small>${state.evidence.length} سجل كامل · ${state.evidence.filter(item=>item.decision==='accepted').length} معتمد</small></span><i>${state.evidence.length}</i></button>${sources}`;
}
function renderEvidence(){
  const feed=qs('#evidence-feed');
  if(!state.evidence.length){feed.innerHTML='<div class="evidence-empty"><b>لم يصل سجل صالح</b><p>لم يعوض النظام النقص من ذاكرته. راجع حالة المصدر أو حاول لاحقًا.</p></div>';updateEvidenceCounts();return}
  feed.innerHTML=state.evidence.map(item=>{
    const record=item.record;const type=record.source_family;const mode=item.retrieval_mode==='live'?'اتصال حي':'نسخة مخزنة';const accepted=item.decision==='accepted'?' is-accepted':'';const warning=record.reference?.primary_locator_available===false?' warning':'';const selected=item.record.id===state.selectedEvidence?' selected':'';
    const body=record.content_type==='ayah'?`<blockquote>${escapeHtml(record.text)}</blockquote><p>${escapeHtml(record.metadata.translation||'لا يوجد شرح منشور في السجل.')}</p>`:`<h2>${escapeHtml(evidenceTitle(item))}</h2><p>المتن الكامل متاح في مفتش المرجع. الحكم المنشور: <b>${escapeHtml(record.metadata.grade||'غير متاح')}</b>.</p>`;
    const locatorBadge=record.reference?.primary_locator_available===false?'<span class="review-badge">موضع الكتاب يحتاج استكمالًا</span>':'';
    return `<article class="evidence-card${accepted}${warning}${selected}" data-type="${escapeHtml(type)}" data-reference-key="${escapeHtml(referenceKey(item))}" data-record-id="${escapeHtml(record.id)}"><header><div><span class="type-badge ${escapeHtml(type)}">${escapeHtml(referenceLabel(item))}</span><span class="verified-badge">✓ سجل كامل · ${mode}</span>${locatorBadge}</div></header>${body}<footer><span>${escapeHtml(evidenceLocation(item))}</span><a href="${escapeHtml(safeExternalUrl(record.citation_url))}" target="_blank" rel="noreferrer">فتح سجل الإتاحة</a></footer></article>`;
  }).join('');
  updateEvidenceCounts();
  qsa('.evidence-card',feed).forEach(card=>card.addEventListener('click',event=>{if(event.target.closest('a'))return;selectEvidence(card.dataset.recordId)}));
}
function selectEvidence(id){
  state.selectedEvidence=id;const item=state.evidence.find(entry=>entry.record.id===id);if(!item)return;
  qsa('.evidence-card').forEach(card=>card.classList.toggle('selected',card.dataset.recordId===id));
  const panel=qs('#source-inspector');panel.classList.remove('is-refreshing');void panel.offsetWidth;panel.classList.add('is-refreshing');
  qs('h2',panel).textContent=evidenceTitle(item);qs('.original-text p',panel).textContent=item.record.text;qs('.verified-seal',panel).textContent='✓';
  const meta=qsa('.source-meta b',panel);meta[0].textContent=referenceLabel(item);meta[1].textContent=evidenceLocation(item);meta[2].textContent=item.record.access?.provider_name||item.record.origin_platform;meta[3].textContent=item.retrieval_mode==='live'?'حي من منصة الإتاحة':'نسخة مخزنة موثقة';meta[3].classList.add('mint-text');
  const referenceNote=item.record.reference?.verification_note_ar;qs('.relevance p',panel).textContent=referenceNote|| (item.record.content_type==='ayah'?`موضع الآية محدد، والتفسير المنشور محفوظ منفصلًا عن نصها. البصمة: ${item.record.checksum_sha256.slice(0,12)}…`:`الحكم المنشور: ${item.record.metadata.grade||'غير متاح'}. الشرح محفوظ منفصلًا عن المتن. البصمة: ${item.record.checksum_sha256.slice(0,12)}…`);
  qs('#accept-evidence').disabled=false;qs('#accept-evidence').textContent=item.record.reference?.primary_locator_available===false?'✓ اعتماد مبدئي — استكمال الموضع':'✓ اعتماد في الحقيبة';qs('#reject-evidence').disabled=false;
}
async function loadRoadmapEvidence(){
  state.loadingEvidence=true;state.evidence=[];state.selectedEvidence=null;
  qs('#retrieval-status').textContent='جارٍ البحث وفق أسئلة المحاور؛ لن يعتمد أي مقتطف قبل جلب السجل الكامل…';
  startRetrievalProgress();
  qs('#evidence-feed').innerHTML='<div class="evidence-empty"><b>جارٍ البحث في المصادر المعتمدة</b><p>تُدمج النتائج المتكررة، ثم يُجلب الأصل الكامل ويُتحقق من مرجعه.</p></div>';
  try{
    const result=await api('/api/research/evidence',{roadmap:state.roadmap,max_records:6});
    state.evidence=result.records.map(item=>({...item,decision:null}));
    const cacheCount=state.evidence.filter(item=>item.retrieval_mode==='cache').length;
    const failedCount=result.unresolved.length+result.search_failures.length;
    qs('#retrieval-status').textContent=`اعتمد ${state.evidence.length} سجل كامل${cacheCount?` · ${cacheCount} من النسخة المخزنة`:''}${failedCount?` · ${failedCount} نتيجة أو مسار تعذر ولم يتحول إلى دليل`:''}.`;
    renderEvidence();if(state.evidence[0])selectEvidence(state.evidence[0].record.id);
  }catch(error){
    state.evidence=[];renderEvidence();qs('#retrieval-status').textContent=`تعذر إكمال الاسترجاع: ${error.message}`;
  }finally{
    state.loadingEvidence=false;stopRetrievalProgress();
  }
}
function startRetrievalProgress(){
  const panel=qs('#retrieval-progress');const axes=state.roadmap?.axes||[];let index=0;panel.hidden=false;
  const update=()=>{const axis=axes[index%Math.max(axes.length,1)];qs('#retrieval-axis-title').textContent=axis?`نبحث عن أنسب الأدلة لمحور «${axis.title}»`:'نجهّز أسئلة البحث…';qs('#retrieval-axis-count').textContent=axes.length?`${index%axes.length+1} / ${axes.length}`:'0 / 0';index++};
  update();clearInterval(state.retrievalProgressTimer);state.retrievalProgressTimer=setInterval(update,2200);
}
function stopRetrievalProgress(){clearInterval(state.retrievalProgressTimer);state.retrievalProgressTimer=null;qs('#retrieval-progress').hidden=true}
async function loadDemoEvidence(){
  state.loadingEvidence=true;state.evidence=[];state.selectedEvidence=null;qs('#retrieval-status').textContent='جارٍ طلب السجلين الكاملين والتحقق من المرجع والبصمة…';qs('#evidence-feed').innerHTML='<div class="evidence-empty"><b>جارٍ الاتصال بالمصدر</b><p>لن يظهر مقتطف البحث بوصفه دليلًا.</p></div>';
  const requests=[api('/api/evidence/quran',{surah:4,ayah:58,language:'ar'}),api('/api/evidence/hadith',{id:'3016',language:'ar'})];
  const results=await Promise.allSettled(requests);state.evidence=results.filter(result=>result.status==='fulfilled').map(result=>({...result.value,decision:null}));
  const failures=results.filter(result=>result.status==='rejected');const cacheCount=state.evidence.filter(item=>item.retrieval_mode==='cache').length;
  qs('#retrieval-status').textContent=`وصل ${state.evidence.length} سجل كامل صالح${cacheCount?` · ${cacheCount} من النسخة المخزنة`:''}${failures.length?` · تعذر ${failures.length} ولم يُستبدل بمحتوى مولد`:''}.`;
  renderEvidence();if(state.evidence[0])selectEvidence(state.evidence[0].record.id);state.loadingEvidence=false;
}
qs('#accept-evidence').addEventListener('click',()=>{const item=state.evidence.find(entry=>entry.record.id===state.selectedEvidence);if(!item)return;const complete=item.record.reference?.primary_locator_available!==false;item.decision=complete?'accepted':'needs_reference';renderEvidence();selectEvidence(item.record.id);toast(complete?'أُضيف السجل الكامل إلى الحقيبة مع مرجعه وبصمته':'حُفظ مبدئيًا، ولن يعد مرجعًا نهائيًا حتى يستكمل موضعه في الكتاب')});
qs('#reject-evidence').addEventListener('click',()=>{const item=state.evidence.find(entry=>entry.record.id===state.selectedEvidence);if(!item)return;item.decision='excluded';renderEvidence();selectEvidence(item.record.id);toast('استُبعد الدليل وبقي قرار الاستبعاد قابلًا للمراجعة')});
qs('#export-button').addEventListener('click',()=>toast('محاكاة فقط: التصدير الفعلي غير متصل في هذه النسخة'));
qs('#theme-toggle').addEventListener('click',()=>{state.theme=state.theme==='light'?'dark':'light';document.body.classList.toggle('dark',state.theme==='dark');qs('#theme-label').textContent=state.theme==='dark'?'داكن':'فاتح'});
qs('#mobile-menu').addEventListener('click',()=>qs('.sidebar').classList.toggle('open'));
qs('#prototype-info').addEventListener('click',()=>{qs('#info-modal').hidden=false;qs('.modal-close').focus()});
qsa('[data-close-modal]').forEach(el=>el.addEventListener('click',()=>{const modal=qs(`#${el.dataset.closeModal}`);if(modal)modal.hidden=true}));
async function saveProject(){
  if(state.savingProject)return;
  const brief=currentBrief();
  if(brief.topic.trim().length<3){toast('اكتب موضوع البحث قبل الحفظ');qs('#topic').focus();return}
  state.savingProject=true;const button=qs('#save-project');button.disabled=true;button.textContent='جارٍ الحفظ…';
  try{
    const project=await api('/api/projects',{
      project_id:state.projectId,
      title:brief.topic.trim(),
      current_view:state.view,
      brief,
      roadmap:state.roadmap,
      evidence:state.evidence
    });
    state.projectId=project.project_id;qs('#project-title').textContent=project.title;button.textContent='حفظ التغييرات';toast('حُفظ البحث ويمكن استكماله لاحقًا');
  }catch(error){toast(error.message);button.textContent=state.projectId?'حفظ التغييرات':'حفظ البحث'}
  finally{state.savingProject=false;button.disabled=false}
}
async function showSavedProjects(){
  const modal=qs('#projects-modal');const list=qs('#projects-list');modal.hidden=false;list.innerHTML='<div class="project-empty">جارٍ تحميل الأبحاث…</div>';
  try{
    const result=await apiGet('/api/projects');
    list.innerHTML=result.projects.length?result.projects.map(project=>`<button class="project-row" type="button" data-project-id="${escapeHtml(project.project_id)}"><span><b>${escapeHtml(project.title)}</b><small>${project.axis_count} محاور · ${project.evidence_count} أدلة · ${project.accepted_count} معتمدة</small></span><span>متابعة ←</span></button>`).join(''):'<div class="project-empty">لا توجد أبحاث محفوظة بعد.</div>';
  }catch(error){list.innerHTML=`<div class="project-empty">${escapeHtml(error.message)}</div>`}
}
async function openProject(projectId){
  try{
    const project=await apiGet(`/api/projects/${encodeURIComponent(projectId)}`);
    state.projectId=project.project_id;state.roadmap=project.roadmap;state.evidence=project.evidence||[];state.selectedEvidence=state.evidence[0]?.record?.id||null;
    restoreBrief(project.brief);if(state.roadmap)renderRoadmap(state.roadmap);renderEvidence();if(state.selectedEvidence)selectEvidence(state.selectedEvidence);
    qs('#project-title').textContent=project.title;qs('#save-project').textContent='حفظ التغييرات';qs('#projects-modal').hidden=true;
    const safeView=['start','plan','evidence','coverage'].includes(project.current_view)?project.current_view:'start';showView(safeView);toast('فُتح البحث من آخر حالة محفوظة');
  }catch(error){toast(error.message)}
}
qs('#save-project').addEventListener('click',saveProject);
qs('#saved-projects').addEventListener('click',showSavedProjects);
qs('#projects-list').addEventListener('click',event=>{const button=event.target.closest('[data-project-id]');if(button)openProject(button.dataset.projectId)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){qsa('.modal').forEach(modal=>modal.hidden=true);qs('.sidebar').classList.remove('open')}});

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
const urlParams=new URLSearchParams(window.location.search);
if(requestedView==='evidence'&&urlParams.get('demoEvidence')==='1')loadDemoEvidence();
if(requestedView==='plan'&&urlParams.get('demoPlan')==='1'){
  state.roadmap={roadmap_id:'demo_plan',generation_mode:'model_assisted',planner_status:{state:'completed',model:'demo'},brief:{topic:'الرحمة في التعامل مع الضعفاء',target_audience:'جمهور عام',country_or_context:'المملكة العربية السعودية — حي متعدد الأعمار',format:'خطبة جمعة',duration:'15–20 دقيقة',language:'ar'},policy_gate:{official_instruction_state:'none_declared',note:'موضوع اختاره المستخدم؛ لا يوجد تعميم معلن.'},axes:[
    {axis_id:'foundation',role:'foundation',title:'تأصيل معنى الرحمة وصلتها بحفظ الكرامة',research_question:'كيف يؤسس النص الشرعي للرحمة بما يصون كرامة من يواجه ضعفًا أو حاجة؟',purpose:'ضبط المفهوم قبل التطبيقات.',evidence_requirements:['quran','hadith','tafsir'],time_minutes:5},
    {axis_id:'context',role:'context',title:'فهم تنوع الاحتياجات والعوائق في السياق المحلي',research_question:'ما صور الضعف أو الحاجة الأبرز، وما العوائق التي تمنع أصحابها من الوصول إلى الدعم؟',purpose:'ربط البحث بواقع الجمهور.',evidence_requirements:['hadith','approved_research'],time_minutes:4},
    {axis_id:'application',role:'application',title:'ترجمة الرحمة إلى سلوك ومساندة مسؤولة',research_question:'ما الممارسات الفردية والمؤسسية التي تجسد الرحمة من دون استغلال أو وصم؟',purpose:'تحويل المعنى إلى تطبيق.',evidence_requirements:['quran','hadith','sirah'],time_minutes:6},
    {axis_id:'outcome',role:'outcome',title:'تحويل المعنى إلى التزام قابل للمتابعة',research_question:'ما الخطوة الواقعية التي يستطيع الفرد أو المجتمع اتخاذها وقياس أثرها؟',purpose:'تحديد أثر قابل للمراجعة.',evidence_requirements:['approved_research'],time_minutes:4}
  ]};renderRoadmap(state.roadmap);
}
