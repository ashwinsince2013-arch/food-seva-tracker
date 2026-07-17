const API_BASE = "https://food-seva-tracker.onrender.com";
const STORAGE_KEY = "foodSevaTrackerData";
const OWNER_EMAIL = "akrwins@gmail.com";
const PRESENCE_KEY = "foodSevaTrackerPresence";

const defaultData = {
  currentUserEmail: "",
  adminSeed: {
    name: "Arunkumar Rajasekar",
    email: OWNER_EMAIL,
    password: "AshwinKumar123"
  },
  users: [],
  pendingAdminEmails: []
};

let data = loadData();
let presence = loadPresence();
let jobs = []; // jobs from backend
let currentPage = "auth";
let redeemCategory = "Food";
let redeemKC = 1.0;
let selectedMemberEmail = null;
let deductCategory = "Food";
let authMode = "signup";
let appMessage = "";
let bookingSuccess = false; // overlay flag

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultData);
  try {
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultData),
      ...parsed,
      users: parsed.users || [],
      pendingAdminEmails: parsed.pendingAdminEmails || [],
      adminSeed: parsed.adminSeed || structuredClone(defaultData.adminSeed)
    };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadPresence() {
  const raw = localStorage.getItem(PRESENCE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function savePresence() {
  localStorage.setItem(PRESENCE_KEY, JSON.stringify(presence));
}

function currentUser() {
  return data.users.find(u => u.email === data.currentUserEmail) || null;
}

function isOwner(email) {
  return String(email || "").toLowerCase() === OWNER_EMAIL.toLowerCase();
}

function isAdmin() {
  const user = currentUser();
  return !!(user && user.admin);
}

function nowISO() {
  return new Date().toISOString();
}

function ensurePresenceRecord(email) {
  const key = String(email || "").toLowerCase();
  if (!key) return;
  if (!presence[key]) {
    presence[key] = {
      visible: false,
      lastSeen: nowISO()
    };
    savePresence();
  }
}

function setPresenceFor(email, visible) {
  const key = String(email || "").toLowerCase();
  if (!key) return;
  presence[key] = {
    visible: !!visible,
    lastSeen: nowISO()
  };
  savePresence();
}

function userPresence(email) {
  const key = String(email || "").toLowerCase();
  return presence[key] || null;
}

function formatLastOnline(iso) {
  if (!iso) return "Last online: unknown";
  const d = new Date(iso);
  return "Last online: " + d.toLocaleString([], {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function setAppMessage(text = "") {
  appMessage = text;
  const box = document.getElementById("appMessage");
  if (box) box.innerHTML = text ? `<div class="app-message error">${escapeHtml(text)}</div>` : "";
}

function setFormError(text = "") {
  const box = document.getElementById("formError");
  if (box) box.innerHTML = text ? `<div class="form-error">${escapeHtml(text)}</div>` : "";
}

function kcToUsd(kc) {
  return (kc * 5).toFixed(2);
}

function toMinutes(time) {
  const [hh, mm] = String(time || "").split(":").map(Number);
  return hh * 60 + mm;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function roundToHalf(hours) {
  return Math.round(hours * 2) / 2;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatMDY(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${m}/${d}/${String(y).slice(-2)}`;
}

function formatWeekdayMDY(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString("en-US", { weekday: "Sunday" ? "long" : "long" });
  return `${weekday}, ${m}/${d}/${String(y).slice(-2)}`;
}

function displayTime(time) {
  if (!time) return "";
  const [hh, mm] = time.split(":").map(Number);
  const suffix = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${pad2(mm)} ${suffix}`;
}

async function api(path, method = "GET", body = null) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : null
  });

  const text = await res.text();
  let out;
  try {
    out = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || "Server returned invalid JSON.");
  }

  if (!res.ok) throw new Error(out.message || "Request failed");
  return out;
}

async function loadFromMongo() {
  try {
    const users = await api("/api/app/users");
    data.users = users;
    saveData();
    data.users.forEach(u => ensurePresenceRecord(u.email));
  } catch (err) {
    console.error(err);
  }
}

async function loadJobs() {
  try {
    jobs = await api("/api/jobs");
  } catch (err) {
    console.error(err);
    jobs = [];
  }
}

function updateTabsVisibility() {
  const tabs = document.getElementById("tabs");
  const user = currentUser();
  if (!tabs) return;
  tabs.classList.toggle("hidden", !user);
  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === currentPage);
    if (btn.classList.contains("admin-only")) btn.classList.toggle("hidden", !isAdmin());
  });
}

function setupLogo() {
  const img = document.getElementById("appLogo");
  const fallback = document.getElementById("logoFallback");
  if (!img || !fallback) return;
  img.classList.add("hidden");
  fallback.classList.add("hidden");
  img.onerror = () => {
    img.classList.add("hidden");
    fallback.classList.add("hidden");
  };
  img.onload = () => {
    img.classList.remove("hidden");
    fallback.classList.add("hidden");
  };
  if (img.complete && img.naturalWidth > 0) img.classList.remove("hidden");
}

