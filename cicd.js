import { animate, stagger } from "https://cdn.jsdelivr.net/npm/motion@11/+esm";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const nodeMeta = [
  { id: "node-0", title: "COMMIT", ok: "commit received on main" },
  { id: "node-1", title: "BUILD", ok: "artifacts compiled" },
  { id: "node-2", title: "TEST", ok: "unit + lint suite passed" },
  { id: "node-3", title: "SCAN", ok: "no vulnerable dependencies found", fail: "vulnerable dependency detected" },
  { id: "node-4", title: "STAGE", ok: "deployed to staging" },
  { id: "node-5", title: "VERIFY", ok: "integration checks passed" },
  { id: "node-6", title: "APPROVE", ok: "release approved" },
  { id: "node-7", title: "PROD", ok: "production release live" },
];

const nodes = nodeMeta.map((m) => document.getElementById(m.id));
const rollbackNode = document.getElementById("node-rollback");
const segments = [0, 1, 2, 3, 4, 5, 6].map((i) => document.getElementById(`seg-${i}`));
const rollbackPath = document.getElementById("rollback-path");
const packet = document.getElementById("packet");
const logBody = document.getElementById("log-body");
const runBtn = document.getElementById("run-btn");
const resetBtn = document.getElementById("reset-btn");
const failToggle = document.getElementById("fail-toggle");
const stage = document.getElementById("stage");

let running = false;
let startTime = 0;

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
  const cursor = kind === "final" ? "" : '<span class="cursor"></span>';
  line.innerHTML = `<span class="t">${stamp()}</span><span class="m">${text}${cursor}</span>`;
  logBody.appendChild(line);
  logBody.scrollTop = logBody.scrollHeight;
  if (!reduced) {
    animate(line, { opacity: [0, 1], x: [-6, 0] }, { duration: 0.3, easing: "ease-out" });
  }
}

function setNodeState(el, state) {
  el.dataset.state = state;
  if (!reduced && (state === "active" || state === "fail")) {
    animate(
      el.querySelector(".node-box"),
      { scale: [0.85, 1.12, 1] },
      { duration: 0.55, easing: [0.16, 1, 0.3, 1] }
    );
  }
}

function stagePoint(pathEl, t) {
  const len = pathEl.getTotalLength();
  return pathEl.getPointAtLength(len * t);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function tracePacket(pathEl, duration, failStyle) {
  return new Promise((resolve) => {
    packet.classList.toggle("packet-fail", !!failStyle);
    packet.style.opacity = "1";
    if (reduced) {
      const p = stagePoint(pathEl, 1);
      packet.style.transform = `translate(${p.x}px, ${p.y}px) rotate(45deg)`;
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
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resetAll() {
  running = false;
  runBtn.disabled = false;
  runBtn.textContent = "Run Deployment";
  packet.style.opacity = "0";
  packet.style.transform = "translate(-999px,-999px) rotate(45deg)";
  packet.classList.remove("packet-fail");
  nodes.forEach((n) => (n.dataset.state = "idle"));
  rollbackNode.dataset.state = "idle";
  segments.forEach((s) => s.classList.remove("trace-active", "trace-pass", "trace-fail"));
  rollbackPath.classList.remove("trace-fail-active");
  logBody.innerHTML = '<div class="line"><span class="t">00:00:00</span><span class="m">Awaiting trigger<span class="cursor"></span></span></div>';
}

async function runPipeline() {
  if (running) return;
  running = true;
  startTime = performance.now();
  runBtn.disabled = true;
  runBtn.textContent = "Deploying…";
  nodes.forEach((n) => (n.dataset.state = "idle"));
  rollbackNode.dataset.state = "idle";
  segments.forEach((s) => s.classList.remove("trace-active", "trace-pass", "trace-fail"));
  rollbackPath.classList.remove("trace-fail-active");
  logBody.innerHTML = "";

  const willFail = failToggle.checked;

  setNodeState(nodes[0], "active");
  log(`${nodeMeta[0].title} · ${nodeMeta[0].ok}`, "ok");
  await wait(350);
  setNodeState(nodes[0], "pass");

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const nextNode = nodes[i + 1];
    const meta = nodeMeta[i + 1];

    seg.classList.add("trace-active");
    await tracePacket(seg, reduced ? 1 : 700, false);
    seg.classList.remove("trace-active");
    seg.classList.add("trace-pass");
    packet.style.opacity = "0";

    setNodeState(nextNode, "active");
    log(`${meta.title} · running…`, "hi");
    await wait(reduced ? 1 : 500);

    if (meta.id === "node-3" && willFail) {
      setNodeState(nextNode, "fail");
      log(`${meta.title} · ${meta.fail}`, "warn");
      await wait(400);

      rollbackPath.classList.add("trace-fail-active");
      await tracePacket(rollbackPath, reduced ? 1 : 750, true);
      packet.style.opacity = "0";
      setNodeState(rollbackNode, "fail");
      log("Deployment rolled back — production untouched", "warn");

      running = false;
      runBtn.disabled = false;
      runBtn.textContent = "Run Deployment";
      return;
    }

    setNodeState(nextNode, "pass");
    log(`${meta.title} · ${meta.ok}`, "ok");
  }

  log("Deployment succeeded — production live", "final");
  setNodeState(nodes[nodes.length - 1], "live");

  running = false;
  runBtn.disabled = false;
  runBtn.textContent = "Run Deployment";
}

runBtn.addEventListener("click", runPipeline);
resetBtn.addEventListener("click", resetAll);

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
