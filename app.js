const creditTypes = ["general", "sd25", "sd20"];

const simulationPresets = {
  all: {
    pools: {
      general: { label: "通用积分", total: 23100, available: 11700 },
      sd25: { label: "SD 2.5积分", total: 8280, available: 5880 },
      sd20: { label: "SD 2.0积分", total: 5462, available: 3862 },
    },
    seats: { used: 2, total: 3 },
    members: [
      {
        id: 1,
        name: "用户5382311869083",
        role: "创建者",
        avatar: "用",
        avatarClass: "owner",
        consumed: { general: 0, sd25: 0, sd20: 0 },
        joined: "2026-09-08 21:14",
        credits: { general: 5700, sd25: 1200, sd20: 800 },
        locked: true,
      },
      {
        id: 2,
        name: "陈俊生",
        role: "管理员",
        avatar: "陈",
        avatarClass: "admin",
        consumed: { general: 0, sd25: 0, sd20: 0 },
        joined: "2026-09-09 21:36",
        credits: { general: 5700, sd25: 1200, sd20: 800 },
      },
    ],
  },
  general: {
    pools: {
      general: { label: "通用积分", total: 23100, available: 7700 },
      sd25: { label: "SD 2.5积分", total: 0, available: 0 },
      sd20: { label: "SD 2.0积分", total: 0, available: 0 },
    },
    seats: { used: 2, total: 3 },
    members: [
      {
        id: 1,
        name: "用户5382311869083",
        role: "创建者",
        avatar: "用",
        avatarClass: "owner",
        consumed: { general: 0, sd25: 0, sd20: 0 },
        joined: "2026-09-08 21:14",
        credits: { general: 7700, sd25: 0, sd20: 0 },
        locked: true,
      },
      {
        id: 2,
        name: "陈俊生",
        role: "管理员",
        avatar: "陈",
        avatarClass: "admin",
        consumed: { general: 0, sd25: 0, sd20: 0 },
        joined: "2026-09-09 21:36",
        credits: { general: 7700, sd25: 0, sd20: 0 },
      },
    ],
  },
};

function cloneSimulationPreset(mode) {
  const preset = JSON.parse(JSON.stringify(simulationPresets[mode]));
  creditTypes.forEach(type => { preset.pools[type].total = preset.pools[type].available + preset.members.reduce((sum, member) => sum + member.credits[type], 0); });
  return preset;
}

const initialSimulation = cloneSimulationPreset("all");

const state = {
  activeView: "team",
  activeTab: "credits",
  creditScheme: "overview",
  activeCreditType: "general",
  memberCreditTypes: Object.fromEntries(initialSimulation.members.map((member) => [member.id, "general"])),
  detailAnalysisTab: "model",
  detailLedgerTab: "acquired",
  simulationMode: "all",
  consumptionMode: "on",
  pools: initialSimulation.pools,
  perSeat: { general: 800, sd25: 400, sd20: 240 },
  seats: initialSimulation.seats,
  members: initialSimulation.members,
  pendingInvites: [],
  transactions: [],
  rechargeCredits: 0,
  giftCredits: 0,
  draftCreditsByMember: {},
  shortage: null,
  modal: null,
};

