const CONFIG = {
  healthSearchUrl: "https://www.health.kr/searchDrug/search_total_result.asp",
  maxRecent: 8,
};

const $ = (id) => document.getElementById(id);

const els = {
  tabs: document.querySelectorAll(".bottom-tabs button"),
  panels: document.querySelectorAll(".tab-panel"),
  form: $("searchForm"),
  input: $("drugInput"),
  saveFavorite: $("saveFavoriteBtn"),
  recentList: $("recentList"),
  favoriteList: $("favoriteList"),
  cardList: $("cardList"),
  clearHistory: $("clearHistoryBtn"),
  clearFavorites: $("clearFavoritesBtn"),
  toast: $("toast"),
  cardButtons: document.querySelectorAll('[data-action="cards"]'),
};

const store = {
  recent: "drugSearch.recent",
  favorites: "drugSearch.favorites",
};

const doseUnitToMg = { g: 1000, mg: 1, mcg: 0.001 };
const volumeUnitToMl = { L: 1000, mL: 1 };
const timeUnitToHours = { hr: 1, min: 1 / 60 };
const timeUnitToMinutes = { hr: 60, min: 1 };
const FIXED_DROP_FACTOR = 20;

const calculatorConfigs = [
  {
    inputIds: ["totalVolumeRate", "infusionTimeRate"],
    unitIds: ["totalVolumeRateUnit", "infusionTimeRateUnit"],
    outputId: "fluidRateResult",
    errorId: "fluidRateError",
    unit: "mL/hr",
    calculate: () => {
      const totalMl = toMl($("totalVolumeRate").value, $("totalVolumeRateUnit").value);
      const hours = toHours($("infusionTimeRate").value, $("infusionTimeRateUnit").value);
      if (!isPositive(totalMl) || !isPositive(hours)) {
        setDropResults(null);
        return null;
      }
      const mlPerHour = totalMl / hours;
      const gttPerMinute = (mlPerHour * FIXED_DROP_FACTOR) / 60;
      const secondsPerDrop = 60 / gttPerMinute;
      setDropResults({ gttPerMinute, secondsPerDrop });
      return { value: mlPerHour };
    },
  },
  {
    inputIds: ["drugAmount", "totalVolume", "prescribedDose"],
    unitIds: ["drugAmountUnit", "totalVolumeUnit", "prescribedDoseUnit"],
    outputId: "proportionResult",
    errorId: "proportionError",
    unit: "mL",
    calculate: calculateProportion,
  },
  {
    inputIds: ["heightCm", "weightKgBsa"],
    outputId: "bsaResult",
    errorId: "bsaError",
    unit: "m²",
    calculate: () => {
      const heightCm = readNumber("heightCm");
      const weightKg = readNumber("weightKgBsa");
      if (!isPositive(heightCm) || !isPositive(weightKg)) return null;
      return { value: Math.sqrt((heightCm * weightKg) / 3600) };
    },
  },
  {
    inputIds: ["age", "weightKgCrcl", "scr"],
    unitIds: ["sex"],
    outputId: "crclResult",
    errorId: "crclError",
    unit: "",
    calculate: () => {
      const age = readNumber("age");
      const weightKg = readNumber("weightKgCrcl");
      const scr = readNumber("scr");
      if (!isPositive(age) || !isPositive(weightKg) || !isPositive(scr)) return null;
      const maleValue = ((140 - age) * weightKg) / (72 * scr);
      const gfr = $("sex").value === "female" ? maleValue * 0.85 : maleValue;
      const carboDose = 2 * (gfr + 25);
      return {
        value: gfr,
        text: `GFR ${formatResult(gfr, "mL/min")} / Carbo dose ${formatResult(carboDose, "mg")}`,
      };
    },
  },
];

let toastTimer = null;

function normalize(value) {
  return value.trim().replace(/\s+/g, " ");
}

function readNumber(id) {
  const rawValue = $(id).value;
  return rawValue === "" ? NaN : Number(rawValue);
}

function isPositive(value) {
  return Number.isFinite(value) && value > 0;
}

