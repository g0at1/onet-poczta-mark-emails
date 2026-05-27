const status = document.getElementById("status");

const folderIdInput = document.getElementById("folderId");
const folderNameInput = document.getElementById("folderName");
const limitInput = document.getElementById("limit");

const runButton = document.getElementById("run");

const folders = {
  "29999": "Odebrane",
  "30002": "Spam"
};

function updateButtonText() {
  const limit = limitInput.value || 1000;
  runButton.textContent = `Oznacz ${limit} jako przeczytane`;
}

function syncFolderName() {
  const folderId = folderIdInput.value.trim();

  if (folders[folderId]) {
    folderNameInput.value = folders[folderId];
  }
}

updateButtonText();
syncFolderName();

limitInput.addEventListener("input", updateButtonText);

folderIdInput.addEventListener("input", syncFolderName);

runButton.addEventListener("click", async () => {
  status.textContent = "Starting...";

  const folderId = folderIdInput.value || "29999";
  const folderName = folderNameInput.value || "Odebrane";
  const limit = Number(limitInput.value || 1000);

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab.url?.includes("poczta.onet.pl")) {
    status.textContent = "Open poczta.onet.pl first.";
    return;
  }

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: markOnetAsRead,
      args: [folderId, folderName, limit]
    },
    (results) => {
      if (chrome.runtime.lastError) {
        status.textContent = chrome.runtime.lastError.message;
        return;
      }

      status.textContent = results?.[0]?.result || "Gotowe.";
    }
  );
});

async function markOnetAsRead(folderId, folderName, limit) {
  const offset = 0;

  const listUrl =
    `https://api.poczta.onet.pl/webmailapi/mail?withLabels=1&withTotalCount=1&offset=${offset}&sort=date&sortDir=desc&folderName=${encodeURIComponent(folderName)}&folderId=${folderId}&limit=${limit}`;

  const response = await fetch(listUrl, {
    credentials: "include"
  });

  const data = await response.json();

  const mails =
    data.mails ||
    data.mail ||
    data.items ||
    data.list ||
    data.data ||
    [];

  const mids = mails
    .map(m => String(m.mid || m.id))
    .filter(Boolean);

  if (!mids.length) {
    return "No mails to mark.";
  }

  const markResponse = await fetch(
    "https://api.poczta.onet.pl/webmail/mail?flagsGroup=1",
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        srcMailFlags: {
          [folderId]: {
            setFlags: {
              flags: "\\Seen",
              mids: mids
            }
          }
        }
      })
    }
  );

  const text = await markResponse.text();

  if (!markResponse.ok) {
    return `Error: ${markResponse.status}\n${text}`;
  }

  return `Success ✅ Marked ${mids.length} mails as read.`;
}