function render() {
  const app = document.getElementById("app");
  const user = currentUser();
  updateTabsVisibility();
  setAppMessage(appMessage);

  if (!user) {
    currentPage = "auth";
    app.innerHTML = renderAuth();
    setupLogo();
    return;
  }

  if (currentPage === "members" && !isAdmin()) currentPage = "home";

  let content = "";
  if (currentPage === "home") content = renderHome(user);
  if (currentPage === "log") content = renderBookTime(user);
  if (currentPage === "schedule") content = renderSchedule(user);
  if (currentPage === "redeem") content = renderRedeem(user);
  if (currentPage === "voucher") content = renderVoucher(user);
  if (currentPage === "account") content = renderAccount(user);
  if (currentPage === "members") content = renderMembers();

  if (bookingSuccess) {
    content += `
      <div id="bookingOverlay" style="
        position:fixed;inset:0;z-index:9999;
        background:#1e272e;
        display:flex;align-items:center;justify-content:center;
        color:#fff;text-align:center;padding:24px;
      ">
        <div>
          <div style="font-size:32px;font-weight:800;margin-bottom:12px;">Congratulations on booking a time!</div>
          <div style="font-size:48px;line-height:1.2;">🎉🎊🎉🎊🎉🎊</div>
        </div>
      </div>
    `;
  }

  app.innerHTML = content;
  setupLogo();
}

function renderShell(content) {
  return `
    <div id="appMessage"></div>
    ${content}
  `;
}

function renderAuth() {
  return renderShell(`
    <section class="card center-card">
      <h2>Food Seva Tracker</h2>
      <p class="small-muted">Signup or login to continue.</p>
      <div id="formError"></div>

      <div class="list" style="margin-bottom:16px;">
        <button class="item redeem-choice ${authMode === "signup" ? "active" : ""}" type="button" onclick="setAuthMode('signup')">
          <strong>Signup</strong>
          <div class="small-muted">Create a new account.</div>
        </button>

        <button class="item redeem-choice ${authMode === "login" ? "active" : ""}" type="button" onclick="setAuthMode('login')">
          <strong>Login</strong>
          <div class="small-muted">Open an existing account.</div>
        </button>
      </div>

      ${authMode === "signup" ? `
        <label for="authName">Name</label>
        <input id="authName" type="text" placeholder="Your name" />

        <label for="authEmail">Email</label>
        <input id="authEmail" type="email" placeholder="name@example.com" />

        <label for="authPassword">Password</label>
        <div class="password-wrap">
          <input id="authPassword" type="password" placeholder="Choose a password" />
          <button class="password-toggle" type="button" onclick="togglePassword('authPassword', this)">See</button>
        </div>

        <label for="authConfirm">Confirm Password</label>
        <div class="password-wrap">
          <input id="authConfirm" type="password" placeholder="Confirm your password" />
          <button class="password-toggle" type="button" onclick="togglePassword('authConfirm', this)">See</button>
        </div>
      ` : ""}

      ${authMode === "login" ? `
        <label for="authName">Name</label>
        <input id="authName" type="text" placeholder="Your name" />

        <label for="authEmail">Email</label>
        <input id="authEmail" type="email" placeholder="name@example.com" />

        <label for="authPassword">Password</label>
        <div class="password-wrap">
          <input id="authPassword" type="password" placeholder="Your password" />
          <button class="password-toggle" type="button" onclick="togglePassword('authPassword', this)">See</button>
        </div>
      ` : ""}

      <div class="footer-space"></div>
      <div class="row">
        <button class="btn" onclick="submitAuth()">Confirm</button>
      </div>
    </section>
  `);
}

function renderHome(user) {
  return renderShell(`
    <section class="grid">
      <div class="card">
        <div class="welcome-row">
          <div class="welcome-text">
            <h1>Welcome, ${escapeHtml(user.name)}</h1>
            <p>Food Seva Tracker is a simple Karma Credit system for seva work at Chinmaya Mission. You book a time to help, earn KC based on how long you worked, and redeem those points for Food, Books, or Karma. Karma means donation, so the app keeps your rewards and donation options in one place. One KC equals five US dollars in redeem value.</p>
          </div>
          <div class="kc-box">
            <div class="kc-number">${user.kc.toFixed(1)} KC</div>
            <div class="kc-label">1 KC = $5 USD</div>
          </div>
        </div>
        <hr />
        <h3>What KC Means</h3>
        <p class="small-muted">KC stands for Karma Credit. If you work from 9:00 AM to 10:30 AM, that is 1 hour 30 minutes, so you earn 1.5 KC. Logs under or equal to 10 minutes are not counted, and time is rounded to the nearest 0.5 KC.</p>
        <hr />
        <h3>Redeem Categories</h3>
        <div class="list">
          <div class="item"><strong><span class="redeem-icon">🍲</span>Food</strong><div class="small-muted">Use your KC to enjoy meals at Chinmaya Mission.</div></div>
          <div class="item"><strong><span class="redeem-icon">📚</span>Books</strong><div class="small-muted">Use your KC to purchase spiritual and educational books.</div></div>
          <div class="item"><strong><span class="redeem-icon">🙏</span>Karma (Donation)</strong><div class="small-muted">Use your KC to make a donation and serve more.</div></div>
        </div>
      </div>
      <div class="card">
        <h3>How It Works</h3>
        <p class="small-muted">1. Sign up or log in.<br>2. Go to Book Time to pick a job slot.<br>3. Earn KC automatically from the time you worked.<br>4. Redeem KC for Food, Books, or Karma.<br>5. Use the Voucher and Schedule tabs to see your bookings and rewards.</p>
      </div>
    </section>
  `);
}

