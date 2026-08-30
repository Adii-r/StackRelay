import { animate, stagger } from "https://cdn.jsdelivr.net/npm/motion@11/+esm";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clientSegments = ["seg-c0", "seg-c1", "seg-c2"].map((id) => document.getElementById(id));
const serverSegments = ["seg-s0", "seg-s1", "seg-s2", "seg-s3"].map((id) => document.getElementById(id));
const lbNode = document.getElementById("lb-node");
const algoSub = document.getElementById("algo-sub");
const streamBtn = document.getElementById("stream-btn");
const resetBtn = document.getElementById("lb-reset-btn");
const logBody = document.getElementById("lb-log-body");
const algoButtons = document.querySelectorAll("#algo-select button");

const packets = [document.getElementById("lb-packet"), document.getElementById("lb-packet-2"), document.getElementById("lb-packet-3")];
let packetCursor = 0;

const servers = [0, 1, 2, 3].map((i) => {
  const el = document.getElementById(`server-${i}`);
  return {
    el,
    fill: el.querySelector(".load-fill"),
    load: 0,
    offline: false,
  };
});

const algoNames = { rr: "round robin", lc: "least connections", wt: "weighted random" };
let algo = "rr";
let rrPointer = 0;

let streaming = false;
let streamTimer = null;
let decayTimer = null;
let startTime = performance.now();

function stamp() {
  const t = (performance.now() - startTime) / 1000;
  const m = Math.floor(t / 60).toString().padStart(2, "0");
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  const ms = Math.floor((t % 1) * 100).toString().padStart(2, "0");
  return `${m}:${s}:${ms}`;
}

