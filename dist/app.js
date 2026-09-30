const state = { stage: 1, busy: false };
const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

function setStage(stage) {
  state.stage = stage;
  qsa('.stage').forEach((button) => {
    const number = Number(button.dataset.stage);
    button.classList.toggle('active', number === stage);
    button.classList.toggle('complete', number < stage);
  });
  qs('.status-number').textContent = String(stage).padStart(2, '0');
}

function reset() {
  state.busy = false;
  setStage(1);
  qs('#conversation').replaceChildren();
  qs('#welcome').hidden = false;
  qs('#message').value = '';
  qs('#evidence-count').textContent = '0';
  qs('#inspector-content').innerHTML = `
    <div class="empty-evidence">
      <div class="empty-icon" aria-hidden="true">⌁</div>
      <strong>لا توجد أدلة بعد</strong>
      <p>ابدأ بموضوع محدد. ستظهر هنا النصوص والمراجع وحالة التحقق.</p>
    </div>`;
}

function addUserMessage(text) {
  const message = document.createElement('div');
  message.className = 'user-message';
  message.textContent = text;
  qs('#conversation').append(message);
}

function addLoading() {
  const fragment = qs('#loading-template').content.cloneNode(true);
  qs('#conversation').append(fragment);
}

function addPlan() {
  qs('.loading-message')?.remove();
  const fragment = qs('#result-template').content.cloneNode(true);
  qs('#conversation').append(fragment);
  qs('#approve-plan').addEventListener('click', collectEvidence);
}

function submitTopic(text) {
  const clean = text.trim();
  if (!clean || state.busy) return;
  state.busy = true;
  qs('#welcome').hidden = true;
  qs('#message').value = '';
  addUserMessage(clean);
  addLoading();
  setStage(2);
  qs('#workspace-body').scrollTop = qs('#workspace-body').scrollHeight;
  window.setTimeout(() => {
    addPlan();
    state.busy = false;
    qs('#workspace-body').scrollTop = qs('#workspace-body').scrollHeight;
  }, 850);
}

function collectEvidence() {
  setStage(3);
  qs('#evidence-count').textContent = '3';
  qs('#inspector-content').innerHTML = `
    <article class="source-card">
      <header><span class="source-type">قرآن</span><span class="source-state">موثق</span></header>
      <blockquote>﴿إِنَّ اللَّهَ يَأْمُرُكُمْ أَنْ تُؤَدُّوا الْأَمَانَاتِ إِلَىٰ أَهْلِهَا﴾</blockquote>
      <b>سورة النساء، الآية 58</b><small>صلة مباشرة · السياق متاح</small>
    </article>
    <article class="source-card">
      <header><span class="source-type">تفسير</span><span class="source-state">سياق متاح</span></header>
      <blockquote>موضع توضيحي لتفسير الآية مع فصل كلام المفسر عن النص القرآني.</blockquote>
      <b>مصدر تجريبي غير متصل</b><small>يتطلب مطابقة المصدر قبل الاعتماد</small>
    </article>
    <article class="source-card">
      <header><span class="source-type">حديث</span><span class="source-state" style="color:#8b5a00;background:#fff0cc">مراجعة</span></header>
      <blockquote>حجز تصميمي لنتيجة الحديث حتى اكتمال الاتصال بالمصدر وحكم المحدث.</blockquote>
      <b>لا يوجد مرجع فعلي في النموذج</b><small>لا يعتمد في الحقيبة النهائية</small>
    </article>
    <section class="coverage-box">
      <header><h3>تغطية الموضوع</h3><strong>68%</strong></header>
      <div class="coverage-track"><span></span></div>
      <p>توجد بداية موثقة للمحور الأول. المحوران الثاني والثالث يحتاجان إلى أدلة ومراجعة إضافية.</p>
    </section>`;
  qs('#approve-plan').textContent = 'تم اعتماد الخطة';
  qs('#approve-plan').disabled = true;
  window.setTimeout(() => setStage(4), 650);
}

qsa('[data-prompt]').forEach((button) => button.addEventListener('click', () => submitTopic(button.dataset.prompt)));
qsa('.stage').forEach((button) => button.addEventListener('click', () => setStage(Number(button.dataset.stage))));
qs('#composer').addEventListener('submit', (event) => { event.preventDefault(); submitTopic(qs('#message').value); });
qs('#message').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); qs('#composer').requestSubmit(); }
});
qs('#message').addEventListener('input', (event) => {
  event.target.style.height = 'auto';
  event.target.style.height = `${Math.min(event.target.scrollHeight, 130)}px`;
});
qs('#new-session').addEventListener('click', reset);
