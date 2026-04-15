// Background service worker for Vize Form Doldur extension

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Vize Form Doldur eklentisi yüklendi');
  
  if (details.reason === 'install') {
    // First time installation
    console.log('İlk kurulum tamamlandı');
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Eklenti güncellendi');
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Eklenti başlatıldı');
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Mesaj alındı:', message);
  
  // Handle any background processing if needed
  if (message.action === 'log') {
    console.log('Content script log:', message.data);
  }
  
  return true;
});

// Storage change listener
chrome.storage.onChanged.addListener((changes, area) => {
  console.log('Storage değişikliği:', changes, area);
});

// Handle tab updates (optional - for future features)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only react to complete page loads on visa form site
  if (changeInfo.status === 'complete' && 
      tab.url && 
      tab.url.includes('consular.mfa.gov.cn')) {
    console.log('Vize form sayfası yüklendi');
  }
});

// Utility function to inject content script if needed
async function ensureContentScriptInjected(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    console.log('Content script enjekte edildi');
  } catch (error) {
    console.error('Content script enjekte edilemedi:', error);
  }
}

// Keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Just a simple operation to keep service worker active
    chrome.storage.local.get('keepAlive');
  }
});