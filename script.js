const API_BASE = "https://food-seva-tracker.onrender.com";
const STORAGE_KEY = "foodSevaTrackerData";

const defaultData = {
  currentUserEmail: "",
  adminSeed: {
    name: "Arunkumar Rajasekar",
    email: "akrwins@gmail.com",
    password: "AshwinKumar123"
  },
  users: [],
  pendingAdminEmails: []
};

let data = loadData();
let currentPage = "auth";
let redeemCategory = "Food";
let redeemKC = 1.0;
let selectedMemberEmail = null;
let deductCategory = "Food";
let authMode = "signup";

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

function currentUser() {
  return data.users.find(u => u.email === data.currentUserEmail) || null;
}

function isAdmin() {
  const user = currentUser();
  return !!(user && user.admin);
}

function kcToUsd(kc) {
  return (kc * 5).toFixed(2);
}

function toMinutes(time) {
  const [hh, mm] = time.split(":").map(Number);
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
  return String(value).replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
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
  const weekday = dt.toLocaleDateString("en-US", { weekday: "long" });
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
    data.currentUserEmail = "";
    currentPage = "auth";
    authMode = "signup";
    selectedMemberEmail = null;
    saveData();
  } catch (err) {
    console.error(err);
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

  if (!user) {
    currentPage = "auth";
    app.innerHTML = renderAuth();
    setupLogo();
    return;
  }

  if (currentPage === "members" && !isAdmin()) currentPage = "home";

  if (currentPage === "home") app.innerHTML = renderHome(user);
  if (currentPage === "log") app.innerHTML = renderLog(user);
  if (currentPage === "schedule") app.innerHTML = renderSchedule(user);
  if (currentPage === "redeem") app.innerHTML = renderRedeem(user);
  if (currentPage === "voucher") app.innerHTML = renderVoucher(user);
  if (currentPage === "account") app.innerHTML = renderAccount(user);
  if (currentPage === "members") app.innerHTML = renderMembers();

  setupLogo();
}

function renderAuth() {
  return `
    <section class="card center-card">
      <h2>Food Seva Tracker</h2>
      <p class="small-muted">Signup or login to continue.</p>

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
  `;
}

function renderHome(user) {
  return `
    <section class="grid">
      <div class="card">
        <div class="welcome-row">
          <div class="welcome-text">
            <h1>Welcome, ${escapeHtml(user.name)}</h1>
            <p>Food Seva Tracker is a simple Karma Credit system for seva work at Chinmaya Mission. You log the time you helped, earn KC based on how long you worked, and redeem those points for Food, Books, or Karma. Karma means donation, so the app keeps your rewards and donation options in one place. One KC equals five US dollars in redeem value.</p>
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
        <p class="small-muted">1. Sign up or log in.<br>2. Log the date and time you helped.<br>3. Earn KC automatically from the time you worked.<br>4. Redeem KC for Food, Books, or Karma.<br>5. Use the Voucher tab to see what you have available.</p>
      </div>
    </section>
  `;
}

function renderLog(user) {
  return `
    <section class="card">
      <h2>Log Time</h2>
      <p class="small-muted">Choose a date, start time, and end time. Results update automatically as you type.</p>
      <div class="row wrap">
        <div style="flex:1;min-width:220px"><label for="logDate">Date</label><input id="logDate" type="date" min="${todayISO()}" oninput="updateLogPreview()" /></div>
        <div style="flex:1;min-width:220px"><label for="startTime">Start Time</label><input id="startTime" type="time" oninput="updateLogPreview()" /></div>
        <div style="flex:1;min-width:220px"><label for="endTime">End Time</label><input id="endTime" type="time" oninput="updateLogPreview()" /></div>
      </div>
      <div class="footer-space"></div>
      <div class="card" style="background:#fbfdff;border-style:dashed;">
        <div class="row space-between">
          <div>
            <div class="small-muted">Total Time</div>
            <div id="previewDuration" style="font-weight:800;">0 min</div>
          </div>
          <div style="text-align:right">
            <div class="small-muted">KC Earned</div>
            <div id="previewKC" style="font-weight:800;">0.0 KC</div>
          </div>
        </div>
      </div>
      <button class="btn" onclick="saveLog()">Log Time</button>
      <div class="footer-space"></div>
      <h3>Recent Logs</h3>
      <div class="list">
        ${user.logs.length ? user.logs.map(log => `
          <div class="item">
            <strong>${formatMDY(log.date)}</strong>
            <div class="small-muted">${displayTime(log.start)} - ${displayTime(log.end)}</div>
            <div class="small-muted">${log.kc} KC earned</div>
          </div>
        `).join("") : `<div class="item small-muted">No logs yet.</div>`}
      </div>
    </section>
  `;
}

