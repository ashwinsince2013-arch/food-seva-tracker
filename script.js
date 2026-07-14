const STORAGE_KEY = "foodSevaTrackerData";

const defaultData = {
  currentUserEmail: "",
  adminSeed: {
    name: "Arunkumar Rajasekar",
    email: "akrwins@gmail.com",
    password: "AshwinKumar123"
  },
  users: [
    {
      name: "Arunkumar Rajasekar",
      email: "akrwins@gmail.com",
      password: "AshwinKumar123",
      admin: true,
      kc: 2,
      vouchers: { Food: 5, Books: 0, Karma: 0 },
      logs: [],
      history: []
    }
  ],
  pendingAdminEmails: []
};

let data = loadData();
let currentPage = "home";
let redeemCategory = "Food";
let redeemKC = 1.0;
let selectedMemberEmail = null;
let deductCategory = "Food";
let authMode = null;

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultData);
  try {
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultData),
      ...parsed,
      users: parsed.users || structuredClone(defaultData.users),
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

function updateTabsVisibility() {
  const tabs = document.getElementById("tabs");
  const user = currentUser();
  tabs.classList.toggle("hidden", !user);

  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === currentPage);
    if (btn.classList.contains("admin-only")) {
      btn.classList.toggle("hidden", !isAdmin());
    }
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

  if (img.complete && img.naturalWidth > 0) {
    img.classList.remove("hidden");
  }
}

function render() {
  const app = document.getElementById("app");
  const user = currentUser();
  updateTabsVisibility();

  if (!user) {
    app.innerHTML = renderAuth();
    setupLogo();
    return;
  }

  if (currentPage === "members" && !isAdmin()) currentPage = "home";

  if (currentPage === "home") app.innerHTML = renderHome(user);
  if (currentPage === "log") app.innerHTML = renderLog(user);
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
        <input id="authPassword" type="password" placeholder="Choose a password" />

        <label for="authConfirm">Confirm Password</label>
        <input id="authConfirm" type="password" placeholder="Confirm your password" />
      ` : ""}

      ${authMode === "login" ? `
        <label for="authName">Name</label>
        <input id="authName" type="text" placeholder="Your name" />

        <label for="authEmail">Email</label>
        <input id="authEmail" type="email" placeholder="name@example.com" />

        <label for="authPassword">Password</label>
        <input id="authPassword" type="password" placeholder="Your password" />
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
            <p>
              Food Seva Tracker is a simple Karma Credit system for seva work at Chinmaya Mission.
              You log the time you helped, earn KC based on how long you worked, and redeem those points
              for Food, Books, or Karma. Karma means donation, so the app keeps your rewards and donation
              options in one place. One KC equals five US dollars in redeem value.
            </p>
          </div>

          <div class="kc-box">
            <div class="kc-number">${user.kc.toFixed(1)} KC</div>
            <div class="kc-label">1 KC = $5 USD</div>
          </div>
        </div>

        <hr />

        <h3>What KC Means</h3>
        <p class="small-muted">
          KC stands for Karma Credit. If you work from 9:00 AM to 10:30 AM, that is 1 hour 30 minutes,
          so you earn 1.5 KC. Logs under or equal to 10 minutes are not counted, and time is rounded
          to the nearest 0.5 KC.
        </p>

        <hr />

        <h3>Redeem Categories</h3>
        <div class="list">
          <div class="item">
            <strong><span class="redeem-icon">🍲</span>Food</strong>
            <div class="small-muted">Use your KC to enjoy meals at Chinmaya Mission.</div>
          </div>
          <div class="item">
            <strong><span class="redeem-icon">📚</span>Books</strong>
            <div class="small-muted">Use your KC to purchase spiritual and educational books.</div>
          </div>
          <div class="item">
            <strong><span class="redeem-icon">🙏</span>Karma (Donation)</strong>
            <div class="small-muted">Use your KC to make a donation and serve more.</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>How It Works</h3>
        <p class="small-muted">
          1. Sign up or log in.<br>
          2. Log the date and time you helped.<br>
          3. Earn KC automatically from the time you worked.<br>
          4. Redeem KC for Food, Books, or Karma.<br>
          5. Use the Voucher tab to see what you have available.
        </p>
      </div>
    </section>
  `;
}

function renderLog(user) {
  return `
    <section class="card">
      <h2>Log Time</h2>
      <p class="small-muted">
        Choose a date, start time, and end time. Results update automatically as you type.
      </p>

      <div class="row wrap">
        <div style="flex:1;min-width:220px">
          <label for="logDate">Date</label>
          <input id="logDate" type="date" min="${todayISO()}" oninput="updateLogPreview()" />
        </div>
        <div style="flex:1;min-width:220px">
          <label for="startTime">Start Time</label>
          <input id="startTime" type="time" oninput="updateLogPreview()" />
        </div>
        <div style="flex:1;min-width:220px">
          <label for="endTime">End Time</label>
          <input id="endTime" type="time" oninput="updateLogPreview()" />
        </div>
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
            <strong>${escapeHtml(log.date)}</strong>
            <div class="small-muted">${log.start} - ${log.end}</div>
            <span class="badge">${log.kc} KC</span>
          </div>
        `).join("") : `<div class="item small-muted">No logs yet.</div>`}
      </div>
    </section>
  `;
}

