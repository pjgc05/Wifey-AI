const $ = (id) => document.getElementById(id);
const messages = $("messages");
const input = $("messageInput");
let recognition = null;
const chatHistory = [];

function addMessage(text, who) {
  const node = document.createElement("div");
  node.className = `message ${who}`;
  const sender = document.createElement("span"); sender.className = "sender"; sender.textContent = who === "wifey" ? "Wifey" : "Hubby";
  const p = document.createElement("p"); p.textContent = text;
  const time = document.createElement("time"); time.textContent = new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
  node.append(sender,p,time); messages.appendChild(node); messages.scrollTop = messages.scrollHeight;
}
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = /[ñ]/i.test(text) ? "fil-PH" : "en-PH";
  utterance.rate = 0.94; utterance.pitch = 1.08;
  window.speechSynthesis.speak(utterance);
}

async function send(text) {
  const clean = text.trim();
  if (!clean) return;

  addMessage(clean, "hubby");
  input.value = "";

  chatHistory.push({
    role: "user",
    content: clean
  });

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: chatHistory
      })
    });

    if (!response.ok) {
      throw new Error("AI request failed");
    }

    const raw = await response.text();

    const reply = raw
      .split(/\r?\n/)
      .filter(line => line.startsWith("data:"))
      .map(line => {
        try {
          return JSON.parse(line.slice(5).trim()).response || "";
        } catch {
          return "";
        }
      })
      .join("");

    if (!reply) {
      throw new Error("Empty AI response");
    }

    chatHistory.push({
      role: "assistant",
      content: reply
    });

    addMessage(reply, "wifey");
    speak(reply);

  } catch (error) {
    console.error(error);
    addMessage(
      "Sorry, Mahal. I'm having trouble connecting right now.",
      "wifey"
    );
  }
}

$("sendButton").addEventListener("click",()=>send(input.value));
input.addEventListener("keydown",e=>{if(e.key==="Enter")send(input.value);});
document.querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===tab));
  ["chat","voice","about"].forEach(name=>$(`${name}Panel`).classList.toggle("hidden",name!==tab.dataset.tab));
}));
function startRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { $("voiceStatus").textContent = "Speech recognition isn't available in this browser. You can still type, and Wifey can read replies aloud."; $("voicePanelStatus").textContent = "Try Safari dictation from the iPhone keyboard microphone, or use a supported browser."; return; }
  recognition = new SR(); recognition.lang = "en-PH"; recognition.interimResults = false; recognition.maxAlternatives = 1;
  recognition.onstart = () => { $("voiceStatus").textContent = "Listening… speak now."; $("voicePanelStatus").textContent = "Listening…"; };
  recognition.onresult = e => { const said = e.results[0][0].transcript; input.value = said; send(said); $("voicePanelStatus").textContent = "Message sent."; };
  recognition.onerror = e => { $("voiceStatus").textContent = `Microphone issue: ${e.error}. Check browser permission.`; $("voicePanelStatus").textContent = "Microphone permission or speech recognition unavailable."; };
  recognition.onend = () => { if ($("voicePanelStatus").textContent === "Listening…") $("voicePanelStatus").textContent = "Ready when you are."; };
  recognition.start();
}
$("micButton").addEventListener("click",startRecognition);
$("startListening").addEventListener("click",startRecognition);
$("stopSpeaking").addEventListener("click",()=>{if(window.speechSynthesis)window.speechSynthesis.cancel();if(recognition)recognition.stop();});
$("profileButton").addEventListener("click",()=>{document.querySelector('[data-tab="about"]').click();});
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(()=>{});
