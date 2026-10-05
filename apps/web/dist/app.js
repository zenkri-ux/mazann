const state={view:'start',theme:'light',reviewed:0,demoScene:0,demo:false,evidence:[],selectedEvidence:null,evidenceFilter:'all',referenceFilter:'all',loadingEvidence:false,roadmap:null,loadingRoadmap:false,projectId:null,savingProject:false,expertReviewed:false,plannerProgressTimer:null,retrievalProgressTimer:null};
const qs=(selector,root=document)=>root.querySelector(selector);
const qsa=(selector,root=document)=>[...root.querySelectorAll(selector)];
const labels={start:'لم يبدأ جمع الأدلة بعد',plan:'الخطة جاهزة للمراجعة',evidence:'مراجعة المصادر والسياق',coverage:'الحقيبة جاهزة للمراجعة'};
const workspaceId=(()=>{const key='mazann-workspace-id';try{const existing=localStorage.getItem(key);if(/^workspace_[a-f0-9-]{36}$/.test(existing||''))return existing;const created=`workspace_${crypto.randomUUID()}`;localStorage.setItem(key,created);return created}catch{return `workspace_${crypto.randomUUID()}`}})();

function showView(view){
  state.view=view;
  if(view==='coverage')renderCoverage();
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
  state.evidenceFilter=type;state.referenceFilter='all';applyEvidenceFilters();
}
function filterReferenceEvidence(key){
  state.evidenceFilter='all';state.referenceFilter=key;applyEvidenceFilters();
}
function visibleEvidenceItems(){return state.evidence.filter(item=>(state.evidenceFilter==='all'||item.record.source_family===state.evidenceFilter)&&(state.referenceFilter==='all'||referenceKey(item)===state.referenceFilter))}
function clearEvidenceSelection(){
  state.selectedEvidence=null;qs('#source-inspector h2').textContent='لا دليل في هذه التصفية';qs('.original-text p',qs('#source-inspector')).textContent='اختر تصفية أخرى لعرض دليل ومراجعته.';
  qs('#evidence-use-text').textContent='لا يوجد محور لمراجعته الآن.';qs('#evidence-axis-select').innerHTML='<option value="">اختر محورًا</option>';qs('#evidence-axis-select').disabled=true;qs('#evidence-axis-change').open=false;
  qsa('.source-meta b').forEach(value=>value.textContent='—');qs('.relevance p').textContent='لم يُحدَّد سجل للمراجعة.';qs('.relevance small').textContent='لن يُعتمد أي مقتطف دون سجل كامل.';
  qs('.relevance').open=false;qs('.technical-meta').open=false;
  qs('#tafsir-context').hidden=true;
  qs('#accept-evidence').disabled=true;qs('#reject-evidence').disabled=true;qsa('.evidence-card').forEach(card=>card.classList.remove('selected'));
}
function applyEvidenceFilters(){
  const visible=visibleEvidenceItems();const ids=new Set(visible.map(item=>item.record.id));
  qsa('.filter').forEach(button=>button.classList.toggle('active',button.dataset.filter===state.evidenceFilter));
  qsa('.source-item').forEach(button=>button.classList.toggle('active',button.dataset.referenceFilter===state.referenceFilter));
  qsa('.evidence-card').forEach(card=>card.hidden=!ids.has(card.dataset.recordId));
  const empty=qs('#evidence-filter-empty');if(empty)empty.hidden=visible.length>0;
  if(!visible.length)clearEvidenceSelection();else if(!ids.has(state.selectedEvidence))selectEvidence(visible[0].record.id,{scrollToReview:true});
  updateReviewNavigation();
}
function updateReviewNavigation(){
  const visible=visibleEvidenceItems();const index=visible.findIndex(item=>item.record.id===state.selectedEvidence);
  qs('#review-position').textContent=`الدليل ${index<0?0:index+1} من ${visible.length}`;
  qs('#review-previous').disabled=index<=0;qs('#review-next').disabled=index<0||index>=visible.length-1;
}
function navigateEvidence(delta){const visible=visibleEvidenceItems();const index=visible.findIndex(item=>item.record.id===state.selectedEvidence);const target=visible[index+delta];if(target)selectEvidence(target.record.id,{scrollToReview:true})}
qsa('.filter').forEach(button=>button.addEventListener('click',()=>filterEvidence(button.dataset.filter)));
qs('#source-list').addEventListener('click',event=>{const button=event.target.closest('[data-reference-filter]');if(button)filterReferenceEvidence(button.dataset.referenceFilter)});
qs('#review-previous').addEventListener('click',()=>navigateEvidence(-1));
qs('#review-next').addEventListener('click',()=>navigateEvidence(1));