/**
 * BOOK TIME – grouped by date
 */
function renderBookTime(user) {
  const isUserAdmin = isAdmin();
  const today = todayISO();

  const upcomingJobs = jobs
    .filter(job => job.endDate >= today)
    .sort((a, b) => {
      if (a.startDate === b.startDate) {
        return a.startTime.localeCompare(b.startTime);
      }
      return a.startDate.localeCompare(b.startDate);
    });

  const groupedByDate = {};
  for (const job of upcomingJobs) {
    const key = job.startDate;
    if (!groupedByDate[key]) groupedByDate[key] = [];
    groupedByDate[key].push(job);
  }
  const dates = Object.keys(groupedByDate).sort();

  return renderShell(`
    <section class="card">
      <h2>Book Time</h2>
      <p class="small-muted">Pick a job that needs help. Admins can create and delete jobs. Members can apply for a spot.</p>

      <h3>Open Jobs</h3>
      ${
        dates.length
          ? dates
              .map(date => {
                const jobsForDay = groupedByDate[date];
                return `
                  <div class="card" style="margin-bottom:12px;">
                    <div style="font-weight:700;margin-bottom:8px;">
                      ${formatWeekdayMDY(date)}
                    </div>
                    <div class="list">
                      ${jobsForDay.map(renderJobItem).join("")}
                    </div>
                  </div>
                `;
              })
              .join("")
          : `<div class="item small-muted">No jobs yet. Admins can create a job using Book a Time.</div>`
      }

      ${isUserAdmin ? renderAdminCreateJobSection(user) : ""}
    </section>
  `);
}

function renderJobItem(job) {
  const spotsLeft = job.spotsTotal - job.spotsTaken;
  const user = currentUser();
  const userIsAdmin = !!(user && user.admin);

  return `
    <div class="item job-item">
      <div class="row space-between" style="align-items:flex-start;gap:8px;">
        <div>
          <strong>${escapeHtml(job.title)}</strong>
          ${job.description ? `<div class="small-muted">${escapeHtml(job.description)}</div>` : ""}
          <div class="small-muted">Time: ${displayTime(job.startTime)} to ${displayTime(job.endTime)}</div>
          <div class="small-muted">${job.spotsTotal} spots – ${Math.max(0, spotsLeft)} spots left</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          ${spotsLeft <= 0 ? `
            <div class="badge badge-gray">No spots left</div>
          ` : `
            <button class="btn small" type="button" onclick="openApplyForJob('${job._id}')">Apply for spot</button>
          `}
          ${userIsAdmin ? `
            <button class="trash-btn" type="button" onclick="deleteJob('${job._id}')">🗑</button>
          ` : ""}
        </div>
      </div>
    </div>
  `;
}

function renderAdminCreateJobSection(user) {
  return `
    <div class="card" style="margin-top:16px;background:#f0f7ff;border:1px solid #c7defc;">
      <h3>Book a time (Create job)</h3>
      <p class="small-muted">Create a job slot members can book. Set the dates, times, and how many people you need.</p>

      <label for="jobTitle">What do you need help with?</label>
      <input id="jobTitle" type="text" placeholder="Wash dishes, serve food, etc." />

      <label for="jobDescription">Description (optional)</label>
      <input id="jobDescription" type="text" placeholder="Extra details for this job (optional)" />

      <div class="row wrap">
        <div style="flex:1;min-width:180px;">
          <label for="jobStartDate">Start date</label>
          <input id="jobStartDate" type="date" min="${todayISO()}" />
        </div>
        <div style="flex:1;min-width:180px;">
          <label for="jobEndDate">End date</label>
          <input id="jobEndDate" type="date" min="${todayISO()}" />
        </div>
      </div>

      <div class="row wrap">
        <div style="flex:1;min-width:180px;">
          <label for="jobStartTime">Start time</label>
          <input id="jobStartTime" type="time" />
        </div>
        <div style="flex:1;min-width:180px;">
          <label for="jobEndTime">End time</label>
          <input id="jobEndTime" type="time" />
        </div>
      </div>

      <label for="jobSpots">How many people do you need?</label>
      <input id="jobSpots" type="number" min="1" step="1" placeholder="Number of spots" />

      <div class="footer-space"></div>
      <button class="btn" type="button" onclick="createJob()">Create job</button>
    </div>
  `;
}

/**
 * SCHEDULE
 */
