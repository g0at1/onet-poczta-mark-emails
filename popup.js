const status = document.getElementById("status");

const folderIdInput = document.getElementById("folderId");
const folderNameInput = document.getElementById("folderName");
const limitInput = document.getElementById("limit");

const runButton = document.getElementById("run");

const foldersById = {
  "29999": "Odebrane",
  "30002": "Spam"
};

const folders = {
  "Odebrane": "29999",
  "Spam": "30002"
};

function updateButtonText() {
  const limit = limitInput.value || 1000;
  runButton.textContent = `Mark ${limit} as read`;
}

function syncFolderName() {
  const folderId = folderIdInput.value.trim();

  if (foldersById[folderId]) {
    folderNameInput.value = foldersById[folderId];
  }
}

function syncFolderId() {
  const folderName = folderNameInput.value;

  if (folders[folderName]) {
    folderIdInput.value = folders[folderName];
  }
}

updateButtonText();
syncFolderName();
syncFolderId();

limitInput.addEventListener("input", updateButtonText);

folderIdInput.addEventListener("input", syncFolderName);
folderNameInput.addEventListener("change", syncFolderId);

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
    .filter(m => {
      const flags = m.flags || m.mailFlags || [];

      if (Array.isArray(flags)) {
        return !flags.includes("\\Seen") && !flags.includes("Seen");
      }

      if (typeof flags === "string") {
        return !flags.includes("\\Seen") && !flags.includes("Seen");
      }

      if (typeof m.unread === "boolean") {
        return m.unread;
      }

      if (typeof m.isRead === "boolean") {
        return !m.isRead;
      }

      if (typeof m.read === "boolean") {
        return !m.read;
      }

      return true;
    })
    .map(m => String(m.mid || m.id))
    .filter(Boolean);

  if (!mids.length) {
    return "No unread mails to mark.";
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