async function api(path,body){
  const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-mazann-workspace':workspaceId},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||'تعذر إكمال الطلب');
  return data;
}
async function apiGet(path){
  const response=await fetch(path,{headers:{accept:'application/json','x-mazann-workspace':workspaceId}});
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
  const levelLabel=({a:'أ — معلومة مستقرة',b:'ب — شرح مؤصل',c:'ج — حساس ويستلزم مراجعة'})[roadmap.policy_gate.content_level]||'قيد التصنيف';
  qs('#policy-note').innerHTML=`<b>${escapeHtml(levelLabel)} · ${escapeHtml(instructionLabels[roadmap.policy_gate.official_instruction_state])}</b>${escapeHtml(roadmap.policy_gate.note)}`;
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
  if(item.record.content_type==='ayah')return item.record.reference?.locator_ar||`السورة ${item.record.metadata.surah}، الآية ${item.record.metadata.ayah}`;
  return item.record.metadata.title||`حديث رقم ${item.record.metadata.hadith_id}`;
}
function evidenceLocation(item){
  return item.record.reference?.locator_ar||(item.record.content_type==='ayah'?`السورة ${item.record.metadata.surah}، الآية ${item.record.metadata.ayah}`:`سجل الحديث ${item.record.metadata.hadith_id}`);
}
function referenceLabel(item){return item.record.reference?.source_label_ar||'مرجع يحتاج استكمالًا'}
function referenceKey(item){return item.record.reference?.key||`unknown:${item.record.id}`}
function evidenceAxes(item){
  const ids=new Set(item.axis_ids||[]);return (state.roadmap?.axes||[]).filter(axis=>ids.has(axis.axis_id));
}
function normalizeEvidencePlacement(item){
  const valid=new Set((state.roadmap?.axes||[]).map(axis=>axis.axis_id));
  const ids=Array.isArray(item.axis_ids)?item.axis_ids.filter(id=>valid.has(id)):[];
  return {...item,axis_ids:ids.length===1?ids:[],placement_status:ids.length===1?(item.placement_status||'needs_confirmation'):'needs_user_assignment'};
}
function evidenceUseLabel(item){
  const axes=evidenceAxes(item);return axes.length?axes[0].title:'اختر المحور المناسب قبل اعتماد الدليل';
}
function updateEvidenceCounts(){
  const counts={all:state.evidence.length,quran:0,hadith:0};
  state.evidence.forEach(item=>counts[item.record.source_family]++);
  qsa('#evidence-filters [data-filter]').forEach(button=>{const count=counts[button.dataset.filter]||0;qs('span',button).textContent=count});
  qs('#evidence-count').textContent=state.evidence.length;
  state.reviewed=state.evidence.filter(item=>item.decision).length;
  qs('#reviewed-count').textContent=state.reviewed;
  const next=qs('#evidence-next');const total=state.evidence.length;const assigned=state.evidence.every(item=>item.decision==='excluded'||evidenceAxes(item).length===1);const ready=total>0&&state.reviewed===total&&assigned;
  next.hidden=total===0||state.loadingEvidence;qs('#evidence-next-count').textContent=`${state.reviewed} / ${total}`;qs('#open-coverage').disabled=!ready;qs('#review-finish').hidden=!ready;
  qs('#evidence-next-title').textContent=ready?'اكتملت قرارات الأدلة — ابنِ هيكل الكتابة':state.reviewed===total&&!assigned?'حدّد محور كل دليل مدرج قبل بناء الحقيبة':'احسم قرار كل دليل، ثم ابنِ هيكل الكتابة';
  qs('#evidence-next-description').textContent=ready?'سترى كل محور مع وظيفته والأدلة التي اعتمدتها والفجوات التي بقيت.':'اعتمد ما يخدم محاورك واستبعد ما لا يناسبها؛ لا يعني ظهور الدليل أنه دخل الحقيبة.';
  qs('#source-rail h2').textContent=state.evidence.length===2?'موضعان موثقان':`${state.evidence.length} مواضع موثقة`;
  const groups=new Map();state.evidence.forEach(item=>{const key=referenceKey(item);const group=groups.get(key)||{key,label:referenceLabel(item),family:item.record.source_family,count:0,precise:true};group.count++;group.precise=group.precise&&Boolean(item.record.reference?.primary_locator_available);groups.set(key,group)});
  const sources=[...groups.values()].map(group=>`<button class="source-item" data-reference-filter="${escapeHtml(group.key)}" type="button"><span class="source-glyph ${escapeHtml(group.family)}">${group.family==='quran'?'ق':'ح'}</span><span><b>${escapeHtml(group.label)}</b><small>${group.precise?'موضع أصلي محدد':'اسم المصدر متاح · الموضع يحتاج استكمالًا'}</small></span><i>${group.count}</i></button>`).join('');
  qs('#source-list').innerHTML=`<button class="source-item active" data-reference-filter="all" type="button"><span class="source-glyph">✦</span><span><b>جميع المراجع</b><small>${state.evidence.length} سجل كامل · ${state.evidence.filter(item=>item.decision==='accepted').length} معتمد</small></span><i>${state.evidence.length}</i></button>${sources}`;
}
function renderEvidence(){
  const feed=qs('#evidence-feed');
  if(!state.evidence.length){feed.innerHTML='<div class="evidence-empty"><b>لم يصل سجل صالح</b><p>لم يعوض النظام النقص من ذاكرته. راجع حالة المصدر أو حاول لاحقًا.</p></div>';updateEvidenceCounts();clearEvidenceSelection();updateReviewNavigation();return}
  feed.innerHTML=state.evidence.map(item=>{
    const record=item.record;const type=record.source_family;const mode=item.retrieval_mode==='live'?'اتصال حي':'نسخة مخزنة';const accepted=item.decision==='accepted'?' is-accepted':'';const warning=record.reference?.primary_locator_available===false?' warning':'';const selected=item.record.id===state.selectedEvidence?' selected':'';
    const body=record.content_type==='ayah'?`<blockquote>${escapeHtml(record.text)}</blockquote><p>${escapeHtml(record.metadata.translation||'لا يوجد شرح منشور في السجل.')}</p>`:`<h2>${escapeHtml(evidenceTitle(item))}</h2><blockquote class="hadith-matn">${escapeHtml(record.text)}</blockquote><p>هذا هو المتن الكامل المنشور في سجل الإتاحة. الحكم المنشور: <b>${escapeHtml(record.metadata.grade||'غير متاح')}</b>.</p>`;
    const locatorBadge=record.reference?.primary_locator_available===false?'<span class="review-badge">موضع الكتاب يحتاج استكمالًا</span>':'';
    const tafsirBadge=record.related_tafsir?'<span class="neutral-badge">تفسير مرتبط · رابط خارجي</span>':'';
    const decision=item.decision?`<span class="decision-chip ${escapeHtml(item.decision)}">${escapeHtml(decisionLabel(item.decision))}</span>`:'<span class="decision-chip pending">بانتظار قرارك</span>';
    const purposeLabel=item.placement_status==='confirmed_by_user'?'يخدم':evidenceAxes(item).length?'محور مقترح':'حدد موضعه';
    return `<article class="evidence-card${accepted}${warning}${selected}" data-type="${escapeHtml(type)}" data-reference-key="${escapeHtml(referenceKey(item))}" data-record-id="${escapeHtml(record.id)}"><header><div><span class="type-badge ${escapeHtml(type)}">${escapeHtml(referenceLabel(item))}</span><span class="verified-badge">✓ سجل كامل · ${mode}</span>${locatorBadge}${tafsirBadge}</div>${decision}</header><div class="evidence-purpose"><span>${purposeLabel}</span><b>${escapeHtml(evidenceUseLabel(item))}</b></div>${body}<footer><span>${escapeHtml(evidenceLocation(item))}</span><a href="${escapeHtml(safeExternalUrl(record.citation_url))}" target="_blank" rel="noreferrer">فتح سجل الإتاحة</a></footer></article>`;
  }).join('')+'<div class="evidence-empty" id="evidence-filter-empty" hidden><b>لا أدلة في هذه التصفية</b><p>اختر «الكل» أو مصدرًا آخر للمتابعة.</p></div>';
  updateEvidenceCounts();
  applyEvidenceFilters();
  qsa('.evidence-card',feed).forEach(card=>card.addEventListener('click',event=>{if(event.target.closest('a'))return;selectEvidence(card.dataset.recordId,{scrollToReview:true})}));
}
function selectEvidence(id,{scrollToReview=false}={}){
  const changed=state.selectedEvidence!==id;state.selectedEvidence=id;const item=state.evidence.find(entry=>entry.record.id===id);if(!item)return;
  qsa('.evidence-card').forEach(card=>card.classList.toggle('selected',card.dataset.recordId===id));
  const panel=qs('#source-inspector');
  if(changed){qs('.inspector-body',panel).scrollTop=0;qs('.relevance',panel).open=false;qs('.technical-meta',panel).open=false}
  qs('h2',panel).textContent=evidenceTitle(item);qs('.original-text p',panel).textContent=item.record.text;qs('.verified-seal',panel).textContent='✓';
  const axes=evidenceAxes(item);const hasSuggestion=axes.length===1;qs('#evidence-use-text').textContent=hasSuggestion?`«${axes[0].title}»: ${axes[0].purpose||axes[0].research_question}`:'لم تتضح صلة كافية بمحور واحد؛ راجع النص ثم اختر موضعه إن أردت اعتماد الدليل.';
  const axisChange=qs('#evidence-axis-change');axisChange.open=!hasSuggestion;qs('#evidence-axis-change-label').textContent=hasSuggestion?'تغيير المحور المقترح':'اختيار محور لهذا الدليل';qs('#evidence-use-note').textContent=hasSuggestion?'هذا اقتراح آلي قابل للتغيير؛ اعتمد الدليل فقط بعد مراجعة ملاءمته.':'لا نضع الدليل تلقائيًا في محور إذا كانت الصلة غير واضحة.';
  const axisSelect=qs('#evidence-axis-select');axisSelect.innerHTML=`<option value="">اختر محورًا مناسبًا</option>${(state.roadmap?.axes||[]).map(axis=>`<option value="${escapeHtml(axis.axis_id)}">${escapeHtml(axis.title)}</option>`).join('')}`;axisSelect.value=axes[0]?.axis_id||'';axisSelect.disabled=!state.roadmap?.axes?.length;
  const meta=qsa('.source-meta b',panel);meta[0].textContent=referenceLabel(item);meta[1].textContent=evidenceLocation(item);meta[2].textContent=item.record.access?.provider_name||item.record.origin_platform;meta[3].textContent=item.retrieval_mode==='live'?'حي من منصة الإتاحة':'نسخة مخزنة موثقة';meta[3].classList.add('mint-text');
  const tafsir=item.record.related_tafsir;qs('#tafsir-context').hidden=!tafsir;if(tafsir){qs('#tafsir-source').textContent=tafsir.source_name_ar;qs('#tafsir-scope').textContent=tafsir.section_title_ar;qs('#tafsir-link').href=safeExternalUrl(tafsir.citation_url)}
  const referenceNote=item.record.reference?.verification_note_ar;qs('.relevance p',panel).textContent=referenceNote|| (item.record.content_type==='ayah'?`موضع الآية محدد، والتفسير المنشور محفوظ منفصلًا عن نصها. البصمة: ${item.record.checksum_sha256.slice(0,12)}…`:`الحكم المنشور: ${item.record.metadata.grade||'غير متاح'}. الشرح محفوظ منفصلًا عن المتن. البصمة: ${item.record.checksum_sha256.slice(0,12)}…`);
  const verification=item.record.reference?.verification;const audit=item.record.metadata?.locator_audit;
  qs('.relevance small',panel).innerHTML=verification?.evidence_url?`تحقق التخريج: ${escapeHtml(verification.authority||'مصدر موثوق')} · <a href="${escapeHtml(safeExternalUrl(verification.evidence_url))}" target="_blank" rel="noreferrer">فتح شاهد التحقق</a>${audit?.status?` · ${escapeHtml(audit.status)}`:''}`:'لا يعتمد أي مقتطف من نتائج البحث؛ يعتمد السجل الكامل فقط.';
  qs('#accept-evidence').disabled=false;qs('#accept-evidence').textContent=item.record.reference?.primary_locator_available===false?'✓ اعتماد مبدئي — استكمال الموضع':'✓ اعتماد في الحقيبة';qs('#reject-evidence').disabled=false;
  updateReviewNavigation();
  if(scrollToReview&&window.matchMedia('(max-width: 800px)').matches)panel.scrollIntoView({behavior:'smooth',block:'start'});
}
async function loadRoadmapEvidence(){
  state.loadingEvidence=true;state.evidence=[];state.selectedEvidence=null;state.evidenceFilter='all';state.referenceFilter='all';
  qs('#evidence-next').hidden=true;
  qs('#retrieval-status').textContent='جارٍ البحث وفق أسئلة المحاور؛ لن يعتمد أي مقتطف قبل جلب السجل الكامل…';
  startRetrievalProgress();
  qs('#evidence-feed').innerHTML='<div class="evidence-empty"><b>جارٍ البحث في المصادر المعتمدة</b><p>تُدمج النتائج المتكررة، ثم يُجلب الأصل الكامل ويُتحقق من مرجعه.</p></div>';
  try{
    const result=await api('/api/research/evidence',{roadmap:state.roadmap,max_records:Math.min(12,Math.max(6,(state.roadmap?.axes?.length||0)*2))});
    state.evidence=result.records.map(item=>normalizeEvidencePlacement({...item,decision:null}));
    const cacheCount=state.evidence.filter(item=>item.retrieval_mode==='cache').length;
    const failedCount=result.unresolved.length+result.search_failures.length;
    const failedSourceLabels=[...new Set(result.search_failures.map(item=>item.source).filter(Boolean).map(source=>source==='quran'?'القرآن':source==='hadith'?'الحديث':source))];
    qs('#retrieval-status').textContent=`وُجد ${state.evidence.length} سجل كامل للمراجعة${cacheCount?` · ${cacheCount} من النسخة المخزنة`:''}${failedCount?` · ${failedCount} نتيجة أو مسار تعذر ولم يتحول إلى دليل`:''}${failedSourceLabels.length?` · تعذر بحث ${failedSourceLabels.join(' و')} بعد إعادة المحاولة`:''}. ظهور السجل لا يعني اعتماده؛ اختر ما يخدم الخطة فقط.`;
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
function demoReviewRoadmap(){return {roadmap_id:'demo_review',generation_mode:'model_assisted',brief:{topic:'أثر الأمانة في بناء الثقة داخل المجتمع',target_audience:'جمهور عام',country_or_context:'المملكة العربية السعودية',format:'خطبة جمعة',duration:'15–20 دقيقة',language:'ar'},policy_gate:{official_instruction_state:'none_declared',content_level:'b',note:'حقيبة عرض توضح ربط الأدلة بأجزاء الموضوع.'},axes:[
  {axis_id:'demo_foundation',role:'foundation',title:'تأصيل معنى الأمانة ومسؤولية أدائها',research_question:'كيف يؤصل القرآن لمعنى أداء الأمانة والعدل؟',purpose:'ضبط المفهوم الشرعي قبل الانتقال إلى أثره الاجتماعي.',evidence_requirements:['quran'],time_minutes:5},
  {axis_id:'demo_application',role:'application',title:'ترجمة الأمانة إلى سلوك يومي',research_question:'كيف تظهر الأمانة في القول والعمل والعلاقات؟',purpose:'وصل التأصيل بمواقف يفهمها جمهور الخطبة.',evidence_requirements:['quran','hadith'],time_minutes:6},
  {axis_id:'demo_outcome',role:'outcome',title:'أثر الأمانة في الثقة المجتمعية',research_question:'ما الذي يتغير في المجتمع حين تصبح الأمانة ممارسة؟',purpose:'ختم المسار بأثر عملي قابل للمراجعة.',evidence_requirements:['hadith'],time_minutes:4}
]}}
async function loadDemoEvidence(){
  if(!state.roadmap){state.roadmap=demoReviewRoadmap();renderRoadmap(state.roadmap)}
  state.loadingEvidence=true;state.evidence=[];state.selectedEvidence=null;state.evidenceFilter='all';state.referenceFilter='all';qs('#retrieval-status').textContent='جارٍ طلب السجلين الكاملين والتحقق من المرجع والبصمة…';qs('#evidence-feed').innerHTML='<div class="evidence-empty"><b>جارٍ الاتصال بالمصدر</b><p>لن يظهر مقتطف البحث بوصفه دليلًا.</p></div>';
  const requests=[api('/api/evidence/quran',{surah:4,ayah:58,language:'ar'}),api('/api/evidence/hadith',{id:'3016',language:'ar'})];
  const results=await Promise.allSettled(requests);state.evidence=results.filter(result=>result.status==='fulfilled').map((result,index)=>({...result.value,axis_ids:[index===0?'demo_foundation':'demo_application'],decision:null}));
  const failures=results.filter(result=>result.status==='rejected');const cacheCount=state.evidence.filter(item=>item.retrieval_mode==='cache').length;
  qs('#retrieval-status').textContent=`وصل ${state.evidence.length} سجل كامل صالح${cacheCount?` · ${cacheCount} من النسخة المخزنة`:''}${failures.length?` · تعذر ${failures.length} ولم يُستبدل بمحتوى مولد`:''}.`;
  renderEvidence();if(state.evidence[0])selectEvidence(state.evidence[0].record.id);state.loadingEvidence=false;
}
qs('#evidence-axis-select').addEventListener('change',event=>{const item=state.evidence.find(entry=>entry.record.id===state.selectedEvidence);if(!item)return;const id=event.target.value;item.axis_ids=(state.roadmap?.axes||[]).some(axis=>axis.axis_id===id)?[id]:[];item.placement_status=id?'confirmed_by_user':'needs_user_assignment';renderEvidence();selectEvidence(item.record.id)});
qs('#accept-evidence').addEventListener('click',()=>{const item=state.evidence.find(entry=>entry.record.id===state.selectedEvidence);if(!item)return;if(evidenceAxes(item).length!==1){toast('اختر المحور الذي يخدمه هذا الدليل قبل اعتماده');qs('#evidence-axis-change').open=true;qs('#evidence-axis-select').focus();return}const complete=item.record.reference?.primary_locator_available!==false;item.decision=complete?'accepted':'needs_reference';item.placement_status='confirmed_by_user';renderEvidence();selectEvidence(item.record.id);toast(complete?'أُضيف السجل الكامل إلى الحقيبة مع مرجعه وبصمته':'حُفظ مبدئيًا، ولن يعد مرجعًا نهائيًا حتى يستكمل موضعه في الكتاب')});
qs('#reject-evidence').addEventListener('click',()=>{const item=state.evidence.find(entry=>entry.record.id===state.selectedEvidence);if(!item)return;item.decision='excluded';renderEvidence();selectEvidence(item.record.id);toast('استُبعد الدليل وبقي قرار الاستبعاد قابلًا للمراجعة')});
qs('#open-coverage').addEventListener('click',()=>showView('coverage'));
qs('#review-finish').addEventListener('click',()=>showView('coverage'));
function decisionLabel(decision){return ({accepted:'معتمد',needs_reference:'اعتماد مبدئي — يحتاج استكمال الموضع',excluded:'مستبعد'})[decision]||'لم يُحسم'}
function buildCoverageModel(){
  const axes=state.roadmap?.axes||[];
  const unassigned=state.evidence.filter(item=>['accepted','needs_reference'].includes(item.decision)&&evidenceAxes(item).length!==1);
  const rows=axes.map(axis=>{
    const requirements=axis.evidence_requirements?.length?axis.evidence_requirements:['quran','hadith'];
    const cells=requirements.map(source=>{
      const records=state.evidence.filter(item=>item.axis_ids?.includes(axis.axis_id)&&item.record.source_family===source);
      if(records.some(item=>item.decision==='accepted'))return {source,status:'good',weight:1};
      if(records.some(item=>item.decision==='needs_reference'))return {source,status:'review',weight:.6};
      if(records.some(item=>!item.decision))return {source,status:'review',weight:.25};
      return {source,status:'gap',weight:0};
    });
    const percent=Math.round(cells.reduce((sum,cell)=>sum+cell.weight,0)/Math.max(cells.length,1)*100);
    const included=state.evidence.filter(item=>item.axis_ids?.includes(axis.axis_id)&&['accepted','needs_reference'].includes(item.decision));
    return {axis,cells,percent,included};
  });
  const score=rows.length?Math.round(rows.reduce((sum,row)=>sum+row.percent,0)/rows.length):0;
  const gaps=rows.flatMap(row=>row.cells.filter(cell=>cell.status==='gap').map(cell=>({axis:row.axis,source:cell.source})));
  return {rows,score,gaps,unassigned};
}
function renderCoverage(){
  const model=buildCoverageModel();const axes=state.roadmap?.axes||[];
  qs('#coverage-score').innerHTML=`${model.score}<small>%</small>`;
  qs('#coverage-title').textContent=model.score>=80?'حقيبة متماسكة للمراجعة العلمية.':model.score>=50?'هيكل جيد مع مواضع للاستكمال.':'هيكل أولي قابل للاستكمال.';
  qs('#coverage-meta').textContent=`${axes.length} محاور · ${state.evidence.length} سجلات كاملة · ${model.gaps.length} مواضع قابلة للاستكمال${model.unassigned.length?` · ${model.unassigned.length} أدلة بلا محور`:''}`;
  qs('#writing-outline-list').innerHTML=model.rows.length?model.rows.map((row,index)=>{
    const records=row.included;const evidenceMarkup=records.length?records.map(item=>`<li><span class="outline-source ${escapeHtml(item.record.source_family)}">${escapeHtml(item.record.source_family==='quran'?'قرآن':'حديث')}</span><span><b>${escapeHtml(item.record.source_family==='quran'?item.record.text:evidenceTitle(item))}</b><small>${escapeHtml(referenceLabel(item))} · ${escapeHtml(evidenceLocation(item))}</small>${item.record.related_tafsir?`<small>تفسير سياقي: <a href="${escapeHtml(safeExternalUrl(item.record.related_tafsir.citation_url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.record.related_tafsir.source_name_ar)} · ${escapeHtml(item.record.related_tafsir.section_title_ar)}</a> — ليس دليلًا مستقلًا</small>`:''}</span></li>`).join(''):'<li class="outline-gap">لم يُدرج دليل لهذا الجزء بعد؛ يمكن استكماله عند الحاجة.</li>';
    return `<article class="outline-part"><div class="outline-number"><span>${String(index+1).padStart(2,'0')}</span><small>${escapeHtml(row.axis.time_minutes||'—')} د</small></div><div class="outline-copy"><span class="outline-role">${escapeHtml(axisLabels[row.axis.role]||'جزء الموضوع')}</span><h3>${escapeHtml(row.axis.title)}</h3><p><b>زاوية المعالجة:</b> ${escapeHtml(row.axis.purpose||'تحديد وظيفة هذا الجزء قبل الكتابة.')}</p><p><b>السؤال الذي يجيب عنه:</b> ${escapeHtml(row.axis.research_question)}</p><ul>${evidenceMarkup}</ul></div><span class="outline-score ${row.percent>=80?'ready':row.percent?'partial':'empty'}">${row.percent}%</span></article>`;
  }).join(''):'<div class="outline-empty">ابنِ خطة البحث وراجع الأدلة ليظهر هيكل الكتابة.</div>';
  qs('#coverage-axis-list').innerHTML=model.rows.length?model.rows.map((row,index)=>{
    const included=row.included.length;const review=row.cells.filter(cell=>cell.status==='review').length;
    const detail=included?`${included} أدلة مدرجة${review?` · ${review} قيد المراجعة`:''}`:'لا يوجد دليل مدرج بعد';
    return `<div class="axis-row"><div><span>${String(index+1).padStart(2,'0')}</span><div><b>${escapeHtml(row.axis.title)}</b><small>${escapeHtml(detail)}</small></div></div><div class="coverage-cells" style="grid-template-columns:repeat(${Math.max(row.cells.length,1)},1fr)">${row.cells.map(cell=>`<i class="${cell.status}" title="${escapeHtml(sourceLabels[cell.source]||cell.source)}"></i>`).join('')}</div><strong>${row.percent}%</strong></div>`;
  }).join(''):'<div class="coverage-empty">ابنِ خطة البحث أولًا لتظهر خريطة التغطية.</div>';
  const gap=model.gaps[0];const gapCard=qs('#coverage-gap');const hasRoadmap=axes.length>0;
  gapCard.classList.toggle('resolved',hasRoadmap&&!gap&&!model.unassigned.length);
  qs('.gap-symbol',gapCard).textContent=hasRoadmap&&!gap&&!model.unassigned.length?'✓':'+';
  qs('#coverage-gap-label').textContent=!hasRoadmap?'بانتظار خطة البحث':model.unassigned.length?'دليل يحتاج تحديد موضعه':gap?'فرصة لاستكمال المصادر':'اكتملت المصادر المخططة';
  qs('#coverage-gap-title').textContent=!hasRoadmap?'ابنِ خطة البحث وراجع الأدلة أولًا':model.unassigned.length?`${model.unassigned.length} أدلة مدرجة بلا محور محدد`:gap?`محور «${gap.axis.title}» يحتاج ${sourceLabels[gap.source]||gap.source}`:'اكتملت أنواع المصادر المطلوبة وفق القرارات الحالية';
  qs('#coverage-gap-description').textContent=!hasRoadmap?'تظهر التغطية بعد بناء الخطة ومراجعة الأدلة.':model.unassigned.length?'ارجع إلى مراجعة الأدلة وحدد موضع استخدام واحدًا لكل دليل؛ لا تُحسب الأدلة غير المرتبطة ضمن التغطية.':gap?'عدم توفر دليل من هذا النوع ليس خطأً بحد ذاته؛ واصل البحث إن احتجته، أو راجع متطلب المحور بقرار منهجي واضح.':'تبقى مراجعة المتخصص لازمة قبل استخدام المادة أو نشرها.';
  const included=state.evidence.filter(item=>['accepted','needs_reference'].includes(item.decision)&&evidenceAxes(item).length===1);
  const quran=included.filter(item=>item.record.source_family==='quran');const hadith=included.filter(item=>item.record.source_family==='hadith');
  const checks={
    quran:quran.length>0&&quran.every(item=>item.record.content_type==='ayah'&&item.record.validation?.status==='valid'),
    hadith:hadith.length>0&&hadith.every(item=>Boolean(item.record.metadata?.grade)&&item.record.validation?.status==='valid'),
    references:included.length>0&&included.every(item=>Boolean(item.record.reference?.source_label_ar)&&Boolean(evidenceLocation(item))&&item.record.reference?.primary_locator_available!==false),
    decisions:state.evidence.length>0&&state.evidence.every(item=>Boolean(item.decision)&&(item.decision==='excluded'||evidenceAxes(item).length===1)),
  };
  qs('#check-quran').checked=checks.quran;qs('#check-hadith').checked=checks.hadith;qs('#check-references').checked=checks.references;qs('#check-decisions').checked=checks.decisions;qs('#check-expert').checked=state.expertReviewed;
  const passed=Object.values(checks).filter(Boolean).length+(state.expertReviewed?1:0);qs('#readiness-count').textContent=`${passed} / 5`;
  qsa('[data-export-format]').forEach(button=>button.disabled=!state.roadmap);
}
function buildMarkdownPackage(){
  const model=buildCoverageModel();const lines=[
    '# مسودة حقيبة مَظَانّ البحثية','',
    `- الموضوع: ${state.roadmap.brief?.topic||'غير محدد'}`,
    `- الجمهور والسياق: ${state.roadmap.brief?.target_audience||'غير محدد'} — ${state.roadmap.brief?.country_or_context||'غير محدد'}`,
    `- تغطية المصادر المطلوبة: ${model.score}%`,
    `- تاريخ التصدير: ${new Date().toISOString()}`,'',
    '> هذه مسودة بحثية مساعدة وليست خطبة جاهزة أو فتوى. يلزم التحقق والمراجعة العلمية قبل الاستخدام أو النشر.','',
    '## المحاور والأدلة',''
  ];
  model.rows.forEach((row,index)=>{
    lines.push(`### ${index+1}. ${row.axis.title}`,'',`سؤال البحث: ${row.axis.research_question}`,'',`تغطية المحور: ${row.percent}%`,'');
    const records=state.evidence.filter(item=>item.axis_ids?.includes(row.axis.axis_id));
    if(!records.length)lines.push('- لا يوجد سجل كامل مرتبط بهذا المحور.','');
    records.forEach(item=>{const record=item.record;lines.push(`#### ${evidenceTitle(item)}`,'',`- القرار: ${decisionLabel(item.decision)}`,`- المصدر المرجعي: ${referenceLabel(item)}`,`- الموضع: ${evidenceLocation(item)}`,`- دقة الموضع: ${record.reference?.precision||'غير محددة'}`,`- حالة الجلب: ${item.retrieval_mode==='live'?'حي':'نسخة مخزنة'}`,`- حالة التحقق: ${record.validation?.status||'غير محددة'}`,`- البصمة: ${record.checksum_sha256}`,`- رابط الإتاحة: ${record.citation_url}`);(record.reference?.primary_sources||[]).forEach(source=>lines.push(`- تحقق ${source.collection_ar} ${source.number_ar}: ${source.verification_url}`));if(record.reference?.verification?.evidence_url)lines.push(`- شاهد التخريج (${record.reference.verification.authority}): ${record.reference.verification.evidence_url}`);if(record.related_tafsir)lines.push(`- رابط تفسير سياقي (${record.related_tafsir.source_name_ar}، ${record.related_tafsir.section_title_ar}): ${record.related_tafsir.citation_url} — ليس نصًا مسترجعًا ولا دليلًا مستقلًا.`);lines.push('','> '+String(record.text).replace(/\n/g,'\n> '),'');});
  });
  if(model.unassigned.length){lines.push('## أدلة مدرجة تنتظر تحديد المحور','');model.unassigned.forEach(item=>lines.push(`- ${evidenceTitle(item)} — ${referenceLabel(item)} — ${item.record.citation_url}`));lines.push('')}
  lines.push('## مواضع قابلة للاستكمال','');
  if(model.gaps.length)model.gaps.forEach(gap=>lines.push(`- ${gap.axis.title}: يمكن استكمال ${sourceLabels[gap.source]||gap.source} عند الحاجة.`));else lines.push('- لا توجد مواضع مصدرية مفتوحة وفق متطلبات المحاور وقرارات المراجعة الحالية.');
  lines.push('','## سجل الاستبعاد','');
  const excluded=state.evidence.filter(item=>item.decision==='excluded');if(excluded.length)excluded.forEach(item=>lines.push(`- ${evidenceTitle(item)} — ${referenceLabel(item)}.`));else lines.push('- لا توجد سجلات مستبعدة.');
  return `${lines.join('\n')}\n`;
}
function buildDocumentPackage(){
  const model=buildCoverageModel();const topic=state.roadmap.brief?.topic||'موضوع غير محدد';
  const parts=model.rows.map((row,index)=>{
    const records=row.included.map(item=>`<article class="reference"><h4>${escapeHtml(evidenceTitle(item))}</h4><p class="meta">${escapeHtml(referenceLabel(item))} — ${escapeHtml(evidenceLocation(item))}</p><blockquote>${escapeHtml(item.record.text)}</blockquote><p><a href="${escapeHtml(safeExternalUrl(item.record.citation_url))}">فتح سجل الإتاحة</a></p>${item.record.related_tafsir?`<p class="meta">تفسير سياقي: <a href="${escapeHtml(safeExternalUrl(item.record.related_tafsir.citation_url))}">${escapeHtml(item.record.related_tafsir.source_name_ar)} — ${escapeHtml(item.record.related_tafsir.section_title_ar)}</a>. الرابط ليس نصًا مسترجعًا ولا دليلًا مستقلًا.</p>`:''}</article>`).join('')||'<p class="gap">لم يُدرج دليل لهذا الجزء بعد؛ يمكن استكماله عند الحاجة.</p>';
    return `<section class="part"><header><span>${String(index+1).padStart(2,'0')}</span><div><small>${escapeHtml(axisLabels[row.axis.role]||'جزء الموضوع')} · ${escapeHtml(row.axis.time_minutes||'—')} دقيقة</small><h2>${escapeHtml(row.axis.title)}</h2></div></header><p><b>زاوية المعالجة:</b> ${escapeHtml(row.axis.purpose||'—')}</p><p><b>السؤال:</b> ${escapeHtml(row.axis.research_question)}</p><h3>الأدلة المختارة</h3>${records}</section>`;
  }).join('');
  const gaps=model.gaps.length?model.gaps.map(gap=>`<li>${escapeHtml(gap.axis.title)}: يمكن استكمال ${escapeHtml(sourceLabels[gap.source]||gap.source)} عند الحاجة</li>`).join(''):'<li>لا توجد مواضع مصدرية مفتوحة وفق القرارات الحالية.</li>';
  const unassigned=model.unassigned.length?`<section><h2>أدلة تنتظر تحديد المحور</h2><ul>${model.unassigned.map(item=>`<li>${escapeHtml(evidenceTitle(item))} — ${escapeHtml(referenceLabel(item))}</li>`).join('')}</ul></section>`:'';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>حقيبة مَظَانّ — ${escapeHtml(topic)}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:"Arial",sans-serif;color:#171b3f;line-height:1.8;margin:0}main{max-width:780px;margin:auto}.brand{color:#6150ea;font-weight:700}.boundary{padding:12px 16px;border-right:4px solid #e9a63d;background:#fff7e5}.summary{display:flex;gap:20px;padding:12px 0;border-block:1px solid #ddd}.part{margin:26px 0;break-inside:avoid}.part>header{display:flex;gap:12px;align-items:center}.part>header>span{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#f0edff;color:#6150ea;font-weight:700}.part h2{margin:0}.part small,.meta{color:#667085}.reference{margin:12px 0;padding:14px;border:1px solid #e3e4ec;border-radius:12px}.reference h4,.reference p{margin:0 0 6px}.reference blockquote{margin:10px 0;padding:10px 14px;border-right:3px solid #2ef2c2;background:#f7f8fb}.gap{color:#9f394a}.footer{margin-top:28px;padding-top:14px;border-top:1px solid #ddd;color:#667085;font-size:12px}@media print{a{color:inherit;text-decoration:none}}</style></head><body><main><p class="brand">مَظَانّ · حقيبة إعداد الأدلة</p><h1>${escapeHtml(topic)}</h1><div class="summary"><span>${escapeHtml(state.roadmap.brief?.target_audience||'جمهور غير محدد')}</span><span>${escapeHtml(state.roadmap.brief?.country_or_context||'سياق غير محدد')}</span><span>جاهزية الأدلة ${model.score}%</span></div><p class="boundary"><b>حدود الاستخدام:</b> هذه خريطة كتابة وحقيبة مصادر، وليست خطبة مولدة أو فتوى. يلزم التحقق والمراجعة العلمية قبل الاستخدام أو النشر.</p>${parts}${unassigned}<section><h2>الفجوات المفتوحة</h2><ul>${gaps}</ul></section><p class="footer">أُنشئت الحقيبة في ${new Date().toLocaleString('ar')} · تبقى صياغة الخطبة وقرار استخدامها مسؤولية الباحث والمراجع المؤهل.</p></main></body></html>`;
}
function downloadFile(content,type,extension){
  const blob=new Blob([`\ufeff${content}`],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`mazann-research-${new Date().toISOString().slice(0,10)}.${extension}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportResearchPackage(format){
  if(!state.roadmap){toast('ابنِ خطة البحث قبل التصدير');return}
  if(format==='markdown'){downloadFile(buildMarkdownPackage(),'text/markdown;charset=utf-8','md');toast('تم تنزيل نسخة Markdown للتوثيق');return}
  const documentHtml=buildDocumentPackage()
    .replace('.gap{color:#9f394a}', '.gap{color:#62577d}')
    .replace('جاهزية الأدلة ', 'تغطية المصادر المطلوبة ')
    .replace('الفجوات المفتوحة', 'مواضع قابلة للاستكمال');
  if(format==='word'){downloadFile(documentHtml,'application/msword;charset=utf-8','doc');toast('تم تنزيل ملف Word لمتابعة الكتابة');return}
  const printWindow=window.open('','mazann-print','width=980,height=780');if(!printWindow){toast('اسمح بفتح نافذة الطباعة لحفظ PDF');return}printWindow.document.open();printWindow.document.write(documentHtml);printWindow.document.close();printWindow.focus();setTimeout(()=>printWindow.print(),250);
}
qs('#check-expert').addEventListener('change',event=>{state.expertReviewed=event.target.checked;renderCoverage()});
qsa('[data-export-format]').forEach(button=>button.addEventListener('click',()=>exportResearchPackage(button.dataset.exportFormat)));
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
    state.projectId=project.project_id;state.roadmap=project.roadmap;state.evidence=(project.evidence||[]).map(normalizeEvidencePlacement);state.selectedEvidence=state.evidence[0]?.record?.id||null;state.evidenceFilter='all';state.referenceFilter='all';
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
  coverage:['.section-heading > *','.writing-outline','.coverage-map','.export-panel','.gap-card','.checklist']
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
if(requestedView==='evidence'&&urlParams.get('previewLoading')==='1'){
  state.roadmap=demoReviewRoadmap();renderRoadmap(state.roadmap);state.loadingEvidence=true;qs('#retrieval-status').textContent='جارٍ البحث وفق أسئلة المحاور؛ لن يعتمد أي مقتطف قبل جلب السجل الكامل…';startRetrievalProgress();qs('#evidence-feed').innerHTML='<div class="evidence-empty"><b>نجمع السجلات الكاملة</b><p>نبحث في المصادر، ثم نجلب الأصل ونفحص مرجعه قبل عرضه.</p></div>';
}
if(['evidence','coverage'].includes(requestedView)&&urlParams.get('demoEvidence')==='1')loadDemoEvidence().then(()=>{if(requestedView==='coverage'){state.evidence.forEach(item=>item.decision='accepted');renderEvidence();showView('coverage')}});
if(requestedView==='plan'&&urlParams.get('demoPlan')==='1'){
  state.roadmap={roadmap_id:'demo_plan',generation_mode:'model_assisted',planner_status:{state:'completed',model:'demo'},brief:{topic:'الرحمة في التعامل مع الضعفاء',target_audience:'جمهور عام',country_or_context:'المملكة العربية السعودية — حي متعدد الأعمار',format:'خطبة جمعة',duration:'15–20 دقيقة',language:'ar'},policy_gate:{official_instruction_state:'none_declared',note:'موضوع اختاره المستخدم؛ لا يوجد تعميم معلن.'},axes:[
    {axis_id:'foundation',role:'foundation',title:'تأصيل معنى الرحمة وصلتها بحفظ الكرامة',research_question:'كيف يؤسس النص الشرعي للرحمة بما يصون كرامة من يواجه ضعفًا أو حاجة؟',purpose:'ضبط المفهوم قبل التطبيقات.',evidence_requirements:['quran','hadith','tafsir'],time_minutes:5},
    {axis_id:'context',role:'context',title:'فهم تنوع الاحتياجات والعوائق في السياق المحلي',research_question:'ما صور الضعف أو الحاجة الأبرز، وما العوائق التي تمنع أصحابها من الوصول إلى الدعم؟',purpose:'ربط البحث بواقع الجمهور.',evidence_requirements:['hadith','approved_research'],time_minutes:4},
    {axis_id:'application',role:'application',title:'ترجمة الرحمة إلى سلوك ومساندة مسؤولة',research_question:'ما الممارسات الفردية والمؤسسية التي تجسد الرحمة من دون استغلال أو وصم؟',purpose:'تحويل المعنى إلى تطبيق.',evidence_requirements:['quran','hadith','sirah'],time_minutes:6},
    {axis_id:'outcome',role:'outcome',title:'تحويل المعنى إلى التزام قابل للمتابعة',research_question:'ما الخطوة الواقعية التي يستطيع الفرد أو المجتمع اتخاذها وقياس أثرها؟',purpose:'تحديد أثر قابل للمراجعة.',evidence_requirements:['approved_research'],time_minutes:4}
  ]};renderRoadmap(state.roadmap);
}
