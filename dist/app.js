const state = { step: 1, view: "workspace", searching: false };

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

function showToast(message) {
  const toast = qs("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function setStep(nextStep) {
  state.step = nextStep;
  qsa(".workflow-panel").forEach((panel) => panel.classList.toggle("active", Number(panel.dataset.step) === nextStep));
  qsa("[data-step-marker]").forEach((marker) => {
    const markerStep = Number(marker.dataset.stepMarker);
    marker.classList.toggle("active", markerStep === nextStep);
    marker.classList.toggle("complete", markerStep < nextStep);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setView(view) {
  state.view = view;
  qsa(".view").forEach((section) => section.classList.toggle("active", section.id === view));
  qsa("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.toggleAttribute("aria-current", active);
  });
  qs("#page-title").textContent = view === "workspace" ? "حقيبة أدلة جديدة" : "مرجع الهوية والتجربة";
}

qsa("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
qsa("[data-back]").forEach((button) => button.addEventListener("click", () => setStep(Number(button.dataset.back))));

qs("#topic-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const topic = qs("#topic").value.trim();
  if (!topic) return;
  const audience = qs("#audience").value;
  const duration = qs("#duration").value;
  const goal = qs('input[name="goal"]:checked').value;
  qs("#plan-topic").textContent = topic;
  qs("#export-topic").textContent = topic;
  qs("#plan-meta").textContent = `${audience} · ${duration} · هدف ${goal}`;
  setStep(2);
});

qs("#approve-plan").addEventListener("click", () => {
  setStep(3);
  showToast("تم اعتماد الخطة. أصبحت جاهزة لجمع الأدلة.");
});

qs("#run-search").addEventListener("click", () => {
  if (state.searching) return;
  state.searching = true;
  const status = qs(".search-status");
  const rows = qsa("[data-source-row]");
  const button = qs("#run-search");
  status.classList.add("running");
  button.disabled = true;
  button.textContent = "المحاكاة جارية";
  rows.forEach((row) => { row.classList.remove("complete"); qs(".source-state", row).textContent = "في الانتظار"; });

  const stages = [
    [18, "تحليل المحاور وتكوين الاستعلامات", 0],
    [38, "فحص النص القرآني والسياق", 1],
    [61, "مطابقة الشروح والأحاديث", 2],
    [82, "ترتيب الأدلة وفحص المراجع", 3],
    [100, "اكتملت المحاكاة", 4],
  ];

  stages.forEach(([percent, title, completed], index) => {
    window.setTimeout(() => {
      qs("#search-percentage").textContent = `${percent}%`;
      qs("#search-title").textContent = title;
      rows.slice(0, completed).forEach((row) => { row.classList.add("complete"); qs(".source-state", row).textContent = "اكتمل"; });
      if (percent === 100) {
        status.classList.remove("running");
        state.searching = false;
        button.disabled = false;
        button.textContent = "عرض الأدلة التجريبية";
        button.onclick = () => setStep(4);
        showToast("اكتملت المحاكاة. النتائج المعروضة بيانات تصميمية فقط.");
      }
    }, index * 600);
  });
});

qsa(".filter-chip").forEach((chip) => chip.addEventListener("click", () => {
  qsa(".filter-chip").forEach((item) => item.classList.remove("active"));
  chip.classList.add("active");
  const filter = chip.dataset.filter;
  qsa(".evidence-card").forEach((card) => { card.hidden = filter !== "all" && card.dataset.type !== filter; });
}));

qs("#continue-export").addEventListener("click", () => setStep(5));
qs("#export-demo").addEventListener("click", () => showToast("المعاينة جاهزة. إنشاء الملف الفعلي سيُربط في مرحلة التطوير."));
qs("#theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("light");
  showToast(document.body.classList.contains("light") ? "تم تفعيل المظهر الفاتح" : "تم تفعيل المظهر الداكن");
});

qsa(".approve-control input:not(:disabled)").forEach((input) => input.addEventListener("change", () => {
  showToast(input.checked ? "تم اعتماد البطاقة في النموذج" : "أُزيل اعتماد البطاقة");
}));