function toMg(value, unit) {
  const number = Number(value);
  return Number.isFinite(number) ? number * doseUnitToMg[unit] : NaN;
}

function toMl(value, unit) {
  const number = Number(value);
  return Number.isFinite(number) ? number * volumeUnitToMl[unit] : NaN;
}

function toHours(value, unit) {
  const number = Number(value);
  return Number.isFinite(number) ? number * timeUnitToHours[unit] : NaN;
}

function toMinutes(value, unit) {
  const number = Number(value);
  return Number.isFinite(number) ? number * timeUnitToMinutes[unit] : NaN;
}

function formatDoseMg(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}

function formatResult(value, unit) {
  return `${value.toFixed(2).replace(/\.?0+$/, "")}${unit ? ` ${unit}` : ""}`;
}

function calculateProportion() {
  const drugAmountMg = toMg($("drugAmount").value, $("drugAmountUnit").value);
  const volumeMl = toMl($("totalVolume").value, $("totalVolumeUnit").value);
  const prescribedMg = toMg($("prescribedDose").value, $("prescribedDoseUnit").value);
  const formulaLine = $("proportionFormulaLine");

  if (!isPositive(drugAmountMg) || !isPositive(volumeMl) || !isPositive(prescribedMg)) {
    formulaLine.textContent = "";
    return null;
  }

  const value = (prescribedMg * volumeMl) / drugAmountMg;
  const drugText = formatDoseMg(drugAmountMg);
  const doseText = formatDoseMg(prescribedMg);
  const volumeText = formatResult(volumeMl, "mL").replace(" mL", "");
  const resultText = formatResult(value, "mL").replace(" ", "");
  formulaLine.textContent = `${drugText}mg : ${volumeText}mL = ${doseText}mg : x\nx = ${doseText} × ${volumeText} ÷ ${drugText} = ${resultText}`;
  return { value };
}

function readList(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeList(key, values) {
  localStorage.setItem(key, JSON.stringify(values));
}

function addRecent(term) {
  const next = [term, ...readList(store.recent).filter((item) => item !== term)];
  writeList(store.recent, next.slice(0, CONFIG.maxRecent));
  renderLists();
}

function addFavorite(term) {
  const current = readList(store.favorites);
  if (!current.includes(term)) writeList(store.favorites, [term, ...current]);
  renderLists();
  showToast(`즐겨찾기에 저장했습니다: ${term}`);
}

function removeFromList(key, term) {
  writeList(key, readList(key).filter((item) => item !== term));
  renderLists();
}

function getTerm() {
  return normalize(els.input.value);
}

async function copyText(text) {
  if (!navigator.clipboard || !text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function buildHealthSearchUrl(term) {
  const url = new URL(CONFIG.healthSearchUrl);
  url.searchParams.set("search_word", term);
  url.searchParams.set("search_flag", "all");
  return url.toString();
}

function openHealthSearch(term = getTerm()) {
  if (!term) {
    showToast("약물명을 먼저 입력하세요.");
    els.input.focus();
    return;
  }
  addRecent(term);
  window.open(buildHealthSearchUrl(term), "_blank", "noopener,noreferrer");
  showToast("약학정보원 검색 결과를 열었습니다.");
}

function openCards() {
  renderLists();
  switchTab("favorites");
}

function switchTab(tabName) {
  els.tabs.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tabName));
  els.panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === tabName));
  document.body.classList.toggle("icu-fullscreen", tabName === "icu");
}