function renderSchedule(user) {
  const entries = data.users
    .flatMap(u => (u.logs || []).map((log, index) => ({
      date: log.date,
      name: u.name,
      email: u.email,
      start: log.start,
      end: log.end,
      kc: log.kc,
      logIndex: index
    })))
    .sort((a, b) => {
      if (a.date === b.date) return a.start.localeCompare(b.start);
      return a.date.localeCompare(b.date);
    });

  const grouped = {};
  for (const entry of entries) {
    if (!grouped[entry.date]) grouped[entry.date] = [];
    grouped[entry.date].push(entry);
  }

  const dates = Object.keys(grouped).sort();

  return `
    <section class="card">
      <h2>Schedule</h2>
      <p class="small-muted">This shows when everyone is coming to help.</p>
      ${dates.length ? dates.map(date => `
        <div class="card schedule-card">
          <div class="schedule-date">${formatWeekdayMDY(date)}</div>
          ${grouped[date].map(item => `
            <div class="schedule-entry">
              <div class="schedule-main">
                <div class="schedule-name">${escapeHtml(item.name)}</div>
                <div class="small-muted">${displayTime(item.start)} to ${displayTime(item.end)}</div>
              </div>
              ${isAdmin() ? `
                <button class="trash-btn" type="button" onclick="deleteScheduleEntry('${escapeHtml(item.email)}', '${item.logIndex}')">🗑</button>
              ` : ""}
            </div>
          `).join("")}
        </div>
      `).join("") : `<div class="item small-muted">No schedule yet. When someone logs time, it will appear here.</div>`}
    </section>
  `;
}

function renderRedeem(user) {
  return `
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
  `;
}

function renderVoucher(user) {
  return `
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
  `;
}

function renderAccount(user) {
  return `
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
  `;
}

function renderMembers() {
  const members = data.users.filter(u => !u.admin);
  return `
    <section class="card">
      <h2>Members</h2>
      <p class="small-muted">Click a member to view their vouchers and admin options.</p>
      <div class="list">
        ${members.length ? members.map(user => `
          <button type="button" class="item redeem-choice ${selectedMemberEmail === user.email ? "active" : ""}" onclick="selectMember('${escapeHtml(user.email)}')">
            <strong>${escapeHtml(user.name)}</strong>
            <div class="small-muted">${escapeHtml(user.email)}</div>
            <div class="small-muted">${user.kc.toFixed(1)} KC</div>
          </button>
        `).join("") : `<div class="item small-muted">No Members yet. When someone logs in or signs up, they will be added here.</div>`}
      </div>
      ${selectedMemberEmail ? renderSelectedMember(selectedMemberEmail) : ""}
      <hr />
      <h3>Admins</h3>
      <div class="list">
        ${data.users.filter(u => u.admin).map(user => `
          <div class="item">
            <strong>${escapeHtml(user.name)}${currentUser() && user.email === currentUser().email ? " (You)" : ""}</strong>
            <div class="small-muted">${escapeHtml(user.email)}</div>
          </div>
        `).join("")}
      </div>
      <div class="footer-space"></div>
      <button class="btn" onclick="addAdminEmail()">Add Admin</button>
    </section>
  `;
}

