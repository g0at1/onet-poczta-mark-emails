const statusElement =
  document.getElementById("status");

const languageInput =
  document.getElementById("language");

const folderIdInput =
  document.getElementById("folderId");

const folderNameInput =
  document.getElementById("folderName");

const limitInput =
  document.getElementById("limit");

const runButton =
  document.getElementById("run");

const deleteSpamButton =
  document.getElementById("deleteSpam");

const foldersById = {
  "29999": "Odebrane",
  "30002": "Spam"
};

const folders = {
  Odebrane: "29999",
  Spam: "30002"
};

function getSavedLanguage() {
  return new Promise(resolve => {
    chrome.storage.local.get(
      {
        language: "en"
      },
      result => {
        resolve(result.language);
      }
    );
  });
}

function saveLanguage(language) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      {
        language
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              chrome.runtime.lastError.message
            )
          );

          return;
        }

        resolve();
      }
    );
  });
}

function updateButtonText() {
  const limit =
    Math.max(
      1,
      Number(limitInput.value)
    ) || 1000;

  runButton.textContent = i18n.t(
    "buttons.markAsRead",
    {
      count: limit
    }
  );
}

function syncFolderName() {
  const folderId =
    folderIdInput.value.trim();

  const folderName =
    foldersById[folderId];

  if (folderName) {
    folderNameInput.value =
      folderName;
  }
}

function syncFolderId() {
  const folderName =
    folderNameInput.value;

  const folderId =
    folders[folderName];

  if (folderId) {
    folderIdInput.value =
      folderId;
  }
}

async function changeLanguage(language) {
  statusElement.textContent = "";

  await saveLanguage(language);
  await i18n.init(language);

  languageInput.value =
    i18n.language;

  updateButtonText();
}

async function getActiveOnetTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (
    !tab?.id ||
    !tab.url?.includes("poczta.onet.pl")
  ) {
    return null;
  }

  return tab;
}

function executeTabScript(options) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      options,
      results => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              chrome.runtime.lastError.message
            )
          );

          return;
        }

        resolve(results);
      }
    );
  });
}

async function handleMarkAsRead() {
  statusElement.textContent =
    i18n.t("status.starting");

  runButton.disabled = true;

  try {
    const folderId =
      folderIdInput.value.trim() ||
      "29999";

    const folderName =
      folderNameInput.value ||
      "Odebrane";

    const limit =
      Math.max(
        1,
        Number(limitInput.value)
      ) || 1000;

    const tab =
      await getActiveOnetTab();

    if (!tab) {
      statusElement.textContent =
        i18n.t(
          "status.openOnetFirst"
        );

      return;
    }

    const results =
      await executeTabScript({
        target: {
          tabId: tab.id
        },
        func: markOnetAsRead,
        args: [
          folderId,
          folderName,
          limit
        ]
      });

    const result =
      results?.[0]?.result;

    if (!result) {
      statusElement.textContent =
        i18n.t("status.done");

      return;
    }

    switch (result.type) {
      case "success":
        statusElement.textContent =
          i18n.t(
            "status.markedAsRead",
            {
              count: result.count
            }
          );
        break;

      case "empty":
        statusElement.textContent =
          i18n.t(
            "status.noUnreadMails"
          );
        break;

      case "error":
        statusElement.textContent =
          i18n.t(
            "status.error",
            {
              status:
                result.status,
              message:
                result.message
            }
          );
        break;

      default:
        statusElement.textContent =
          i18n.t("status.done");
    }
  } catch (error) {
    console.error(error);

    statusElement.textContent =
      i18n.t(
        "status.unexpectedError",
        {
          message:
            error.message
        }
      );
  } finally {
    runButton.disabled = false;
  }
}

async function handleDeleteSpam() {
  const confirmed = confirm(
    i18n.t("confirm.deleteSpam")
  );

  if (!confirmed) {
    return;
  }

  statusElement.textContent =
    i18n.t("status.deletingSpam");

  deleteSpamButton.disabled = true;

  try {
    const tab =
      await getActiveOnetTab();

    if (!tab) {
      statusElement.textContent =
        i18n.t(
          "status.openOnetFirst"
        );

      return;
    }

    const results =
      await executeTabScript({
        target: {
          tabId: tab.id
        },
        func: deleteOnetSpam,
        args: [
          folders.Spam
        ]
      });

    const result =
      results?.[0]?.result;

    if (!result) {
      statusElement.textContent =
        i18n.t(
          "status.spamDeletionCompleted"
        );

      return;
    }

    switch (result.type) {
      case "success":
        statusElement.textContent =
          i18n.t(
            "status.spamDeleted"
          );
        break;

      case "error":
        statusElement.textContent =
          i18n.t(
            "status.error",
            {
              status:
                result.status,
              message:
                result.message
            }
          );
        break;

      default:
        statusElement.textContent =
          i18n.t(
            "status.spamDeletionCompleted"
          );
    }
  } catch (error) {
    console.error(error);

    statusElement.textContent =
      i18n.t(
        "status.unexpectedError",
        {
          message:
            error.message
        }
      );
  } finally {
    deleteSpamButton.disabled = false;
  }
}