function renderSchedule(user) {
  const entries = data.users
    .flatMap(u => (u.logs || []).map((log, index) => ({
      date: log.date,
      name: u.name,
      email: u.email,
      jobTitle: log.jobTitle || "",
      start: log.start,
      end: log.end,
      kc: log.kc,
      logIndex: index
    })))
    .sort((a, b) => a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date));

  const grouped = {};
  for (const entry of entries) {
    if (!grouped[entry.date]) grouped[entry.date] = [];
    grouped[entry.date].push(entry);
  }

  const dates = Object.keys(grouped).sort();

  return renderShell(`
    <section class="card">
      <h2>Schedule</h2>
      <p class="small-muted">This shows who is coming, what they are doing, and when.</p>
      ${dates.length ? dates.map(date => `
        <div class="card schedule-card">
          <div class="schedule-date">${formatWeekdayMDY(date)}</div>
          ${grouped[date].map(item => `
            <div class="schedule-entry">
              <div class="schedule-main">
                <div class="schedule-name">${escapeHtml(item.name)}</div>
                <div class="small-muted">
                  ${item.jobTitle ? `${escapeHtml(item.jobTitle)} • ` : ""}
                  ${displayTime(item.start)} to ${displayTime(item.end)}
                </div>
                <div class="small-muted">${item.kc} KC</div>
              </div>
              ${isAdmin() ? `<button class="trash-btn" type="button" onclick="deleteScheduleEntry('${escapeHtml(item.email)}', '${item.logIndex}')">🗑</button>` : ""}
            </div>
          `).join("")}
        </div>
      `).join("") : `<div class="item small-muted">No schedule yet. When someone books time, it will appear here.</div>`}
    </section>
  `);
}

function renderRedeem(user) {
  return renderShell(`
    <section class="card">
      <h2>Redeem</h2>
      <p class="small-muted">You have ${user.kc.toFixed(1)} KC, worth $${kcToUsd(user.kc)} USD.</p>
      <div class="list">
        <button class="item redeem-choice ${redeemCategory === "Food" ? "active" : ""}" onclick="setRedeemCategory('Food')" type="button"><strong><span class="redeem-icon">🍲</span>Food</strong><div class="small-muted">Use your KC to enjoy meals at Chinmaya Mission.</div></button>
        <button class="item redeem-choice ${redeemCategory === "Books" ? "active" : ""}" onclick="setRedeemCategory('Books')" type="button"><strong><span class="redeem-icon">📚</span>Books</strong><div class="small-muted">Use your KC to purchase spiritual and educational books.</div></button>
        <button class="item redeem-choice ${redeemCategory === "Karma" ? "active" : ""}" onclick="setRedeemCategory('Karma')" type="button"><strong><span class="redeem-icon">🙏</span>Karma (Donation)</strong><div class="small-muted">Use your KC to make a donation and serve more.</div></button>
      </div>
      <hr />
      <h3>Choose Amount</h3>
      <div class="stepper">
        <button type="button" onclick="changeRedeemKC(-0.5)">-</button>
        <div class="value">${redeemKC.toFixed(1)} KC<br><span class="small-muted">$${kcToUsd(redeemKC)} USD</span></div>
        <button type="button" onclick="changeRedeemKC(0.5)">+</button>
      </div>
      <div class="footer-space"></div>
      <button class="btn full" onclick="confirmRedeem()">Confirm</button>
    </section>
  `);
}

function renderVoucher(user) {
  return renderShell(`
    <section class="card">
      <h2>Voucher</h2>
      <p class="small-muted">After confirm, your voucher appears here. Admins can deduct the exact amount used.</p>
      <div class="list">
        ${Object.entries(user.vouchers).map(([category, usd]) => `
          <div class="item">
            <strong>${category} Voucher</strong>
            <div style="font-size:28px;font-weight:900;color:var(--mist-blue-dark);">$${Number(usd).toFixed(2)}</div>
            <div class="small-muted">${(Number(usd) / 5).toFixed(1)} KC value</div>
          </div>
        `).join("")}
      </div>
    </section>
  `);
}

function renderAccount(user) {
  return renderShell(`
    <section class="card center-card">
      <h2>Account</h2>
      <p class="small-muted">Check your info or update it.</p>
      <label for="accName">Name</label>
      <input id="accName" value="${escapeHtml(user.name)}" />
      <label for="accEmail">Email</label>
      <input id="accEmail" type="email" value="${escapeHtml(user.email)}" />
      <label for="accPassword">Password</label>
      <div class="password-wrap">
        <input id="accPassword" type="password" value="${escapeHtml(user.password)}" />
        <button class="password-toggle" type="button" onclick="togglePassword('accPassword', this)">See</button>
      </div>
      <div class="footer-space"></div>
      <div class="row">
        <button class="btn" onclick="saveAccount()">Save Changes</button>
        <button class="btn danger" onclick="logout()">Log Out</button>
      </div>
    </section>
  `);
}

function renderMembers() {
  const members = data.users.filter(u => !u.admin);
  const admins = data.users.filter(u => u.admin);
  return renderShell(`
    <section class="card">
      <h2>Members</h2>
      <p class="small-muted">Click any member or admin to view their account.</p>

      <div class="list">
        ${members.length ? members.map(user => renderMemberButton(user, "Member")).join("") : `<div class="item small-muted">No Members yet.</div>`}
      </div>

      <h3 style="margin-top:20px;">Admins</h3>
      <div class="list">
        ${admins.length ? admins.map(user => renderMemberButton(user, "Admin")).join("") : `<div class="item small-muted">No Admins yet.</div>`}
      </div>

      ${selectedMemberEmail ? renderSelectedMember(selectedMemberEmail) : ""}
    </section>
  `);
}