function renderSelectedMember(email) {
  const user = data.users.find(u => u.email === email);
  if (!user) return "";
  const isSelf = currentUser() && currentUser().email.toLowerCase() === user.email.toLowerCase();
  const canRemoveAdmin = user.admin && user.email.toLowerCase() !== data.adminSeed.email.toLowerCase();
  const canRemoveMember = !user.admin && !isSelf;
  return `
    <div style="margin-top:16px" class="card">
      <div class="member-close"><button class="close-btn" type="button" onclick="closeMember()">×</button></div>
      <h3>${escapeHtml(user.name)}</h3>
      <p class="small-muted">${escapeHtml(user.email)}</p>
      <p class="small-muted">${user.kc.toFixed(1)} KC</p>
      <h4>Vouchers</h4>
      <div class="list">
        ${Object.entries(user.vouchers).map(([category, usd]) => `
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
        <button class="btn secondary ${canRemoveAdmin ? "" : "hidden"}" onclick="removeAdminForMember('${escapeHtml(user.email)}')">Remove Admin</button>
        <button class="btn danger ${canRemoveMember ? "" : "hidden"}" onclick="removeMember('${escapeHtml(user.email)}')">Remove Member</button>
      </div>
    </div>
  `;
}

function setAuthMode(mode) {
  authMode = mode;
  currentPage = "auth";
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

async function submitAuth() {
  if (!authMode) return alert("Choose Signup or Login first.");
  const name = document.getElementById("authName")?.value.trim() || "";
  const email = document.getElementById("authEmail")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("authPassword")?.value || "";
  const confirm = document.getElementById("authConfirm")?.value || "";

  try {
    if (authMode === "signup") {
      if (!name || !email || !password || !confirm) return alert("Fill out all signup fields.");
      if (password !== confirm) return alert("Passwords do not match.");
      const user = await api("/api/auth/signup", "POST", { name, email, password, adminSeed: data.adminSeed });
      data.currentUserEmail = user.email;
      currentPage = "home";
      await loadFromMongo();
      saveData();
      render();
      return;
    }

    if (authMode === "login") {
      if (!name || !email || !password) return alert("Enter name, email, and password.");
      const user = await api("/api/auth/login", "POST", { name, email, password });
      data.currentUserEmail = user.email;
      currentPage = "home";
      await loadFromMongo();
      saveData();
      render();
    }
  } catch (err) {
    alert(err.message);
  }
}

function logout() {
  data.currentUserEmail = "";
  saveData();
  currentPage = "auth";
  selectedMemberEmail = null;
  authMode = "signup";
  render();
}

function updateLogPreview() {
  const date = document.getElementById("logDate")?.value;
  const start = document.getElementById("startTime")?.value;
  const end = document.getElementById("endTime")?.value;
  const durationEl = document.getElementById("previewDuration");
  const kcEl = document.getElementById("previewKC");
  if (!durationEl || !kcEl) return;
  if (!date || !start || !end) {
    durationEl.textContent = "0 min";
    kcEl.textContent = "0.0 KC";
    return;
  }
  if (date < todayISO()) {
    durationEl.textContent = "Invalid date";
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
  const kc = roundToHalf(minutes / 60);
  durationEl.textContent = `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
  kcEl.textContent = `${kc.toFixed(1)} KC`;
}

async function saveLog() {
  const user = currentUser();
  const date = document.getElementById("logDate")?.value;
  const start = document.getElementById("startTime")?.value;
  const end = document.getElementById("endTime")?.value;
  if (!date || !start || !end) return alert("Please fill in date, start time, and end time.");
  if (date < todayISO()) return alert("You cannot pick a past date.");
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (endMinutes <= startMinutes) return alert("End time must be after start time.");
  const minutes = endMinutes - startMinutes;
  if (minutes <= 10) return alert("Time must be more than 10 minutes.");
  const kc = roundToHalf(minutes / 60);
  if (kc < 0.5) return alert("Minimum KC is 0.5.");
  user.kc = Number((user.kc + kc).toFixed(1));
  user.logs.unshift({ date, start, end, kc: kc.toFixed(1) });
  user.history.unshift(`Logged ${kc.toFixed(1)} KC for ${date}`);
  try {
    await api(`/api/app/users/${encodeURIComponent(user.email)}`, "PUT", user);
    await loadFromMongo();
    alert(`Logged successfully. You earned ${kc.toFixed(1)} KC.`);
    render();
  } catch (err) {
    alert(err.message);
  }
}

function setRedeemCategory(value) {
  redeemCategory = value;
  render();
}

function changeRedeemKC(delta) {
  redeemKC = Math.max(0.5, Math.min(10, Number((redeemKC + delta).toFixed(1))));
  render();
}