function log(text, kind) {
  const old = logBody.querySelector(".cursor");
  if (old) old.remove();
  const line = document.createElement("div");
  line.className = `line ${kind || ""}`;
  line.innerHTML = `<span class="t">${stamp()}</span><span class="m">${text}<span class="cursor"></span></span>`;
  logBody.appendChild(line);
  logBody.scrollTop = logBody.scrollHeight;
  while (logBody.children.length > 40) logBody.removeChild(logBody.firstChild);
  if (!reduced) {
    animate(line, { opacity: [0, 1], x: [-6, 0] }, { duration: 0.28, easing: "ease-out" });
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function stagePoint(pathEl, t) {
  const len = pathEl.getTotalLength();
  return pathEl.getPointAtLength(len * t);
}

function tracePacket(pathEl, duration) {
  const packet = packets[packetCursor];
  packetCursor = (packetCursor + 1) % packets.length;
  return new Promise((resolve) => {
    packet.style.opacity = "1";
    if (reduced) {
      const p = stagePoint(pathEl, 1);
      packet.style.transform = `translate(${p.x}px, ${p.y}px) rotate(45deg)`;
      packet.style.opacity = "0";
      resolve();
      return;
    }
    const start = performance.now();
    function frame(now) {
      const raw = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(raw);
      const p = stagePoint(pathEl, eased);
      packet.style.transform = `translate(${p.x}px, ${p.y}px) rotate(45deg)`;
      if (raw < 1) {
        requestAnimationFrame(frame);
      } else {
        packet.style.opacity = "0";
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

function pulse(el) {
  if (reduced) return;
  animate(el.querySelector(".node-box"), { scale: [0.88, 1.1, 1] }, { duration: 0.5, easing: [0.16, 1, 0.3, 1] });
}

function updateServerVisual(s) {
  const pct = Math.max(0, Math.min(100, s.load));
  s.fill.style.width = `${pct}%`;
  s.el.dataset.load = pct > 80 ? "over" : pct > 50 ? "high" : "idle";
  s.el.dataset.offline = s.offline ? "true" : "false";
}

function pickServer() {
  const online = servers.filter((s) => !s.offline);
  if (online.length === 0) return null;

  if (algo === "rr") {
    rrPointer = rrPointer % online.length;
    const chosen = online[rrPointer];
    rrPointer++;
    return chosen;
  }

  if (algo === "lc") {
    return online.reduce((min, s) => (s.load < min.load ? s : min), online[0]);
  }

  const weights = online.map((s) => Math.max(4, 100 - s.load));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < online.length; i++) {
    r -= weights[i];
    if (r <= 0) return online[i];
  }
  return online[online.length - 1];
}

async function sendRequest() {
  const clientIdx = Math.floor(Math.random() * clientSegments.length);
  const clientSeg = clientSegments[clientIdx];

  await tracePacket(clientSeg, 550);
  pulse(lbNode);

  const target = pickServer();
  if (!target) {
    log("All servers offline — request dropped", "warn");
    return;
  }

  const idx = servers.indexOf(target);
  await tracePacket(serverSegments[idx], 600);

  target.load = Math.min(100, target.load + 14 + Math.random() * 10);
  updateServerVisual(target);
  pulse(target.el);
  const label = target.el.querySelector(".node-title").textContent;
  log(`${label} · request accepted · load ${Math.round(target.load)}%`, target.load > 80 ? "warn" : "ok");
}

function decayLoads() {
  servers.forEach((s) => {
    if (s.load > 0) {
      s.load = Math.max(0, s.load - 3.5);
      updateServerVisual(s);
    }
  });
}

function startStream() {
  if (streaming) return;
  streaming = true;
  streamBtn.textContent = "Stop Traffic";
  log("Traffic stream started", "hi");
  streamTimer = setInterval(sendRequest, 480);
  sendRequest();
}

function stopStream() {
  streaming = false;
  streamBtn.textContent = "Start Traffic";
  if (streamTimer) clearInterval(streamTimer);
  log("Traffic stream stopped");
}

function resetAll() {
  stopStream();
  servers.forEach((s) => {
    s.load = 0;
    s.offline = false;
    updateServerVisual(s);
  });
  rrPointer = 0;
  packets.forEach((p) => (p.style.opacity = "0"));
  logBody.innerHTML = '<div class="line"><span class="t">00:00:00</span><span class="m">Idle — no traffic<span class="cursor"></span></span></div>';
  startTime = performance.now();
}

streamBtn.addEventListener("click", () => (streaming ? stopStream() : startStream()));
resetBtn.addEventListener("click", resetAll);

algoButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    algoButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    algo = btn.dataset.algo;
    algoSub.textContent = algoNames[algo];
    rrPointer = 0;
    log(`Strategy switched to ${algoNames[algo]}`, "hi");
  });
});

servers.forEach((s) => {
  s.el.addEventListener("click", () => {
    s.offline = !s.offline;
    updateServerVisual(s);
    const label = s.el.querySelector(".node-title").textContent;
    log(s.offline ? `${label} taken offline` : `${label} back online`, s.offline ? "warn" : "ok");
    if (!reduced) {
      animate(s.el.querySelector(".node-box"), { rotate: [0, s.offline ? -4 : 4, 0] }, { duration: 0.4 });
    }
  });
});

decayTimer = setInterval(decayLoads, 400);

window.addEventListener("DOMContentLoaded", () => {
  if (!reduced) {
    animate(".eyebrow", { opacity: [0, 1], y: [10, 0] }, { duration: 0.5 });
    animate("h1", { opacity: [0, 1], y: [14, 0] }, { duration: 0.6, delay: 0.05 });
    animate(".lede", { opacity: [0, 1], y: [14, 0] }, { duration: 0.6, delay: 0.12 });
    animate(".controls", { opacity: [0, 1], y: [14, 0] }, { duration: 0.6, delay: 0.18 });
    animate(
      ".node",
      { opacity: [0, 1], scale: [0.75, 1] },
      { duration: 0.5, delay: stagger(0.05), easing: [0.16, 1, 0.3, 1] }
    );
    animate(".diagram-frame", { opacity: [0, 1] }, { duration: 0.7 });
  }
});