function renderMemberButton(user, label) {
  const p = userPresence(user.email);
  const visible = !!(p && p.visible);
  const isOwnerUser = isOwner(user.email);
  const crown = isOwnerUser ? " 👑" : "";
  return `
    <button type="button" class="item redeem-choice ${selectedMemberEmail === user.email ? "active" : ""}" onclick="selectMember('${escapeHtml(user.email)}')">
      <div class="row space-between" style="align-items:center;">
        <div>
          <strong>${escapeHtml(user.name)}${crown}</strong>
          <div class="small-muted">${escapeHtml(user.email)}</div>
          <div class="small-muted">${label}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:12px;height:12px;border-radius:50%;display:inline-block;background:${visible ? "#2ecc71" : "#ffffff"};border:1px solid #999;"></span>
        </div>
      </div>
      <div class="small-muted" style="margin-top:8px;">
        ${visible ? "Active now" : formatLastOnline(p && p.lastSeen)}
      </div>
    </button>
  `;
}

function renderSelectedMember(email) {
  const user = data.users.find(u => u.email === email);
  if (!user) return "";

  const me = currentUser();

  if (isOwner(user.email) && (!me || !isOwner(me.email))) {
    return `
      <div style="margin-top:16px" class="card">
        <div class="alert-danger" style="color:#c0392b;font-weight:700;">
          Cannot touch owners account.
        </div>
      </div>
    `;
  }

  const p = userPresence(user.email);
  const visible = !!(p && p.visible);
  const isUserAdmin = !!user.admin;
  const isUserOwner = isOwner(user.email);
  const crown = isUserOwner ? " 👑" : "";

  const actionButtons = isUserAdmin
    ? `
        <button class="btn secondary" type="button" onclick="makeMember('${escapeHtml(user.email)}')">Make member</button>
        <button class="btn danger" type="button" onclick="removeMember('${escapeHtml(user.email)}')">Remove member</button>
      `
    : `
        <button class="btn secondary" type="button" onclick="makeAdmin('${escapeHtml(user.email)}')">Make admin</button>
        <button class="btn danger" type="button" onclick="removeMember('${escapeHtml(user.email)}')">Remove member</button>
      `;

  return `
    <div style="margin-top:16px" class="card">
      <div class="member-close"><button class="close-btn" type="button" onclick="closeMember()">×</button></div>
      <h3>${escapeHtml(user.name)}${crown}</h3>
      <p class="small-muted">${escapeHtml(user.email)}</p>
      <p class="small-muted">${user.admin ? "Admin" : "Member"}</p>
      <p class="small-muted">${user.kc.toFixed(1)} KC</p>

      <h4>Status</h4>
      <div class="small-muted">${visible ? "Active now" : formatLastOnline(p && p.lastSeen)}</div>

      <h4>Actions</h4>
      <div class="row wrap">
        ${isUserOwner ? "" : actionButtons}
      </div>

      <h4 style="margin-top:16px;">Vouchers</h4>
      <div class="list">
        ${Object.entries(user.vouchers || {}).map(([category, usd]) => `
          <button type="button" class="item deduct-choice ${deductCategory === category ? "active" : ""}" onclick="setDeductCategory('${category}')">
            <strong>${category}</strong>
            <div class="small-muted">$${Number(usd).toFixed(2)} available</div>
          </button>
        `).join("")}
      </div>

      <label for="deductAmount">Amount to Remove</label>
      <input id="deductAmount" class="plain-amount" type="number" min="0" step="0.01" placeholder="Type the amount of money you want to remove here" />
      <div class="footer-space"></div>
      <div class="row wrap">
        <button class="btn" onclick="deductVoucher('${escapeHtml(user.email)}')">Remove Money</button>
      </div>
    </div>
  `;
}

/**
 * AUTH + ACCOUNT
 */
function setAuthMode(mode) {
  authMode = mode;
  currentPage = "auth";
  setFormError("");
  render();
}

function togglePassword(id, btn) {
  const input = document.getElementById(id);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "Hide";
  } else {
    input.type = "password";
    btn.textContent = "See";
  }
}

function findUser(email) {
  return data.users.find(u => u.email.toLowerCase() === String(email).trim().toLowerCase()) || null;
}