async function confirmRedeem() {
  const user = currentUser();
  if (user.kc < redeemKC) return alert("Not enough KC.");
  const usd = Number((redeemKC * 5).toFixed(2));
  user.kc = Number((user.kc - redeemKC).toFixed(1));
  user.vouchers[redeemCategory] = Number((user.vouchers[redeemCategory] + usd).toFixed(2));
  user.history.unshift(`Redeemed ${redeemKC.toFixed(1)} KC for ${redeemCategory}`);
  try {
    await api(`/api/app/users/${encodeURIComponent(user.email)}`, "PUT", user);
    await loadFromMongo();
    alert(`Created ${redeemCategory} voucher for $${usd.toFixed(2)}.`);
    currentPage = "voucher";
    render();
  } catch (err) {
    alert(err.message);
  }
}

async function saveAccount() {
  const user = currentUser();
  const name = document.getElementById("accName").value.trim();
  const email = document.getElementById("accEmail").value.trim().toLowerCase();
  const password = document.getElementById("accPassword").value;
  if (!name || !email || !password) return alert("All fields are required.");
  const oldEmail = user.email;
  user.name = name;
  user.email = email;
  user.password = password;
  data.currentUserEmail = email;
  try {
    await api(`/api/app/users/${encodeURIComponent(oldEmail)}`, "PUT", user);
    await loadFromMongo();
    alert("Account saved.");
    render();
  } catch (err) {
    alert(err.message);
  }
}

async function addAdminEmail() {
  const email = prompt("Enter the email to make admin:");
  if (!email) return;
  const clean = email.trim().toLowerCase();
  const existing = data.users.find(u => u.email.toLowerCase() === clean);
  if (existing) {
    existing.admin = true;
    await api(`/api/app/users/${encodeURIComponent(existing.email)}`, "PUT", existing);
  }
  saveData();
  await loadFromMongo();
  alert("Admin added.");
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

async function deductVoucher(email) {
  const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return;
  const amount = parseFloat(document.getElementById("deductAmount").value);
  if (!amount || amount <= 0) return alert("Enter a valid amount.");
  if (user.email.toLowerCase() === currentUser().email.toLowerCase()) return alert("Admins cannot deduct from themselves.");
  const current = Number(user.vouchers[deductCategory] || 0);
  const next = Math.max(0, current - amount);
  user.vouchers[deductCategory] = Number(next.toFixed(2));
  try {
    await api(`/api/app/users/${encodeURIComponent(user.email)}`, "PUT", user);
    await loadFromMongo();
    alert(`Removed $${amount.toFixed(2)} from ${user.name}'s ${deductCategory} voucher.`);
    render();
  } catch (err) {
    alert(err.message);
  }
}

async function removeAdminForMember(email) {
  const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return;
  if (user.email.toLowerCase() === data.adminSeed.email.toLowerCase()) return alert("This admin cannot be removed.");
  if (user.email.toLowerCase() === currentUser().email.toLowerCase() && user.admin) return alert("Admins cannot remove themselves.");
  user.admin = false;
  try {
    await api(`/api/app/users/${encodeURIComponent(user.email)}`, "PUT", user);
    await loadFromMongo();
    alert(`${user.name} is no longer an admin.`);
    render();
  } catch (err) {
    alert(err.message);
  }
}

async function removeMember(email) {
  const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return;
  if (user.email.toLowerCase() === data.adminSeed.email.toLowerCase()) return alert("This admin cannot be removed.");
  if (user.email.toLowerCase() === currentUser().email.toLowerCase()) return alert("Admins cannot remove themselves.");
  if (!confirm(`Remove ${user.name}?`)) return;
  try {
    await fetch(`${API_BASE}/api/app/users/${encodeURIComponent(user.email)}`, { method: "DELETE" });
    await loadFromMongo();
    selectedMemberEmail = null;
    alert("Member removed.");
    render();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteScheduleEntry(email, logIndex) {
  if (!isAdmin()) return alert("Admins only.");
  const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.logs || !user.logs[logIndex]) return;
  if (!confirm("Delete this schedule entry?")) return;
  user.logs.splice(logIndex, 1);
  try {
    await api(`/api/app/users/${encodeURIComponent(user.email)}`, "PUT", user);
    await loadFromMongo();
    render();
  } catch (err) {
    alert(err.message);
  }
}

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
window.updateLogPreview = updateLogPreview;
window.saveLog = saveLog;
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
window.setPage = page => {
  currentPage = page;
  render();
};

loadFromMongo().then(() => {
  currentPage = "auth";
  authMode = "signup";
  data.currentUserEmail = "";
  saveData();
  render();
});