function makeChip(term, key) {
  const chip = document.createElement("span");
  chip.className = "chip";

  const label = document.createElement("button");
  label.type = "button";
  label.className = "chip-label";
  label.textContent = term;
  label.addEventListener("click", () => {
    els.input.value = term;
    switchTab("search");
    els.input.focus();
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove";
  remove.textContent = "×";
  remove.title = "삭제";
  remove.setAttribute("aria-label", `${term} 삭제`);
  remove.addEventListener("click", () => removeFromList(key, term));

  chip.append(label, remove);
  return chip;
}

function renderChipList(container, values, key) {
  container.textContent = "";
  container.classList.toggle("empty-list", values.length === 0);
  if (values.length === 0) {
    container.textContent = "아직 없습니다";
    return;
  }
  values.forEach((term) => container.append(makeChip(term, key)));
}

function renderCardPreview() {
  const values = readList(store.favorites);
  els.cardList.textContent = "";
  els.cardList.classList.toggle("empty-list", values.length === 0);
  if (values.length === 0) {
    els.cardList.textContent = "아직 없습니다";
    return;
  }
  values.slice(0, 5).forEach((term) => {
    const link = document.createElement("button");
    link.type = "button";
    link.className = "card-link";
    link.textContent = term;
    const type = document.createElement("span");
    type.textContent = "저장됨";
    link.append(type);
    link.addEventListener("click", () => {
      els.input.value = term;
      switchTab("search");
      els.input.focus();
    });
    els.cardList.append(link);
  });
}

function renderLists() {
  renderChipList(els.recentList, readList(store.recent), store.recent);
  renderChipList(els.favoriteList, readList(store.favorites), store.favorites);
  renderCardPreview();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
}

function setCalculatorResult(config, text, copyValue = "") {
  const output = $(config.outputId);
  output.textContent = text;
  output.dataset.copyValue = copyValue;
}

function setDropResults(result) {
  const intervalOutput = $("dropIntervalResult");
  const minuteText = $("gttMinuteResult");

  if (!result || !isPositive(result.gttPerMinute) || !isPositive(result.secondsPerDrop)) {
    intervalOutput.textContent = "--";
    intervalOutput.dataset.copyValue = "";
    minuteText.textContent = "";
    return;
  }

  const intervalText = `${formatResult(result.secondsPerDrop, "초").replace(" ", "")}에 1방울`;
  intervalOutput.textContent = intervalText;
  intervalOutput.dataset.copyValue = intervalText;
  minuteText.textContent = `참고: ${formatResult(result.gttPerMinute, "gtt/min")}`;
}

function calculate(config) {
  const error = $(config.errorId);
  const result = config.calculate();

  if (!result || !isPositive(result.value)) {
    const unitText = config.unit ? ` ${config.unit}` : "";
    setCalculatorResult(config, `--${unitText}`);
    error.textContent = "값을 모두 입력하고 0보다 큰 숫자를 넣어주세요.";
    return;
  }

  const unit = result.unit || config.unit;
  const formatted = result.text || formatResult(result.value, unit);
  setCalculatorResult(config, formatted, formatted);
  error.textContent = "";
}

function bindCalculatorEvents() {
  calculatorConfigs.forEach((config) => {
    [...config.inputIds, ...(config.unitIds || [])].forEach((id) => {
      const element = $(id);
      const eventName = element.tagName === "SELECT" ? "change" : "input";
      element.addEventListener(eventName, () => calculate(config));
    });
  });

  document.querySelectorAll(".copy-result").forEach((button) => {
    button.addEventListener("click", async () => {
      const output = $(button.dataset.copyTarget);
      const value = output.dataset.copyValue || "";
      if (!value) {
        showToast("계산할 값을 먼저 입력하세요.");
        return;
      }
      const copied = await copyText(value);
      showToast(copied ? `${value}을 복사했습니다.` : "이 브라우저에서 자동 복사가 차단되었습니다.");
    });
  });
}

function bindSearchEvents() {
  els.tabs.forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    openHealthSearch();
  });

  els.saveFavorite.addEventListener("click", () => {
    const term = getTerm();
    if (!term) {
      showToast("약물명을 먼저 입력하세요.");
      els.input.focus();
      return;
    }
    addFavorite(term);
  });

  els.clearHistory.addEventListener("click", () => {
    writeList(store.recent, []);
    renderLists();
  });

  els.clearFavorites.addEventListener("click", () => {
    writeList(store.favorites, []);
    renderLists();
  });

  els.cardButtons.forEach((button) => button.addEventListener("click", openCards));
}

bindSearchEvents();
bindCalculatorEvents();
renderLists();
