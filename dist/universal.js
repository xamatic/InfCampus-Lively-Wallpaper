const LOGIN_URL = "https://410.ncsis.gov/campus/nav-wrapper/student/portal/student/home?appName=psu410guilfordco";
const BASE_URL = "https://410.ncsis.gov/campus";

export async function openLoginTabIfNeeded() {
  const tabs = await chrome.tabs.query({});

  if (tabs.find(tab => tab.url && tab.url.includes(BASE_URL))) {
    for (const tab of tabs) {
      if (tab.url && tab.url.includes(BASE_URL)) {
        chrome.tabs.update(tab.id, { active: true }, () => {
          if (tab.windowId !== undefined) {
            chrome.windows.update(tab.windowId, { focused: true });
          }
        });
        return console.log("Refocusing opened tab");
      }
    }
  } else {
    chrome.tabs.create({ url: LOGIN_URL });
    return console.log("Opening login tab");
  }
}