async function submitAuth() {
  setFormError("");
  if (!authMode) return setFormError("Choose Signup or Login first.");

  const name = document.getElementById("authName")?.value.trim() || "";
  const email = document.getElementById("authEmail")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("authPassword")?.value || "";
  const confirm = document.getElementById("authConfirm")?.value || "";

  try {
    if (authMode === "signup") {
      if (!name || !email || !password || !confirm) return setFormError("Please fill out all fields.");
      if (password !== confirm) return setFormError("Passwords do not match. Please try again.");

      const existing = findUser(email);
      if (existing) return setFormError("Account already created. Please log in instead.");

      const user = await api("/api/auth/signup", "POST", { name, email, password, adminSeed: data.adminSeed });
      data.currentUserEmail = user.email;
      currentPage = "home";
      saveData();
      await loadFromMongo();
      await loadJobs();
      setPresenceFor(user.email, true);
      render();
      return;
    }

    if (authMode === "login") {
      if (!name || !email || !password) return setFormError("Please fill out all fields.");

      const existing = findUser(email);
      if (!existing) return setFormError("Email not found. Please sign up instead.");
      if (existing.password !== password) return setFormError("Incorrect email or password. Please change and try again.");
      if (existing.name.toLowerCase() !== name.toLowerCase()) return setFormError("Incorrect email or password. Please change and try again.");

      const user = await api("/api/auth/login", "POST", { name, email, password });
      data.currentUserEmail = user.email;
      currentPage = "home";
      saveData();
      await loadFromMongo();
      await loadJobs();
      setPresenceFor(user.email, true);
      render();
    }
  } catch (err) {
    setFormError(err.message || "Something went wrong.");
  }
}

function logout() {
  const user = currentUser();
  if (user) setPresenceFor(user.email, false);
  data.currentUserEmail = "";
  saveData();
  currentPage = "auth";
  selectedMemberEmail = null;
  authMode = "signup";
  setFormError("");
  setAppMessage("");
  render();
}

async function saveAccount() {
  const user = currentUser();
  const name = document.getElementById("accName").value.trim();
  const email = document.getElementById("accEmail").value.trim().toLowerCase();
  const password = document.getElementById("accPassword").value;
  if (!name || !email || !password) return setAppMessage("All fields are required.");
  const oldEmail = user.email;
  user.name = name;
  user.email = email;
  user.password = password;
  data.currentUserEmail = email;
  await api(`/api/app/users/${encodeURIComponent(oldEmail)}`, "PUT", user);
  await loadFromMongo();
  await loadJobs();
  setPresenceFor(email, true);
  setAppMessage("Account saved.");
  render();
}

/**
 * BOOK TIME helpers
 */
async function createJob() {
  const user = currentUser();
  if (!user || !user.admin) {
    setAppMessage("Only admins can create jobs.");
    return;
  }

  const title = document.getElementById("jobTitle")?.value.trim() || "";
  const description = document.getElementById("jobDescription")?.value.trim() || "";
  const startDate = document.getElementById("jobStartDate")?.value || "";
  const endDate = document.getElementById("jobEndDate")?.value || "";
  const startTime = document.getElementById("jobStartTime")?.value || "";
  const endTime = document.getElementById("jobEndTime")?.value || "";
  const spotsStr = document.getElementById("jobSpots")?.value || "";

  if (!title || !startDate || !endDate || !startTime || !endTime || !spotsStr) {
    setAppMessage("Please fill out all job fields.");
    return;
  }

  if (endDate < startDate) {
    setAppMessage("End date must be on or after start date.");
    return;
  }

  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  if (endMinutes <= startMinutes) {
    setAppMessage("Job end time must be after start time.");
    return;
  }

  const spotsTotal = parseInt(spotsStr, 10);
  if (!spotsTotal || spotsTotal <= 0) {
    setAppMessage("Spots must be at least 1.");
    return;
  }

  try {
    await api("/api/jobs", "POST", {
      title,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      spotsTotal,
      createdBy: user.email
    });

    await loadJobs();
    setAppMessage("Job created.");
    render();
  } catch (err) {
    setAppMessage(err.message || "Could not create job.");
  }
}