function renderRedeem(user) {
  return `
    <section class="card">
      <h2>Redeem</h2>
      <p class="small-muted">You have ${user.kc.toFixed(1)} KC, worth $${kcToUsd(user.kc)} USD.</p>

      <div class="list">
        <button class="item redeem-choice ${redeemCategory === "Food" ? "active" : ""}" onclick="setRedeemCategory('Food')" aria-label="Food" type="button">
          <strong><span class="redeem-icon">🍲</span>Food</strong>
          <div class="small-muted">Use your KC to enjoy meals at Chinmaya Mission.</div>
        </button>

        <button class="item redeem-choice ${redeemCategory === "Books" ? "active" : ""}" onclick="setRedeemCategory('Books')" aria-label="Books" type="button">
          <strong><span class="redeem-icon">📚</span>Books</strong>
          <div class="small-muted">Use your KC to purchase spiritual and educational books.</div>
        </button>

        <button class="item redeem-choice ${redeemCategory === "Karma" ? "active" : ""}" onclick="setRedeemCategory('Karma')" aria-label="Karma Donation" type="button">
          <strong><span class="redeem-icon">🙏</span>Karma (Donation)</strong>
          <div class="small-muted">Use your KC to make a donation and serve more.</div>
        </button>
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
      <input id="accPassword" type="password" value="${escapeHtml(user.password)}" />

      <div class="footer-space"></div>

      <div class="row">
        <button class="btn" onclick="saveAccount()">Save Changes</button>
        <button class="btn danger" onclick="logout()">Log Out</button>
      </div>
    </section>
  `;
}

