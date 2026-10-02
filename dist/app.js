const state={view:'start',theme:'light',reviewed:2};
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
qs('#research-form').addEventListener('submit',event=>{event.preventDefault();const topic=qs('#topic').value.trim()||'أثر الأمانة في بناء الثقة داخل المجتمع';qs('#summary-topic').textContent=topic;showView('plan')});
qs('#approve-plan').addEventListener('click',()=>{toast('تم اعتماد الخطة · جُمعت نتائج تجريبية للمراجعة');setTimeout(()=>showView('evidence'),500)});
qsa('.plan-card').forEach(card=>card.addEventListener('click',()=>{qsa('.plan-card').forEach(c=>c.classList.remove('selected'));card.classList.add('selected')}));
qsa('.filter').forEach(button=>button.addEventListener('click',()=>{qsa('.filter').forEach(b=>b.classList.remove('active'));button.classList.add('active');const type=button.dataset.filter;qsa('.evidence-card').forEach(card=>card.hidden=type!=='all'&&card.dataset.type!==type)}));
const inspectorContent={
  verse:{title:'سورة النساء، الآية 58',text:'﴿إِنَّ اللَّهَ يَأْمُرُكُمْ أَنْ تُؤَدُّوا الْأَمَانَاتِ إِلَىٰ أَهْلِهَا﴾',source:'النص القرآني المعتمد',location:'النساء · 58',reason:'تؤسس الآية للأمانة بوصفها أداءً للحق إلى صاحبه، وهو المدخل الأنسب للمحور الأول.'},
  tafsir:{title:'تفسير السعدي، النساء 58',text:'الأمانات تشمل كل ما اؤتمن عليه الإنسان وأُمر بالقيام به.',source:'تفسير السعدي',location:'النساء · 58',reason:'يوسّع التفسير دائرة الأمانة، لكن العبارة الأصلية يجب أن تُراجع في المصدر قبل الاقتباس.'},
  hadith:{title:'صحيح البخاري، حديث 33',text:'آية المنافق ثلاث: إذا حدث كذب، وإذا وعد أخلف، وإذا اؤتمن خان.',source:'صحيح البخاري',location:'كتاب الإيمان · 33',reason:'يقدم صورة تطبيقية للخيانة، ويحتاج عرضه إلى تخريج ظاهر وسياق مناسب.'},
  study:{title:'مرجع اجتماعي مساعد',text:'الثقة عنصر بنيوي في تماسك العلاقات والمؤسسات.',source:'بيانات توضيحية',location:'غير متصل',reason:'يساعد في تأطير الأثر الاجتماعي، ولا يقدم بوصفه دليلًا شرعيًا.'}
};
qsa('.evidence-card').forEach(card=>card.addEventListener('click',event=>{if(event.target.closest('button'))return;qsa('.evidence-card').forEach(c=>c.classList.remove('selected'));card.classList.add('selected');const item=inspectorContent[card.dataset.evidence];const panel=qs('#source-inspector');qs('h2',panel).textContent=item.title;qs('.original-text p',panel).textContent=item.text;const meta=qsa('.source-meta b',panel);meta[0].textContent=item.source;meta[1].textContent=item.location;qs('.relevance p',panel).textContent=item.reason}));
qs('#accept-evidence').addEventListener('click',()=>{if(state.reviewed<6)state.reviewed++;qs('#reviewed-count').textContent=state.reviewed;toast('أُضيف الدليل إلى الحقيبة مع بيانات مصدره')});
qs('#export-button').addEventListener('click',()=>toast('محاكاة فقط: التصدير الفعلي غير متصل في هذه النسخة'));
qs('#theme-toggle').addEventListener('click',()=>{state.theme=state.theme==='light'?'dark':'light';document.body.classList.toggle('dark',state.theme==='dark');qs('#theme-label').textContent=state.theme==='dark'?'داكن':'فاتح'});
qs('#mobile-menu').addEventListener('click',()=>qs('.sidebar').classList.toggle('open'));
qs('#prototype-info').addEventListener('click',()=>{qs('#info-modal').hidden=false;qs('.modal-close').focus()});
qsa('[data-close-modal]').forEach(el=>el.addEventListener('click',()=>{qs('#info-modal').hidden=true;qs('#prototype-info').focus()}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'){qs('#info-modal').hidden=true;qs('.sidebar').classList.remove('open')}});