function openApplyForJob(jobId) {
  const job = jobs.find(j => j._id === jobId);
  if (!job) return;

  const user = currentUser();
  if (!user) {
    setAppMessage("Please log in first.");
    return;
  }

  const multiDay = job.startDate !== job.endDate;
  const dateOptions = [];
  let cursor = new Date(job.startDate + "T00:00:00");
  const end = new Date(job.endDate + "T00:00:00");
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    dateOptions.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  let dateSelectHtml = "";
  if (multiDay) {
    dateSelectHtml = `
      <label for="applyDate">Which date can you come?</label>
      <select id="applyDate">
        ${dateOptions.map(d => `<option value="${d}">${formatMDY(d)}</option>`).join("")}
      </select>
    `;
  } else {
    dateSelectHtml = `
      <label>Date</label>
      <div class="small-muted">${formatMDY(job.startDate)}</div>
    `;
  }

  const app = document.getElementById("app");
  app.innerHTML = renderShell(`
    <section class="card center-card">
      <h2>Apply for ${escapeHtml(job.title)}</h2>
      <p class="small-muted">Fill in your time. KC will be calculated based on how long you can stay.</p>

      ${dateSelectHtml}

      <label for="applyStartTime">What time can you be there from?</label>
      <input id="applyStartTime" type="time" />

      <label for="applyEndTime">What time until?</label>
      <input id="applyEndTime" type="time" />

      <div class="footer-space"></div>
      <div class="card" style="background:#fbfdff;border-style:dashed;">
        <div class="row space-between">
          <div>
            <div class="small-muted">Total Time</div>
            <div id="applyPreviewDuration" style="font-weight:800;">0 min</div>
          </div>
          <div style="text-align:right">
            <div class="small-muted">KC Earned</div>
            <div id="applyPreviewKC" style="font-weight:800;">0.0 KC</div>
          </div>
        </div>
      </div>

      <div class="footer-space"></div>
      <div class="row wrap">
        <button class="btn" type="button" onclick="applyForJob('${job._id}')">Apply</button>
        <button class="btn secondary" type="button" onclick="cancelApply()">Cancel</button>
      </div>
    </section>
  `);

  const startInput = document.getElementById("applyStartTime");
  const endInput = document.getElementById("applyEndTime");

  function updateApplyPreview() {
    const start = startInput.value;
    const end = endInput.value;
    const durationEl = document.getElementById("applyPreviewDuration");
    const kcEl = document.getElementById("applyPreviewKC");
    if (!durationEl || !kcEl) return;
    if (!start || !end) {
      durationEl.textContent = "0 min";
      kcEl.textContent = "0.0 KC";
      return;
    }
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    if (endMinutes <= startMinutes) {
      durationEl.textContent = "Invalid time";
      kcEl.textContent = "0.0 KC";
      return;
    }
    const minutes = endMinutes - startMinutes;
    if (minutes <= 10) {
      durationEl.textContent = "Too short (must be > 10 min)";
      kcEl.textContent = "0.0 KC";
      return;
    }
    const kc = roundToHalf(minutes / 60);
    durationEl.textContent = `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
    kcEl.textContent = `${kc.toFixed(1)} KC`;
  }

  startInput.addEventListener("input", updateApplyPreview);
  endInput.addEventListener("input", updateApplyPreview);
}

function cancelApply() {
  render();
}

async function applyForJob(jobId) {
  const job = jobs.find(j => j._id === jobId);
  if (!job) {
    setAppMessage("Job not found.");
    render();
    return;
  }

  const user = currentUser();
  if (!user) {
    setAppMessage("Please log in first.");
    render();
    return;
  }

  const multiDay = job.startDate !== job.endDate;
  let date;
  if (multiDay) {
    date = document.getElementById("applyDate")?.value || "";
  } else {
    date = job.startDate;
  }

  const startTime = document.getElementById("applyStartTime")?.value || "";
  const endTime = document.getElementById("applyEndTime")?.value || "";

  if (!date || !startTime || !endTime) {
    setAppMessage("Please select date, start time, and end time.");
    render();
    return;
  }

  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  if (endMinutes <= startMinutes) {
    setAppMessage("End time must be after start time.");
    render();
    return;
  }
  const minutes = endMinutes - startMinutes;
  if (minutes <= 10) {
    setAppMessage("Time must be more than 10 minutes.");
    render();
    return;
  }

  try {
    const result = await api(`/api/jobs/${jobId}/apply`, "POST", {
      email: user.email,
      name: user.name,
      date,
      startTime,
      endTime
    });

    const updatedUser = result.user;
    const updatedJob = result.job;

    const idxUser = data.users.findIndex(u => u.email.toLowerCase() === updatedUser.email.toLowerCase());
    if (idxUser !== -1) {
      data.users[idxUser] = updatedUser;
      if (data.currentUserEmail.toLowerCase() === updatedUser.email.toLowerCase()) {
        data.currentUserEmail = updatedUser.email;
      }
    }

    const idxJob = jobs.findIndex(j => j._id === updatedJob._id);
    if (idxJob !== -1) {
      jobs[idxJob] = updatedJob;
    } else {
      jobs.push(updatedJob);
    }

    saveData();
    await loadFromMongo();
    await loadJobs();

    bookingSuccess = true;
    render();

    setTimeout(() => {
      bookingSuccess = false;
      currentPage = "schedule";
      render();
    }, 3000);
  } catch (err) {
    setAppMessage(err.message || "Could not apply for this job.");
    render();
  }
}

async function deleteJob(jobId) {
  const user = currentUser();
  if (!user || !user.admin) {
    setAppMessage("Only admins can delete jobs.");
    return;
  }
  if (!confirm("Delete this job?")) return;
  try {
    await fetch(`${API_BASE}/api/jobs/${jobId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email })
    });
    await loadJobs();
    setAppMessage("Job deleted.");
    render();
  } catch (err) {
    setAppMessage(err.message || "Could not delete job.");
  }
}

/**
 * Other helpers
 */
async function addAdminEmail() {
  const email = prompt("Enter the email to make admin:");
  if (!email) return;
  const clean = email.trim().toLowerCase();
  const existing = findUser(clean);
  if (existing) {
    existing.admin = true;
    await api(`/api/app/users/${encodeURIComponent(existing.email)}`, "PUT", existing);
  }
  await loadFromMongo();
  setAppMessage("Admin added.");
  render();
}

function selectMember(email) {
  selectedMemberEmail = email || null;
  render();
}

function closeMember() {
  selectedMemberEmail = null;
  render();
}

function setDeductCategory(category) {
  deductCategory = category;
  render();
}

function canTouchUser(target) {
  const me = currentUser();
  if (!me) return false;
  if (isOwner(target.email) && !isOwner(me.email)) return false;
  return true;
}