async function initializePopup() {
  const savedLanguage =
    await getSavedLanguage();

  await i18n.init(savedLanguage);

  languageInput.value =
    i18n.language;

  syncFolderName();
  updateButtonText();

  languageInput.addEventListener(
    "change",
    async event => {
      try {
        await changeLanguage(
          event.target.value
        );
      } catch (error) {
        console.error(error);

        statusElement.textContent =
          i18n.t(
            "status.unexpectedError",
            {
              message:
                error.message
            }
          );
      }
    }
  );

  limitInput.addEventListener(
    "input",
    updateButtonText
  );

  folderIdInput.addEventListener(
    "input",
    syncFolderName
  );

  folderNameInput.addEventListener(
    "change",
    syncFolderId
  );

  runButton.addEventListener(
    "click",
    handleMarkAsRead
  );

  deleteSpamButton.addEventListener(
    "click",
    handleDeleteSpam
  );
}

async function markOnetAsRead(
  folderId,
  folderName,
  limit
) {
  try {
    const params =
      new URLSearchParams({
        withLabels: "1",
        withTotalCount: "1",
        offset: "0",
        sort: "date",
        sortDir: "desc",
        folderName,
        folderId,
        limit: String(limit)
      });

    const listUrl =
      "https://api.poczta.onet.pl/webmailapi/mail" +
      `?${params.toString()}`;

    const response = await fetch(
      listUrl,
      {
        credentials: "include"
      }
    );

    if (!response.ok) {
      const message =
        await response.text();

      return {
        type: "error",
        status: response.status,
        message
      };
    }

    const data =
      await response.json();

    const mails =
      data.mails ||
      data.mail ||
      data.items ||
      data.list ||
      data.data ||
      [];

    if (!Array.isArray(mails)) {
      return {
        type: "error",
        status: "INVALID_RESPONSE",
        message:
          "The mail list is not an array."
      };
    }

    const mids = mails
      .filter(mail => {
        const flags =
          mail.flags ||
          mail.mailFlags ||
          [];

        if (Array.isArray(flags)) {
          return (
            !flags.includes("\\Seen") &&
            !flags.includes("Seen")
          );
        }

        if (typeof flags === "string") {
          return (
            !flags.includes("\\Seen") &&
            !flags.includes("Seen")
          );
        }

        if (
          typeof mail.unread ===
          "boolean"
        ) {
          return mail.unread;
        }

        if (
          typeof mail.isRead ===
          "boolean"
        ) {
          return !mail.isRead;
        }

        if (
          typeof mail.read ===
          "boolean"
        ) {
          return !mail.read;
        }

        return true;
      })
      .map(mail => {
        return mail.mid ?? mail.id;
      })
      .filter(id => {
        return (
          id !== undefined &&
          id !== null &&
          id !== ""
        );
      })
      .map(String);

    if (!mids.length) {
      return {
        type: "empty"
      };
    }

    const markResponse =
      await fetch(
        "https://api.poczta.onet.pl/webmail/mail?flagsGroup=1",
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            accept:
              "application/json",
            "content-type":
              "application/json"
          },
          body: JSON.stringify({
            srcMailFlags: {
              [folderId]: {
                setFlags: {
                  flags: "\\Seen",
                  mids
                }
              }
            }
          })
        }
      );

    const message =
      await markResponse.text();

    if (!markResponse.ok) {
      return {
        type: "error",
        status:
          markResponse.status,
        message
      };
    }

    return {
      type: "success",
      count: mids.length
    };
  } catch (error) {
    return {
      type: "error",
      status: "NETWORK",
      message:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}

async function deleteOnetSpam(
  spamFolderId
) {
  try {
    const deleteUrl =
      "https://api.poczta.onet.pl/webmailapi/mail/all/" +
      encodeURIComponent(
        spamFolderId
      );

    const response = await fetch(
      deleteUrl,
      {
        method: "DELETE",
        credentials: "include",
        headers: {
          accept:
            "application/json"
        }
      }
    );

    const message =
      await response.text();

    if (!response.ok) {
      return {
        type: "error",
        status: response.status,
        message
      };
    }

    return {
      type: "success"
    };
  } catch (error) {
    return {
      type: "error",
      status: "NETWORK",
      message:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}

initializePopup().catch(error => {
  console.error(
    "Could not initialize popup:",
    error
  );

  statusElement.textContent =
    error.message;
});
