chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    chrome.tabs.sendMessage(tabId, {
        tabId,
        changeInfo,
        tab
    });
});