function renderMembers() {
  return `
    <section class="card">
      <h2>Member Tab</h2>
      <p class="small-muted">Click a member to view their vouchers and admin options.</p>

      <div class="list">
        ${data.users.map(user => `
          <button
            type="button"
            class="item redeem-choice ${selectedMemberEmail === user.email ? "active" : ""}"
            onclick="selectMember('${escapeHtml(user.email)}')"
            aria-label="${escapeHtml(user.name)}"
          >
            <strong>${escapeHtml(user.name)}${user.admin ? " (Admin)" : ""}</strong>
            <div class="small-muted">${escapeHtml(user.email)}</div>
            <div class="small-muted">${user.kc.toFixed(1)} KC</div>
          </button>
        `).join("")}
      </div>

      ${selectedMemberEmail ? renderSelectedMember(selectedMemberEmail) : ""}

      <hr />

      <h3>Admins</h3>
      <div class="list">
        ${data.users.filter(u => u.admin).map(user => `
          <div class="item">
            <strong>${escapeHtml(user.name)}${user.email === currentUser().email ? " (You)" : ""}</strong>
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

  const lockedAdmin = user.email.toLowerCase() === data.adminSeed.email.toLowerCase();
  const isSelf = currentUser().email.toLowerCase() === user.email.toLowerCase();
  const canRemoveAdmin = user.admin && !lockedAdmin;
  const canRemoveMember = !lockedAdmin && !isSelf;

  return `
    <div style="margin-top:16px" class="card">
      <div class="member-close">
        <button class="close-btn" type="button" aria-label="Close member profile" onclick="closeMember()">×</button>
      </div>

      <h3>${escapeHtml(user.name)}${user.admin ? " (Admin)" : ""}</h3>
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
  render();
}

function submitAuth() {
  if (!authMode) return alert("Choose Signup or Login first.");

  const name = document.getElementById("authName")?.value.trim() || "";
  const email = document.getElementById("authEmail")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("authPassword")?.value || "";
  const confirm = document.getElementById("authConfirm")?.value || "";

  if (authMode === "signup") {
    if (!name || !email || !password || !confirm) return alert("Fill out all signup fields.");
    if (password !== confirm) return alert("Passwords do not match.");

    const existing = data.users.find(u => u.email.toLowerCase() === email);
    if (existing) return alert("Account already exists. Please log in.");

    const admin = data.pendingAdminEmails.includes(email) || (email === data.adminSeed.email.toLowerCase() && password === data.adminSeed.password);
    data.users.push({
      name,
      email,
      password,
      admin,
      kc: 0,
      vouchers: { Food: 0, Books: 0, Karma: 0 },
      logs: [],
      history: []
    });
    data.currentUserEmail = email;
    saveData();
    render();
    return;
  }

  if (authMode === "login") {
    if (!name || !email || !password) return alert("Enter name, email, and password.");

    const existing = data.users.find(u => u.email.toLowerCase() === email);
    if (!existing) return alert("No account found. Please sign up.");
    if (existing.password !== password) return alert("Wrong password.");
    if (existing.name.toLowerCase() !== name.toLowerCase()) return alert("Name does not match.");

    if (data.pendingAdminEmails.includes(existing.email.toLowerCase())) {
      existing.admin = true;
    }

    data.currentUserEmail = existing.email;
    saveData();
    render();
  }
}

function logout() {
  data.currentUserEmail = "";
  saveData();
  currentPage = "home";
  selectedMemberEmail = null;
  authMode = null;
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

function saveLog() {
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
  user.logs.unshift({
    date,
    start,
    end,
    kc: kc.toFixed(1)
  });

  user.history.unshift(`Logged ${kc.toFixed(1)} KC for ${date}`);
  saveData();
  alert(`Logged successfully. You earned ${kc.toFixed(1)} KC.`);
  render();
}

function setRedeemCategory(value) {
  redeemCategory = value;
  render();
}

function changeRedeemKC(delta) {
  redeemKC = Math.max(0.5, Math.min(10, Number((redeemKC + delta).toFixed(1))));
  render();
}

function confirmRedeem() {
  const user = currentUser();
  if (user.kc < redeemKC) return alert("Not enough KC.");

  const usd = Number((redeemKC * 5).toFixed(2));
  user.kc = Number((user.kc - redeemKC).toFixed(1));
  user.vouchers[redeemCategory] = Number((user.vouchers[redeemCategory] + usd).toFixed(2));
  user.history.unshift(`Redeemed ${redeemKC.toFixed(1)} KC for ${redeemCategory}`);

  saveData();
  alert(`Created ${redeemCategory} voucher for $${usd.toFixed(2)}.`);
  currentPage = "voucher";
  render();
}

function saveAccount() {
  const user = currentUser();
  const name = document.getElementById("accName").value.trim();
  const email = document.getElementById("accEmail").value.trim().toLowerCase();
  const password = document.getElementById("accPassword").value;

  if (!name || !email || !password) return alert("All fields are required.");

  user.name = name;
  user.email = email;
  user.password = password;
  data.currentUserEmail = email;

  saveData();
  alert("Account saved.");
  render();
}

function addAdminEmail() {
  const email = prompt("Enter the email to make admin:");
  if (!email) return;

  const clean = email.trim().toLowerCase();
  if (!data.pendingAdminEmails.includes(clean)) {
    data.pendingAdminEmails.push(clean);
  }

  const existing = data.users.find(u => u.email.toLowerCase() === clean);
  if (existing) existing.admin = true;

  saveData();
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

function deductVoucher(email) {
  const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return;

  const amount = parseFloat(document.getElementById("deductAmount").value);

  if (!amount || amount <= 0) return alert("Enter a valid amount.");
  if (user.email.toLowerCase() === currentUser().email.toLowerCase()) return alert("Admins cannot deduct from themselves.");

  const current = Number(user.vouchers[deductCategory] || 0);
  const next = Math.max(0, current - amount);
  user.vouchers[deductCategory] = Number(next.toFixed(2));

  saveData();
  alert(`Removed $${amount.toFixed(2)} from ${user.name}'s ${deductCategory} voucher.`);
  render();
}

function removeAdminForMember(email) {
  const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return;

  const lockedAdmin = user.email.toLowerCase() === data.adminSeed.email.toLowerCase();
  if (lockedAdmin) return alert("This admin cannot be removed.");
  if (user.email.toLowerCase() === currentUser().email.toLowerCase() && user.admin) return alert("Admins cannot remove themselves.");

  user.admin = false;
  data.pendingAdminEmails = data.pendingAdminEmails.filter(e => e !== user.email.toLowerCase());
  saveData();
  alert(`${user.name} is no longer an admin.`);
  render();
}

function removeMember(email) {
  const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return;

  const lockedAdmin = user.email.toLowerCase() === data.adminSeed.email.toLowerCase();
  if (lockedAdmin) return alert("This admin cannot be removed.");
  if (user.email.toLowerCase() === currentUser().email.toLowerCase()) return alert("Admins cannot remove themselves.");

  if (!confirm(`Remove ${user.name}?`)) return;
  data.users = data.users.filter(u => u.email.toLowerCase() !== email.toLowerCase());
  data.pendingAdminEmails = data.pendingAdminEmails.filter(e => e !== email.toLowerCase());
  if (selectedMemberEmail === email) selectedMemberEmail = null;
  saveData();
  alert("Member removed.");
  render();
}

document.addEventListener("click", (e) => {
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
window.setPage = page => { currentPage = page; render(); };

render();