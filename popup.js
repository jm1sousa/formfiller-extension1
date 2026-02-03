// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const filledCount = document.getElementById('filledCount');
const currentLoop = document.getElementById('currentLoop');
const delayInput = document.getElementById('delay');
const submitDelayInput = document.getElementById('submitDelay');
const autoSubmitCheckbox = document.getElementById('autoSubmit');
const loopCountInput = document.getElementById('loopCount');

// Load saved settings
chrome.storage.local.get(['settings', 'stats', 'isRunning'], (data) => {
  if (data.settings) {
    delayInput.value = data.settings.delay || 500;
    submitDelayInput.value = data.settings.submitDelay || 1000;
    autoSubmitCheckbox.checked = data.settings.autoSubmit !== false;
    loopCountInput.value = data.settings.loopCount || 0;
  }
  if (data.stats) {
    filledCount.textContent = data.stats.filledCount || 0;
    currentLoop.textContent = data.stats.currentLoop || 0;
  }
  if (data.isRunning) {
    updateUIRunning(true);
  }
});

// Save settings on change
function saveSettings() {
  const settings = {
    delay: parseInt(delayInput.value) || 500,
    submitDelay: parseInt(submitDelayInput.value) || 1000,
    autoSubmit: autoSubmitCheckbox.checked,
    loopCount: parseInt(loopCountInput.value) || 0
  };
  chrome.storage.local.set({ settings });
}

delayInput.addEventListener('change', saveSettings);
submitDelayInput.addEventListener('change', saveSettings);
autoSubmitCheckbox.addEventListener('change', saveSettings);
loopCountInput.addEventListener('change', saveSettings);

// Update UI based on running state
function updateUIRunning(isRunning) {
  if (isRunning) {
    statusIndicator.classList.add('running');
    statusText.textContent = 'A preencher...';
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else {
    statusIndicator.classList.remove('running');
    statusText.textContent = 'Parado';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

// Start button click
startBtn.addEventListener('click', async () => {
  saveSettings();
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    statusText.textContent = 'Erro: Nenhuma aba activa';
    statusIndicator.classList.add('error');
    return;
  }

  const settings = {
    delay: parseInt(delayInput.value) || 500,
    submitDelay: parseInt(submitDelayInput.value) || 1000,
    autoSubmit: autoSubmitCheckbox.checked,
    loopCount: parseInt(loopCountInput.value) || 0
  };

  chrome.storage.local.set({ isRunning: true, stats: { filledCount: 0, currentLoop: 0 } });
  updateUIRunning(true);

  chrome.tabs.sendMessage(tab.id, { action: 'start', settings });
});

// Stop button click
stopBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.storage.local.set({ isRunning: false });
  updateUIRunning(false);
  
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: 'stop' });
  }
});

// Listen for updates from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'statsUpdate') {
    filledCount.textContent = message.filledCount;
    currentLoop.textContent = message.currentLoop;
    chrome.storage.local.set({ 
      stats: { 
        filledCount: message.filledCount, 
        currentLoop: message.currentLoop 
      } 
    });
  }
  if (message.type === 'stopped') {
    updateUIRunning(false);
    chrome.storage.local.set({ isRunning: false });
  }
  if (message.type === 'error') {
    statusIndicator.classList.add('error');
    statusText.textContent = message.message;
  }
});