async function makeAdmin(email) {
  const user = findUser(email);
  if (!user) return;
  if (!canTouchUser(user)) return alert("Cannot touch owners account.");
  user.admin = true;
  await api(`/api/app/users/${encodeURIComponent(user.email)}`, "PUT", user);
  await loadFromMongo();
  setAppMessage(`${user.name} is now an admin.`);
  render();
}

async function makeMember(email) {
  const user = findUser(email);
  if (!user) return;
  if (!canTouchUser(user)) return alert("Cannot touch owners account.");
  user.admin = false;
  await api(`/api/app/users/${encodeURIComponent(user.email)}`, "PUT", user);
  await loadFromMongo();
  setAppMessage(`${user.name} is now a member.`);
  render();
}

async function deductVoucher(email) {
  const user = findUser(email);
  if (!user) return;
  if (!canTouchUser(user)) return alert("Cannot touch owners account.");
  const amount = parseFloat(document.getElementById("deductAmount").value);
  if (!amount || amount <= 0) return setAppMessage("Enter a valid amount.");
  const current = Number(user.vouchers[deductCategory] || 0);
  const next = Math.max(0, current - amount);
  user.vouchers[deductCategory] = Number(next.toFixed(2));
  await api(`/api/app/users/${encodeURIComponent(user.email)}`, "PUT", user);
  await loadFromMongo();
  setAppMessage(`Removed $${amount.toFixed(2)} from ${user.name}'s ${deductCategory} voucher.`);
  render();
}

async function removeAdminForMember(email) {
  const user = findUser(email);
  if (!user) return;
  if (!canTouchUser(user)) return alert("Cannot touch owners account.");
  if (isOwner(user.email)) return alert("Cannot touch owners account.");
  user.admin = false;
  await api(`/api/app/users/${encodeURIComponent(user.email)}`, "PUT", user);
  await loadFromMongo();
  setAppMessage(`${user.name} is no longer an admin.`);
  render();
}

async function removeMember(email) {
  const user = findUser(email);
  if (!user) return;
  if (!canTouchUser(user)) return alert("Cannot touch owners account.");
  if (isOwner(user.email)) return alert("Cannot touch owners account.");
  if (!confirm(`Remove ${user.name}?`)) return;
  await fetch(`${API_BASE}/api/app/users/${encodeURIComponent(user.email)}`, { method: "DELETE" });
  await loadFromMongo();
  selectedMemberEmail = null;
  setAppMessage("Member removed.");
  render();
}

async function deleteScheduleEntry(email, logIndex) {
  if (!isAdmin()) return alert("Admins only.");
  const user = findUser(email);
  if (!user || !user.logs || !user.logs[logIndex]) return;
  if (!confirm("Delete this schedule entry?")) return;
  user.logs.splice(logIndex, 1);
  await api(`/api/app/users/${encodeURIComponent(user.email)}`, "PUT", user);
  await loadFromMongo();
  setAppMessage("Schedule entry deleted.");
  render();
}

function onVisibilityChange() {
  const user = currentUser();
  if (!user) return;
  if (document.visibilityState === "visible") {
    setPresenceFor(user.email, true);
  } else {
    setPresenceFor(user.email, false);
  }
  render();
}

document.addEventListener("visibilitychange", onVisibilityChange);
window.addEventListener("beforeunload", () => {
  const user = currentUser();
  if (user) setPresenceFor(user.email, false);
});

document.addEventListener("click", e => {
  const tab = e.target.closest(".tab");
  if (!tab || tab.classList.contains("hidden")) return;
  currentPage = tab.dataset.page;
  if (currentPage !== "members") selectedMemberEmail = null;
  render();
});

window.setAuthMode = setAuthMode;
window.submitAuth = submitAuth;
window.logout = logout;
window.setRedeemCategory = setRedeemCategory;
window.changeRedeemKC = changeRedeemKC;
window.confirmRedeem = confirmRedeem;
window.saveAccount = saveAccount;
window.addAdminEmail = addAdminEmail;
window.selectMember = selectMember;
window.closeMember = closeMember;
window.setDeductCategory = setDeductCategory;
window.deductVoucher = deductVoucher;
window.removeAdminForMember = removeAdminForMember;
window.removeMember = removeMember;
window.deleteScheduleEntry = deleteScheduleEntry;
window.togglePassword = togglePassword;
window.makeAdmin = makeAdmin;
window.makeMember = makeMember;
window.createJob = createJob;
window.openApplyForJob = openApplyForJob;
window.applyForJob = applyForJob;
window.cancelApply = cancelApply;
window.deleteJob = deleteJob;
window.setPage = page => {
  currentPage = page;
  render();
};

async function initApp() {
  try {
    await Promise.all([loadFromMongo(), loadJobs()]);
  } catch (e) {
    console.error(e);
  }

  // If no one is logged in, show auth. If someone is logged in, go home.
  if (!currentUser()) {
    currentPage = "auth";
    authMode = "signup";
  } else {
    currentPage = "home";
  }

  render();
}

document.addEventListener("DOMContentLoaded", initApp);