const numberFormat = new Intl.NumberFormat("zh-CN");
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function format(value) {
  return numberFormat.format(value);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sumCredits(credits) {
  return creditTypes.reduce((sum, key) => sum + Number(credits[key] || 0), 0);
}

function memberTotal(member) {
  return sumCredits(member.credits);
}

function resetMemberDraft(member) {
  state.draftCreditsByMember[member.id] = { ...member.credits };
}

function resetAllMemberDrafts() {
  state.draftCreditsByMember = Object.fromEntries(state.members.map((member) => [member.id, { ...member.credits }]));
}

function memberDraft(member) {
  if (!state.draftCreditsByMember[member.id]) resetMemberDraft(member);
  return state.draftCreditsByMember[member.id];
}

function memberDraftChanged(member) {
  const draft = memberDraft(member);
  return creditTypes.some((type) => String(draft[type]) !== String(member.credits[type]));
}

function hasPendingCreditChanges() {
  return state.members.some(memberDraftChanged);
}

function consumedTotal(member) {
  return sumCredits(member.consumed);
}

function assignedForType(type) {
  return state.members.reduce((sum, member) => sum + member.credits[type], 0);
}

function assignedTotal() {
  return creditTypes.reduce((sum, type) => sum + assignedForType(type), 0);
}

function availableTotal() {
  return creditTypes.reduce((sum, type) => sum + state.pools[type].available, 0);
}

function remainingTotal() {
  return assignedTotal() + availableTotal();
}

function avatarMarkup(member) {
  return `<span class="avatar ${member.avatarClass}" aria-hidden="true">${escapeHTML(member.avatar)}</span>`;
}

function staticRoleMarkup(member) {
  return `<div class="role-cell"><span>${escapeHTML(member.role)}</span></div>`;
}

function pointMarkup(value) {
  return `<div class="point-value"><span class="point-gem" aria-hidden="true">✦</span><span>${format(value)}</span></div>`;
}

function renderMemberRows() {
  const rows = state.members.map((member) => `
    <div class="data-table member-table table-row" data-member-id="${member.id}">
      <div class="user-cell">${avatarMarkup(member)}<span class="user-name">${escapeHTML(member.name)}</span></div>
      ${staticRoleMarkup(member)}
      ${pointMarkup(consumedTotal(member))}
      ${pointMarkup(memberTotal(member))}
      <div>${member.joined}</div>
      <div>${member.locked ? '<span class="empty-action">—</span>' : `<button class="action-link danger" data-delete="${member.id}">删除</button>`}</div>
    </div>
  `).join("");
  $("#memberRows").innerHTML = rows || emptyRows("暂无团队成员");
}

function visibleCreditTypes() {
  return state.simulationMode === "general" ? ["general"] : creditTypes;
}

function renderPointCards() {
  const type = state.activeCreditType;
  const pool = state.pools[type];
  const overviewScheme = state.creditScheme !== "tabs";
  const deltaScheme = state.creditScheme === "delta";
  $("#panel-credits").classList.toggle("is-scheme-overview", overviewScheme);
  $("#panel-credits").classList.toggle("is-scheme-tabs", state.creditScheme === "tabs");
  $("#panel-credits").classList.toggle("is-scheme-delta", deltaScheme);
  $$('[data-credit-scheme]').forEach((button) => {
    const active = button.dataset.creditScheme === state.creditScheme;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  $("#creditTypeTabs").innerHTML = visibleCreditTypes().map((key) => `<button type="button" class="credit-subtab${key === type ? ' is-active' : ''}" id="credit-tab-${key}" role="tab" aria-selected="${key === type}" aria-controls="creditTypeContent" tabindex="${key === type ? 0 : -1}" data-credit-tab="${key}">${key === 'general' ? '通用积分' : key === 'sd25' ? 'SD 2.5' : 'SD 2.0'}</button>`).join('');
  $("#creditTypeTabs").hidden = overviewScheme;
  $("#creditTypeContent").setAttribute("aria-labelledby", "credit-tab-" + type);
  $("#pointsOverview").classList.toggle("is-all-types", overviewScheme);
  $("#pointsOverview").innerHTML = overviewScheme
    ? visibleCreditTypes().map((key) => `<div class="pool-summary-item"><span>${key === "general" ? "通用" : key === "sd25" ? "SD 2.5" : "SD 2.0"}待分配积分</span><strong>${format(state.pools[key].available)}</strong></div>`).join("")
    : `<div class="unallocated-summary"><span>待分配${pool.label}</span><strong>${format(pool.available)}</strong></div><p class="allocation-guidance">支持成员积分灵活调配，回收的积分将归入此处</p>`;
}

function selectCreditScheme(scheme, focus = false) {
  if (!["overview", "tabs", "delta"].includes(scheme) || scheme === state.creditScheme) return;
  state.creditScheme = scheme;
  renderPointCards();
  renderPointsRows();
  if (focus) $(`[data-credit-scheme="${scheme}"]`)?.focus();
}

function selectCreditTab(type, focus = false) {
  if (!visibleCreditTypes().includes(type)) return;
  state.activeCreditType = type;
  renderPointCards();
  renderPointsRows();
  if (focus) $("#credit-tab-" + type).focus();
}

function renderSimulationSwitch() {
  $$('[data-consumption]').forEach(button => {
    const active = button.dataset.consumption === state.consumptionMode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $$('[data-simulation-mode]').forEach((button) => {
    const active = button.dataset.simulationMode === state.simulationMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function allocationStepperMarkup(member, type, field) {
  const before = member.credits[type];
  const after = Number(memberDraft(member)[type]);
  const maxAfter = before + state.pools[type].available;
  const value = field === "after" ? after : after - before;
  const min = field === "after" ? 0 : -before;
  const max = field === "after" ? maxAfter : state.pools[type].available;
  const fieldLabel = field === "after" ? "调后" : "调整额";
  return `<div class="allocation-stepper"><button type="button" data-draft-delta="-100" data-draft-field="${field}" data-member="${member.id}" data-credit-type="${type}" aria-label="${state.pools[type].label}${fieldLabel}减少100"${value <= min ? " disabled" : ""}><img src="./assets/step-minus.png" alt="" /></button><input type="number" min="${min}" max="${max}" step="1" value="${escapeHTML(value)}" data-draft-input data-draft-field="${field}" data-member="${member.id}" data-credit-type="${type}" aria-label="${state.pools[type].label}${fieldLabel}" /><button type="button" data-draft-delta="100" data-draft-field="${field}" data-member="${member.id}" data-credit-type="${type}" aria-label="${state.pools[type].label}${fieldLabel}增加100"${value >= max ? " disabled" : ""}><img src="./assets/step-plus.png" alt="" /></button></div>`;
}

function allocationInputMarkup(member, type) {
  const before = member.credits[type];
  const max = before + state.pools[type].available;
  return `<div class="allocation-input"><input type="number" min="0" max="${max}" step="1" value="${escapeHTML(Number(memberDraft(member)[type]))}" data-draft-input data-draft-field="after" data-member="${member.id}" data-credit-type="${type}" aria-label="${state.pools[type].label}调后" /></div>`;
}

function selectedMemberCreditType(memberId) {
  const selected = state.memberCreditTypes[memberId] || "general";
  return visibleCreditTypes().includes(selected) ? selected : "general";
}

function schemeCreditTypeSelector(member, selectedType) {
  return `<div class="scheme-credit-select"><select class="sr-only" tabindex="-1" aria-hidden="true" data-scheme-credit-type data-member-id="${member.id}">${visibleCreditTypes().map(type => `<option value="${type}"${type === selectedType ? " selected" : ""}>${escapeHTML(state.pools[type].label)}</option>`).join("")}</select><button class="credit-select-trigger" data-credit-menu="${member.id}" aria-label="${escapeHTML(member.name)}的积分类型" aria-haspopup="listbox" aria-expanded="false"><span>${escapeHTML(state.pools[selectedType].label)}</span><img src="./assets/chevron-down.svg" alt="" /></button></div>`;
}

function shortageTypes() {
  return state.shortage ? Object.keys(state.shortage.amounts).filter((type) => state.shortage.amounts[type] > 0) : [];
}

function isRecoveryCandidate(member) {
  return Boolean(
    state.shortage &&
    member.id !== state.editingMemberId &&
    shortageTypes().some((type) => member.credits[type] > 0)
  );
}

function readonlyCreditMarkup(member, type, candidate) {
  const classes = ["credit-readonly"];
  if (candidate && state.shortage.amounts[type] > 0 && member.credits[type] > 0) classes.push("candidate-credit");
  return `<div class="${classes.join(" ")}">${format(member.credits[type])}</div>`;
}

function rowActionMarkup(member) {
  const changed = memberDraftChanged(member);
  return `<div class="row-actions allocation-editor-actions"><button class="action-link confirm-link" data-confirm-member="${member.id}"${changed ? "" : " disabled"}>确认</button>${changed ? `<button class="action-link" data-undo-member="${member.id}">撤销</button>` : ""}</div>`;
}

function renderPointsRows() {
  const type = state.activeCreditType;
  const overviewScheme = state.creditScheme === "overview";
  const deltaScheme = state.creditScheme === "delta";
  $("#pointsTableHead").className = `data-table points-table table-head ${deltaScheme ? "scheme-three-table" : overviewScheme ? "scheme-one-table" : "scheme-two-table"}`;
  $("#pointsTableHead").innerHTML = deltaScheme
    ? `<div>用户</div><div>团队角色</div><div>已消耗</div><div>调整前 <span class="info-dot" title="成员当前可用积分">i</span></div><div>积分类型 <span class="info-dot" title="选择本次调配的积分类型">i</span></div><div>调整后</div><div>调整额 <span class="info-dot" title="本次增加或减少的积分">i</span></div><div>操作 <span class="info-dot" title="调整成员可用积分">i</span></div>`
    : overviewScheme
    ? `<div>用户</div><div>团队角色</div><div>已消耗</div><div>积分类型 <span class="info-dot" title="选择本次调配的积分类型">i</span></div><div>剩余积分</div><div>操作 <span class="info-dot" title="调整成员可用积分">i</span></div>`
    : `<div>用户</div><div>团队角色</div><div>已消耗</div><div>剩余积分</div><div>操作 <span class="info-dot" title="调整成员可用积分">i</span></div>`;
  $("#pointsRows").innerHTML = state.members.map((member) => {
    const rowClasses = ["data-table", "points-table", "table-row", deltaScheme ? "scheme-three-table" : overviewScheme ? "scheme-one-table" : "scheme-two-table"];
    const action = rowActionMarkup(member);

    if (deltaScheme) {
      const rowType = selectedMemberCreditType(member.id);
      const before = member.credits[rowType];
      return `<div class="${rowClasses.join(" ")}" data-member-id="${member.id}">
        <div class="user-cell">${avatarMarkup(member)}<span class="member-identity"><span class="user-name">${escapeHTML(member.name)}</span></span></div>
        ${staticRoleMarkup(member)}
        ${pointMarkup(member.consumed[rowType])}
        ${pointMarkup(before)}
        ${schemeCreditTypeSelector(member, rowType)}
        ${allocationInputMarkup(member, rowType)}
        ${allocationStepperMarkup(member, rowType, "delta")}
        <div class="points-operation">${action}</div>
      </div>`;
    }

    if (overviewScheme) {
      const rowType = selectedMemberCreditType(member.id);
      return `<div class="${rowClasses.join(" ")}" data-member-id="${member.id}">
        <div class="user-cell">${avatarMarkup(member)}<span class="member-identity"><span class="user-name">${escapeHTML(member.name)}</span></span></div>
        ${staticRoleMarkup(member)}
        ${pointMarkup(member.consumed[rowType])}
        ${schemeCreditTypeSelector(member, rowType)}
        ${allocationStepperMarkup(member, rowType, "after")}
        <div class="points-operation">${action}</div>
      </div>`;
    }

    return `<div class="${rowClasses.join(" ")}" data-member-id="${member.id}">
      <div class="user-cell">${avatarMarkup(member)}<span class="member-identity"><span class="user-name">${escapeHTML(member.name)}</span></span></div>
      ${staticRoleMarkup(member)}
      ${pointMarkup(member.consumed[type])}
      ${allocationStepperMarkup(member, type, "after")}
      <div class="points-operation">${action}</div>
    </div>`;
  }).join("");
}

function renderShortageBanner() {
  const banner = $("#shortageBanner");
  banner.hidden = !state.shortage;
  banner.innerHTML = state.shortage ? '团队待分配积分不足，请减少调配数量，或取消本次编辑后先回收其他成员积分。' : "";
}

function renderSummary() {
  const assigned = assignedTotal();
  const available = availableTotal();
  const total = assigned + available;
  const consumed = teamConsumedTotal();
  const gross = total + consumed;
  const remainingPercent = gross ? Math.round(total / gross * 100) : 0;
  const first = gross ? available / gross * 100 : 0;
  const second = gross ? (available + assigned) / gross * 100 : 0;
  $("#allocationDonut").style.background = gross ? `conic-gradient(var(--credit-purple) 0 ${first}%, var(--credit-purple-light) ${first}% ${second}%, #e1e3e6 ${second}% 100%)` : '#e1e3e6';
  $("#headerCredit").textContent = format(state.members.find(member => member.locked)?.credits ? memberTotal(state.members.find(member => member.locked)) : 0);
  $("#availableTotal").textContent = format(total);
  $("#unallocatedSummaryTotal").textContent = format(available);
  $("#assignedSummaryTotal").textContent = format(assigned);
  $("#tooltipUnallocated").textContent = format(available);
  $("#tooltipAssigned").textContent = format(assigned);
  $("#tooltipConsumed").textContent = format(consumed);
  $("#remainingPercent").textContent = `${remainingPercent}%`;
  $("#allocationDonut").setAttribute("aria-label", `积分剩余 ${remainingPercent}%，剩余总积分 ${format(total)}`);
  $("#seatUsed").textContent = String(state.seats.used);
  $("#seatTotal").textContent = String(state.seats.total);
}

function renderInvites() {
  const root = $("#invitePanelContent");
  if (!state.pendingInvites.length) {
    root.innerHTML = `
      <div class="invite-state">
        <div class="empty-illustration" aria-hidden="true">＋</div>
        <h2>暂无待审批申请</h2>
        <p>成员接受邀请后，将在这里等待团队管理员审批。</p>
        <button class="secondary-button" data-action="invite">邀请成员</button>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="approval-card">
      <div class="approval-row is-head"><div>申请人</div><div>申请角色</div><div>申请时间</div><div>操作</div></div>
      ${state.pendingInvites.map((invite) => `
        <div class="approval-row">
          <div>${escapeHTML(invite.email)}</div>
          <div>${escapeHTML(invite.role)}</div>
          <div>${invite.time}</div>
          <div class="row-actions"><button class="action-link confirm-link" data-approve-invite="${invite.id}">同意</button><button class="action-link" data-reject-invite="${invite.id}">拒绝</button></div>
        </div>
      `).join("")}
    </div>
  `;
}

function teamConsumedTotal() {
  return state.members.reduce((sum, member) => sum + consumedTotal(member), 0);
}

function detailRankingData() {
  const total = teamConsumedTotal();
  if (state.detailAnalysisTab === "project") {
    return [
      { name: "团队内容项目", value: total },
      { name: "未归属项目", value: 0 },
    ];
  }
  return [
    { name: "小云雀 AnyCook · 3K", value: total },
    { name: "Seedream 4.0 美感版 · 2K", value: 0 },
  ];
}

function renderDetailRanking() {
  const title = state.detailAnalysisTab === "model" ? "模型消耗排行" : "项目消耗排行";
  const ranking = detailRankingData();
  const max = Math.max(...ranking.map((item) => item.value), 0);
  $("#detailRankingTitle").textContent = title;
  $("#detailRankingList").innerHTML = ranking.map((item, index) => {
    const width = max > 0 ? Math.round((item.value / max) * 100) : 0;
    return `
      <div class="detail-ranking-row">
        <span class="detail-ranking-index">${index + 1}</span>
        <span class="detail-ranking-name">${escapeHTML(item.name)}</span>
        <span class="detail-ranking-bar" aria-label="${escapeHTML(item.name)}消耗${format(item.value)}积分"><i style="width:${width}%"></i></span>
        <span class="detail-ranking-value">${format(item.value)}</span>
      </div>
    `;
  }).join("");
}

function renderDetailLedger() {
  const acquired = state.detailLedgerTab === "acquired";
  $("#detailLedgerHead").innerHTML = acquired
    ? "<div>获取时间</div><div>获取来源</div><div>成员名称</div><div>获取积分</div>"
    : "<div>消耗时间</div><div>消耗来源</div><div>成员名称</div><div>消耗积分</div>";

  if (acquired) {
    const purchaseRows = state.transactions
      .filter((item) => item.action === "购买入账")
      .map((item) => `
        <div class="detail-ledger-table detail-ledger-row">
          <div>${item.time.replaceAll("-", "/")}</div>
          <div>购买充值积分 · ${escapeHTML(state.pools[item.type].label)}</div>
          <div>团队</div>
          <div>+${format(item.amount)}</div>
        </div>
      `).join("");
    $("#detailLedgerRows").innerHTML = `${purchaseRows}
      <div class="detail-ledger-table detail-ledger-row">
        <div>2026/09/08 21:14</div>
        <div>团队会员积分</div>
        <div>团队</div>
        <div>+${format(creditTypes.reduce((sum, type) => sum + simulationPresets[state.simulationMode].pools[type].available + simulationPresets[state.simulationMode].members.reduce((n, member) => n + member.credits[type], 0), 0))}</div>
      </div>
    `;
    return;
  }

  const consumedRows = state.members.flatMap((member) => creditTypes
    .filter((type) => member.consumed[type] > 0)
    .map((type) => `
      <div class="detail-ledger-table detail-ledger-row">
        <div>${member.joined.replaceAll("-", "/")}</div>
        <div>${escapeHTML(state.pools[type].label)}消耗</div>
        <div>${escapeHTML(member.name)}</div>
        <div>-${format(member.consumed[type])}</div>
      </div>
    `));
  $("#detailLedgerRows").innerHTML = consumedRows.join("") || '<div class="detail-ledger-empty">暂无消耗记录</div>';
}

function renderPointsDetail() {
  if (!$("#pointsDetailView")) return;
  const available = remainingTotal();
  const subscription = Math.max(0, available - state.rechargeCredits - state.giftCredits);
  const consumed = teamConsumedTotal();
  const consumedCount = state.members.reduce((count, member) => count + creditTypes.filter((type) => member.consumed[type] > 0).length, 0);

  $("#detailAvailableTotal").textContent = format(available);
  $("#detailSubscriptionTotal").textContent = format(subscription);
  $("#detailRechargeTotal").textContent = format(state.rechargeCredits);
  $("#detailGiftTotal").textContent = format(state.giftCredits);
  $("#detailConsumedTotal").textContent = format(consumed);
  $("#detailConsumedCount").textContent = format(consumedCount);

  $$('[data-detail-analysis-tab]').forEach((button) => {
    const active = button.dataset.detailAnalysisTab === state.detailAnalysisTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $$('[data-detail-ledger-tab]').forEach((button) => {
    const active = button.dataset.detailLedgerTab === state.detailLedgerTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  renderDetailRanking();
  renderDetailLedger();
}

function renderAll() {
  renderSimulationSwitch();
  renderMemberRows();
  renderPointCards();
  renderPointsRows();
  renderShortageBanner();
  renderSummary();
  renderInvites();
  renderPointsDetail();
}

function emptyRows(message) {
  return `<div style="height:180px;display:grid;place-items:center;color:#8e8e96">${message}</div>`;
}

function switchTab(tabName) {
  state.activeTab = tabName;
  $$(".tab").forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  $$(".tab-panel").forEach((panel) => {
    const active = panel.id === `panel-${tabName}`;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
}

function setView(view, { updateHistory = true, intent = "details" } = {}) {
  const showingDetail = view === "points-detail";
  state.activeView = showingDetail ? "points-detail" : "team";
  $("#teamManagementView").hidden = showingDetail;
  $("#pointsDetailView").hidden = !showingDetail;
  document.body.classList.toggle("is-points-detail", showingDetail);
  document.title = showingDetail ? "积分明细 · 团队管理" : "团队管理 · 交互 Demo";

  if (updateHistory) {
    const target = showingDetail ? "#points-details" : `${window.location.pathname}${window.location.search}`;
    if (showingDetail ? window.location.hash !== "#points-details" : Boolean(window.location.hash)) {
      window.history.pushState({ view: state.activeView }, "", target);
    }
  }

  window.scrollTo({ top: 0, behavior: "auto" });
  if (!showingDetail) return;
  renderPointsDetail();

  const purchaseCard = $("#detailPurchaseCard");
  purchaseCard.classList.toggle("is-highlighted", intent === "purchase");
  if (intent === "purchase") {
    window.setTimeout(() => $("#detailBuyButton")?.focus(), 80);
    window.setTimeout(() => purchaseCard.classList.remove("is-highlighted"), 1600);
  }
}

function showPointsDetailPage(intent = "details", updateHistory = true) {
  if (!$("#modalBackdrop").hidden) closeModal();
  setView("points-detail", { updateHistory, intent });
}

function showTeamManagementPage(updateHistory = true) {
  if (!$("#modalBackdrop").hidden) closeModal();
  setView("team", { updateHistory });
}

function syncViewFromLocation() {
  if (window.location.hash === "#points-details") showPointsDetailPage("details", false);
  else showTeamManagementPage(false);
}

function applySimulationMode(mode) {
  if (!simulationPresets[mode] || mode === state.simulationMode) return;
  const preset = cloneSimulationPreset(mode);
  if (!$("#modalBackdrop").hidden) closeModal();
  state.simulationMode = mode;
  if (mode === "general") state.activeCreditType = "general";
  state.pools = preset.pools;
  state.seats = preset.seats;
  state.members = preset.members;
  if (state.consumptionMode === "on") applyConsumption(true);
  state.memberCreditTypes = Object.fromEntries(preset.members.map((member) => [member.id, "general"]));
  state.pendingInvites = [];
  state.transactions = [];
  state.rechargeCredits = 0;
  state.giftCredits = 0;
  state.shortage = null;
  resetAllMemberDrafts();
  renderAll();
  showToast(mode === "all" ? "已切换至全积分模拟数据" : "已切换至仅通用积分模拟数据");
}

function calculateShortages(member, draft) {
  return creditTypes.reduce((shortages, type) => {
    const requested = Math.max(0, Math.round(Number(draft[type])));
    const increase = requested - member.credits[type];
    if (increase > state.pools[type].available) shortages[type] = increase - state.pools[type].available;
    return shortages;
  }, {});
}

function undoMemberCreditEdit(memberId) {
  const member = state.members.find((item) => item.id === Number(memberId));
  if (!member) return;
  resetMemberDraft(member);
  renderPointsRows();
  showToast(`已撤销 ${member.name} 的本次修改`);
}

function confirmMemberCreditEdit(memberId) {
  const member = state.members.find((item) => item.id === Number(memberId));
  if (!member) return;
  const draft = memberDraft(member);
  const invalid = visibleCreditTypes().some((type) => {
    const amount = Number(draft[type]);
    return String(draft[type]).trim() === "" || !Number.isSafeInteger(amount) || amount < 0;
  });
  if (invalid) {
    showToast("剩余积分请输入大于等于 0 的整数");
    return;
  }
  state.draftCreditsByMember[member.id] = creditTypes.reduce((normalized, type) => ({ ...normalized, [type]: Math.round(Number(draft[type])) }), {});
  const shortages = calculateShortages(member, state.draftCreditsByMember[member.id]);
  if (Object.keys(shortages).length) {
    showToast("待分配余额不足，请减少本次调整数值");
    return;
  }

  commitMemberCreditEdit(member);
}

function commitMemberCreditEdit(member, successMessage = "") {
  const draft = memberDraft(member);
  const changes = [];
  creditTypes.forEach((type) => {
    const previous = member.credits[type];
    const next = draft[type];
    const delta = next - previous;
    if (!delta) return;
    state.pools[type].available -= delta;
    member.credits[type] = next;
    changes.push({ type, delta });
    recordTransaction(member.name, type, Math.abs(delta), delta > 0 ? "手动分配" : "手动回收");
  });

  resetMemberDraft(member);
  renderAll();
  showToast(successMessage || (changes.length ? `已确认 ${member.name} 的积分调整` : "积分未发生变化"));
}

function recordTransaction(member, type, amount, action) {
  const now = new Date();
  const time = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now).replaceAll("/", "-");
  state.transactions.unshift({ time, member, type, amount, action });
}

function openModal(config) {
  state.modal = config;
  $("#modalTitle").textContent = config.title;
  $("#modalSubtitle").textContent = config.subtitle || "";
  $("#modalBody").innerHTML = config.body || "";
  $("#modalConfirm").textContent = config.confirmText || "确认";
  $("#modalConfirm").classList.toggle("danger", config.danger === true);
  $("#modalForm .modal-actions [data-close-modal]").hidden = config.readOnly === true;
  $("#modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  window.setTimeout(() => {
    const focusTarget = $("#modalBody input, #modalBody select") || $("#modalConfirm");
    focusTarget?.focus();
  }, 30);
}

function closeModal() {
  state.modal = null;
  $("#modalBackdrop").hidden = true;
  document.body.style.overflow = "";
  $("#modalForm").reset();
  $("#modalForm .modal-actions [data-close-modal]").hidden = false;
}

function openDeleteModal(memberId) {
  const member = state.members.find((item) => item.id === Number(memberId));
  if (!member || member.locked) return;
  openModal({
    type: "delete",
    memberId: member.id,
    title: "删除成员",
    subtitle: member.name,
    body: '<div class="warning-box"><strong>!</strong><span>删除后，该成员将无法继续访问团队空间，三类未使用积分会自动回收到团队待分配余额。</span></div>',
    confirmText: "确认删除",
    danger: true,
  });
}

function openInviteModal() {
  openModal({
    type: "invite",
    title: "邀请成员",
    subtitle: "成员接受邀请并通过审批后，系统按每席位额度自动发放积分",
    body: `
      <label class="form-field"><span>成员邮箱</span><input type="email" name="email" placeholder="name@example.com" required /></label>
      <label class="form-field"><span>团队角色</span><select name="role"><option>协作者</option><option>管理员</option></select></label>
      <div class="rule-note">每席位默认：通用积分 800、SD 2.5积分 400、SD 2.0积分 240；某类余额不足时，仅发放团队当时的剩余待分配积分。</div>
    `,
    confirmText: "发送邀请",
  });
}

function openRenameModal() {
  openModal({
    type: "rename",
    title: "修改团队名称",
    subtitle: "团队名称对所有成员可见",
    body: '<label class="form-field"><span>团队名称</span><input name="teamName" value="Team-12be3d2" maxlength="30" required /></label>',
    confirmText: "保存",
  });
}

function openBuyModal() {
  openModal({
    type: "buy",
    title: "购买充值积分",
    subtitle: "购买完成后，积分进入团队对应类型的待分配余额",
    body: `
      <label class="form-field"><span>积分类型</span><select name="creditType">${creditTypes.map((type) => `<option value="${type}">${state.pools[type].label}</option>`).join("")}</select></label>
      <label class="form-field"><span>购买数量</span><input type="number" name="amount" min="1" step="100" value="1000" required /></label>
    `,
    confirmText: "模拟购买",
  });
}

function openRecoveryModal(memberId) {
  const member = state.members.find((item) => item.id === Number(memberId));
  if (!member) return;
  const candidates = [state.activeCreditType].filter((type) => member.credits[type] > 0);
  if (!candidates.length) return;
  const firstType = candidates[0];
  const max = member.credits[firstType];
  openModal({
    type: "recovery",
    memberId: member.id,
    title: "回收成员积分",
    subtitle: `从 ${member.name} 的未使用积分转回团队待分配余额`,
    body: `
      <label class="form-field"><span>积分类型</span><select name="creditType" id="recoveryType">${candidates.map((type) => `<option value="${type}">${state.pools[type].label}</option>`).join("")}</select></label>
      <label class="form-field"><span>回收数量</span><input name="amount" id="recoveryAmount" type="number" min="1" max="${max}" value="${max}" step="1" required /></label>
      <div class="form-hint"><span>本次最多可回收</span><strong id="recoveryLimit">${format(max)}</strong></div>
      <div class="rule-note">回收数量不得超过该成员对应类型的未使用余额；回收后进入团队待分配余额。</div>
    `,
    confirmText: "确认回收",
  });
}

function buildShortageRecoveryPlan(targetMemberId) {
  const plan = [];
  const unresolved = {};
  shortageTypes().forEach((type) => {
    let remaining = state.shortage.amounts[type];
    state.members
      .filter((member) => member.id !== targetMemberId && member.credits[type] > 0)
      .forEach((member) => {
        if (remaining <= 0) return;
        const amount = Math.min(member.credits[type], remaining);
        plan.push({ memberId: member.id, memberName: member.name, type, amount });
        remaining -= amount;
      });
    if (remaining > 0) unresolved[type] = remaining;
  });
  return { plan, unresolved };
}

function openShortageModal(member) {
  const { plan, unresolved } = buildShortageRecoveryPlan(member.id);
  const canResolve = Object.keys(unresolved).length === 0;
  const rows = plan.map((item) => `
    <div class="shortage-modal-row">
      <span class="shortage-modal-source">从 <strong>${escapeHTML(item.memberName)}</strong> 回收</span>
      <strong class="shortage-modal-amount">${format(item.amount)} ${state.pools[item.type].label}</strong>
    </div>
  `).join("");

  openModal({
    type: canResolve ? "shortage-auto" : "read-only",
    memberId: member.id,
    recoveryPlan: plan,
    title: "待分配积分不足",
    subtitle: `为 ${member.name} 完成本次积分调配`,
    body: `
      <div class="shortage-modal-list">
        <div class="shortage-modal-list-title">回收明细</div>
        ${rows || '<div class="shortage-modal-empty">暂无可回收积分</div>'}
      </div>
      <p class="shortage-modal-intro">${canResolve ? "团队待分配余额不足，将按以上明细从其他成员的可用余额中回收后继续分配。" : "团队待分配余额不足，其他成员的可回收余额仍无法补足全部缺口。"}</p>
    `,
    confirmText: canResolve ? "一键回收并分配" : "知道了",
    readOnly: !canResolve,
  });
}

function autoRecoverAndAssign() {
  const targetMember = state.members.find((member) => member.id === state.modal?.memberId);
  if (!targetMember || !state.shortage || !state.draftCredits) return;
  const recoveryPlan = state.modal.recoveryPlan || [];
  const recoveredByType = recoveryPlan.reduce((totals, item) => {
    totals[item.type] = (totals[item.type] || 0) + item.amount;
    return totals;
  }, {});
  const canResolve = shortageTypes().every((type) =>
    (recoveredByType[type] || 0) >= state.shortage.amounts[type] &&
    recoveryPlan
      .filter((item) => item.type === type)
      .every((item) => state.members.find((member) => member.id === item.memberId)?.credits[type] >= item.amount)
  );
  if (!canResolve) {
    closeModal();
    showToast("可回收积分不足，暂无法完成分配");
    return;
  }

  let recoveredTotal = 0;
  recoveryPlan.forEach((item) => {
    const member = state.members.find((candidate) => candidate.id === item.memberId);
    member.credits[item.type] -= item.amount;
    state.pools[item.type].available += item.amount;
    recoveredTotal += item.amount;
    recordTransaction(member.name, item.type, item.amount, "一键回收");
  });

  recalculateShortage();
  closeModal();
  if (state.shortage) {
    renderAll();
    showToast("可回收积分不足，未完成分配");
    return;
  }
  commitCreditEdit(targetMember, `已回收 ${format(recoveredTotal)} 积分并完成分配`);
}

function recalculateShortage() {
  state.shortage = null;
}

function automaticCredits(name, action = "自动分配") {
  const credits = {};
  creditTypes.forEach(type => {
    const amount = Math.min(state.perSeat[type], state.pools[type].available);
    credits[type] = amount;
    state.pools[type].available -= amount;
    if (amount) recordTransaction(name, type, amount, action);
  });
  return credits;
}

function startNewCycle() {
  if (hasPendingCreditChanges()) {
    showToast("请先确认或撤销未提交的积分调整");
    return;
  }
  openModal({ type: "new-cycle", title: "模拟新周期发放", subtitle: "按购买商品的每席位积分量发放", body: `<div class="rule-note">每席位：${creditTypes.map(type => `${state.pools[type].label} ${format(state.perSeat[type])}`).join('、')}。按成员列表顺序发放，余额不足时发放该类型剩余积分。</div>`, confirmText: "模拟发放" });
}

function approveInvite(inviteId) {
  const invite = state.pendingInvites.find((item) => item.id === Number(inviteId));
  if (!invite) return;
  if (state.seats.used >= state.seats.total) {
    showToast("可用席位不足，请先增加席位");
    return;
  }

  const credits = automaticCredits(invite.email);
  const localName = invite.email.split("@")[0] || "新成员";
  state.members.push({
    id: Math.max(...state.members.map((member) => member.id), 0) + 1,
    name: localName,
    role: invite.role,
    avatar: localName.slice(0, 1).toUpperCase(),
    avatarClass: "collab",
    consumed: { general: 0, sd25: 0, sd20: 0 },
    joined: "2026-09-16 现在",
    credits,
  });
  state.seats.used += 1;
  state.pendingInvites = state.pendingInvites.filter((item) => item.id !== invite.id);
  renderAll();
  const partial = creditTypes.some((type) => credits[type] < state.perSeat[type]);
  showToast(partial ? "已通过审批；部分积分因团队余额不足按剩余量发放" : "已通过审批并按每席位额度自动发放积分");
}

function updateRecoveryLimit() {
  if (state.modal?.type !== "recovery") return;
  const member = state.members.find((item) => item.id === state.modal.memberId);
  const type = $("#recoveryType").value;
  const max = member.credits[type];
  $("#recoveryAmount").max = String(max);
  $("#recoveryAmount").value = String(max);
  $("#recoveryLimit").textContent = format(max);
}

function handleModalSubmit(event) {
  event.preventDefault();
  if (!state.modal) return;
  if (state.modal.type === "read-only") {
    closeModal();
    return;
  }
  if (state.modal.type === "shortage-auto") {
    autoRecoverAndAssign();
    return;
  }
  if (state.modal.type === "new-cycle") {
    state.members.forEach(member => {
      const credits = automaticCredits(member.name, "周期自动分配");
      creditTypes.forEach(type => member.credits[type] += credits[type]);
    });
    resetAllMemberDrafts();
    renderAll();
    closeModal();
    showToast("新周期积分已按每席位额度发放；余额不足的类型按剩余量发放");
    return;
  }
  const data = new FormData(event.currentTarget);

  if (state.modal.type === "delete") {
    const member = state.members.find((item) => item.id === state.modal.memberId);
    creditTypes.forEach((type) => {
      state.pools[type].available += member.credits[type];
      if (member.credits[type]) recordTransaction(member.name, type, member.credits[type], "删除回收");
    });
    state.members = state.members.filter((item) => item.id !== member.id);
    state.seats.used = Math.max(0, state.seats.used - 1);
    resetAllMemberDrafts();
    renderAll();
    closeModal();
    showToast(`已删除 ${member.name}，未使用积分已回收`);
    return;
  }

  if (state.modal.type === "invite") {
    const email = String(data.get("email")).trim();
    const role = String(data.get("role"));
    state.pendingInvites.push({ id: Date.now(), email, role, time: "2026-09-16 现在" });
    renderInvites();
    closeModal();
    showToast(`邀请已发送至 ${email}，接受后等待团队审批`);
    return;
  }

  if (state.modal.type === "rename") {
    const name = String(data.get("teamName")).trim();
    if (!name) return;
    $("#teamTitle").textContent = name;
    closeModal();
    showToast("团队名称已更新");
    return;
  }

  if (state.modal.type === "buy") {
    const type = String(data.get("creditType"));
    const amount = Number(data.get("amount"));
    if (!Number.isSafeInteger(amount) || amount < 1) {
      showToast("请输入有效的购买数量");
      return;
    }
    state.pools[type].total += amount;
    state.pools[type].available += amount;
    state.rechargeCredits += amount;
    recordTransaction("团队积分池", type, amount, "购买入账");
    recalculateShortage();
    renderAll();
    closeModal();
    showToast(`${format(amount)} ${state.pools[type].label}已进入团队待分配余额`);
    return;
  }

  if (state.modal.type === "recovery") {
    const member = state.members.find((item) => item.id === state.modal.memberId);
    const type = String(data.get("creditType"));
    const amount = Number(data.get("amount"));
    const max = member.credits[type];
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > max) {
      showToast(`请输入 1–${format(max)} 之间的整数`);
      return;
    }
    member.credits[type] -= amount;
    state.pools[type].available += amount;
    resetMemberDraft(member);
    recordTransaction(member.name, type, amount, "余额回收");
    recalculateShortage();
    renderAll();
    closeModal();
    showToast("积分已回收到团队待分配余额");
  }
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  $("#toastRegion").appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 180);
  }, 2600);
}

async function copyText(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(successMessage);
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    showToast(successMessage);
  }
}

document.addEventListener("click", (event) => {
  const schemeButton = event.target.closest("[data-credit-scheme]");
  if (schemeButton) {
    selectCreditScheme(schemeButton.dataset.creditScheme, true);
    return;
  }
  const creditTab = event.target.closest("[data-credit-tab]");
  if (creditTab) {
    selectCreditTab(creditTab.dataset.creditTab, true);
    return;
  }
  const simulationButton = event.target.closest("[data-simulation-mode]");
  if (simulationButton) {
    applySimulationMode(simulationButton.dataset.simulationMode);
    return;
  }

  const detailAnalysisTab = event.target.closest("[data-detail-analysis-tab]");
  if (detailAnalysisTab) {
    state.detailAnalysisTab = detailAnalysisTab.dataset.detailAnalysisTab;
    renderPointsDetail();
    return;
  }

  const detailLedgerTab = event.target.closest("[data-detail-ledger-tab]");
  if (detailLedgerTab) {
    state.detailLedgerTab = detailLedgerTab.dataset.detailLedgerTab;
    renderPointsDetail();
    return;
  }

  const tab = event.target.closest("[data-tab]");
  if (tab) {
    switchTab(tab.dataset.tab);
    return;
  }

  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    openDeleteModal(deleteButton.dataset.delete);
    return;
  }

  const confirmButton = event.target.closest("[data-confirm-member]");
  if (confirmButton) {
    confirmMemberCreditEdit(confirmButton.dataset.confirmMember);
    return;
  }

  const undoButton = event.target.closest("[data-undo-member]");
  if (undoButton) {
    undoMemberCreditEdit(undoButton.dataset.undoMember);
    return;
  }

  const deltaButton = event.target.closest("[data-draft-delta]");
  if (deltaButton) {
    const type = deltaButton.dataset.creditType;
    const field = deltaButton.dataset.draftField || "after";
    const delta = Number(deltaButton.dataset.draftDelta);
    const member = state.members.find(item => item.id === Number(deltaButton.dataset.member));
    if (!member) return;
    const draft = memberDraft(member);
    const before = member.credits[type];
    const maxAfter = before + state.pools[type].available;
    const current = field === "delta" ? Number(draft[type]) - before : Number(draft[type]);
    const next = current + delta;
    draft[type] = Math.max(0, Math.min(maxAfter, Math.round(field === "delta" ? before + next : next)));
    renderPointsRows();
    return;
  }

  const recoveryButton = event.target.closest("[data-recover-candidate]");
  if (recoveryButton) {
    openRecoveryModal(recoveryButton.dataset.recoverCandidate);
    return;
  }

  const approveButton = event.target.closest("[data-approve-invite]");
  if (approveButton) {
    approveInvite(approveButton.dataset.approveInvite);
    return;
  }

  const rejectButton = event.target.closest("[data-reject-invite]");
  if (rejectButton) {
    state.pendingInvites = state.pendingInvites.filter((item) => item.id !== Number(rejectButton.dataset.rejectInvite));
    renderInvites();
    showToast("已拒绝该成员申请");
    return;
  }

  const copyButton = event.target.closest("[data-copy]");
  if (copyButton) {
    copyText(copyButton.dataset.copy, "团队 ID 已复制");
    return;
  }

  if (event.target.closest("[data-close-modal]") || event.target === $("#modalBackdrop")) {
    closeModal();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;

  if (action === "new-cycle") startNewCycle();
  else if (action === "invite") openInviteModal();
  else if (action === "rename") openRenameModal();
  else if (action === "details") showPointsDetailPage("details");
  else if (action === "buy") showPointsDetailPage("purchase");
  else if (action === "buy-modal") openBuyModal();
  else if (action === "back-team") showTeamManagementPage();
  else if (action === "renew") showToast("续费流程已唤起（Demo）");
  else if (action === "seats") showToast("席位购买流程已唤起（Demo）");
  else if (action === "orders") showToast("订单管理已打开（Demo）");
  else if (action === "help") showToast("如需帮助，请联系团队管理员");
});

document.addEventListener("input", (event) => {
  const input = event.target.closest("[data-draft-input]");
  if (!input) return;
  const member = state.members.find(item => item.id === Number(input.dataset.member));
  if (!member) return;
  const draft = memberDraft(member);
  const type = input.dataset.creditType;
  const field = input.dataset.draftField || "after";
  const before = member.credits[type];
  const numeric = Number(input.value);
  draft[type] = input.value === "" ? "" : field === "delta" ? before + numeric : numeric;
  const row = input.closest(".table-row");
  const counterpart = row?.querySelector(`[data-draft-input][data-credit-type="${type}"][data-draft-field="${field === "delta" ? "after" : "delta"}"]`);
  if (counterpart && input.value !== "") counterpart.value = field === "delta" ? draft[type] : numeric - before;
  const operation = row?.querySelector(".points-operation");
  if (operation) operation.innerHTML = rowActionMarkup(member);
});

$("#modalForm").addEventListener("submit", handleModalSubmit);
$("#modalBody").addEventListener("change", (event) => {
  if (event.target.id === "recoveryType") updateRecoveryLimit();
});

document.addEventListener("change", (event) => {
  const selector = event.target.closest("[data-scheme-credit-type]");
  if (!selector) return;
  const memberId = Number(selector.dataset.memberId);
  state.memberCreditTypes[memberId] = selector.value;
  renderPointsRows();
});

document.addEventListener("keydown", (event) => {
  const scheme = document.activeElement?.dataset.creditScheme;
  if (scheme && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const schemes = ["overview", "tabs", "delta"];
    const index = schemes.indexOf(scheme);
    const next = event.key === "Home" ? 0 : event.key === "End" ? schemes.length - 1 : (index + (event.key === "ArrowRight" ? 1 : schemes.length - 1)) % schemes.length;
    selectCreditScheme(schemes[next], true);
    return;
  }
  const creditType = document.activeElement?.dataset.creditTab;
  if (creditType && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const types = visibleCreditTypes();
    const index = types.indexOf(creditType);
    const next = event.key === "Home" ? 0 : event.key === "End" ? types.length - 1 : (index + (event.key === "ArrowRight" ? 1 : types.length - 1)) % types.length;
    selectCreditTab(types[next], true);
    return;
  }
  if (event.key === "Escape" && !$("#modalBackdrop").hidden) closeModal();
  else if (event.key === "Escape" && state.activeView === "points-detail") showTeamManagementPage();
  if (event.key === "Enter" && event.target.matches("[data-draft-input]")) {
    event.preventDefault();
    confirmMemberCreditEdit(event.target.dataset.member);
  }
  if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && document.activeElement?.dataset.tab) {
    const tabs = $$("[data-tab]");
    const index = tabs.indexOf(document.activeElement);
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
    tabs[next].focus();
    switchTab(tabs[next].dataset.tab);
  }
});

window.addEventListener("popstate", syncViewFromLocation);


function applyConsumption(enabled) {
  state.members.forEach(member => visibleCreditTypes().forEach(type => {
    if (enabled) {
      const amount = Math.floor(member.credits[type] * .1);
      member.credits[type] -= amount;
      member.consumed[type] += amount;
    } else {
      member.credits[type] += member.consumed[type];
      member.consumed[type] = 0;
    }
  }));
}
let creditMenuTrigger = null;
function closeCreditMenu(restoreFocus = false) {
  document.querySelector('.credit-select-menu')?.remove();
  creditMenuTrigger?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) creditMenuTrigger?.focus();
  creditMenuTrigger = null;
}
function openCreditMenu(trigger) {
  const alreadyOpen = trigger === creditMenuTrigger;
  closeCreditMenu();
  if (alreadyOpen) return;
  creditMenuTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  const memberId = Number(trigger.dataset.creditMenu);
  const selected = selectedMemberCreditType(memberId);
  const menu = document.createElement('div');
  menu.className = 'credit-select-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', trigger.getAttribute('aria-label'));
  menu.innerHTML = visibleCreditTypes().map(type => `<button role="option" aria-selected="${type === selected}" data-menu-type="${type}" data-member-id="${memberId}"><span>${escapeHTML(state.pools[type].label)}</span>${type === selected ? '<img src="./assets/check.svg" alt="" />' : ''}</button>`).join('');
  document.body.appendChild(menu);
  const rect = trigger.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 168)) + 'px';
  const height = menu.offsetHeight;
  menu.style.top = (rect.bottom + height + 8 > window.innerHeight ? Math.max(8, rect.top - height - 4) : rect.bottom + 4) + 'px';
  menu.querySelector('[aria-selected="true"]').focus();
}
document.addEventListener('click', event => {
  const consume = event.target.closest('[data-consumption]');
  if (consume && consume.dataset.consumption !== state.consumptionMode) {
    if (hasPendingCreditChanges()) { showToast('请先确认或撤销未提交的积分调整'); return; }
    closeCreditMenu();
    state.consumptionMode = consume.dataset.consumption;
    applyConsumption(state.consumptionMode === 'on');
    resetAllMemberDrafts();
    renderAll();
    showToast(state.consumptionMode === 'on' ? '已模拟各成员各类型积分消耗 10%' : '已还原模拟消耗的积分');
  }
  const trigger = event.target.closest('[data-credit-menu]');
  if (trigger) { openCreditMenu(trigger); return; }
  const option = event.target.closest('[data-menu-type]');
  if (option) {
    const memberId = option.dataset.memberId;
    const select = document.querySelector(`[data-scheme-credit-type][data-member-id="${memberId}"]`);
    select.value = option.dataset.menuType;
    closeCreditMenu();
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector(`[data-credit-menu="${memberId}"]`)?.focus();
    return;
  }
  if (!event.target.closest('.credit-select-menu')) closeCreditMenu();
});
document.addEventListener('keydown', event => {
  if (!creditMenuTrigger) return;
  const options = [...document.querySelectorAll('.credit-select-menu [role="option"]')];
  const index = options.indexOf(document.activeElement);
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length;
    options[next].focus();
  }
  if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeCreditMenu(true); }
  if (event.key === 'Tab') closeCreditMenu(true);
}, true);
window.addEventListener('resize', () => closeCreditMenu());
document.addEventListener('scroll', () => closeCreditMenu(), true);
const donut = document.querySelector('#allocationDonut');
donut.addEventListener('pointermove', event => {
  const rect = donut.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  const radius = Math.hypot(x, y);
  const total = remainingTotal() + teamConsumedTotal();
  let index = -1;
  if (radius >= rect.width / 2 - 11 && radius <= rect.width / 2 && total) {
    const fraction = ((Math.atan2(y, x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
    index = fraction < availableTotal() / total ? 0 : fraction < remainingTotal() / total ? 1 : 2;
  }
  document.querySelectorAll('.credit-tooltip-row').forEach((row, i) => row.hidden = index !== -1 && index !== i);
});
donut.addEventListener('pointerleave', () => document.querySelectorAll('.credit-tooltip-row').forEach(row => row.hidden = false));
donut.addEventListener('focus', () => document.querySelectorAll('.credit-tooltip-row').forEach(row => row.hidden = false));

applyConsumption(true);
resetAllMemberDrafts();
renderAll();
switchTab("credits");
syncViewFromLocation();
