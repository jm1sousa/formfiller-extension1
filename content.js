// FormFiller Auto - Content Script
(function() {
  let isRunning = false;
  let filledCount = 0;
  let settings = {};
  let savedState = null;
  let widget = null;

  // Create floating draggable widget
  function createWidget() {
    if (widget) return;

    widget = document.createElement('div');
    widget.id = 'formfiller-widget';
    widget.innerHTML = `
      <div class="ff-header">
        <span class="ff-title">🔧 FormFiller</span>
        <span class="ff-status" id="ff-status">Parado</span>
      </div>
      <div class="ff-stats">
        <span id="ff-count">0</span> páginas
      </div>
      <div class="ff-controls">
        <button id="ff-start" class="ff-btn ff-btn-start">▶ Iniciar</button>
        <button id="ff-stop" class="ff-btn ff-btn-stop" disabled>⏹ Parar</button>
      </div>
    `;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      #formfiller-widget {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 200px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #374151;
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #eaeaea;
        cursor: move;
        user-select: none;
      }
      #formfiller-widget .ff-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid #374151;
      }
      #formfiller-widget .ff-title {
        font-weight: 600;
        font-size: 13px;
      }
      #formfiller-widget .ff-status {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 10px;
        background: #6b7280;
      }
      #formfiller-widget .ff-status.running {
        background: #22c55e;
      }
      #formfiller-widget .ff-status.complete {
        background: #818cf8;
      }
      #formfiller-widget .ff-stats {
        text-align: center;
        font-size: 14px;
        margin-bottom: 10px;
        color: #9ca3af;
      }
      #formfiller-widget .ff-stats span {
        font-size: 24px;
        font-weight: 700;
        color: #818cf8;
      }
      #formfiller-widget .ff-controls {
        display: flex;
        gap: 8px;
      }
      #formfiller-widget .ff-btn {
        flex: 1;
        padding: 8px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      #formfiller-widget .ff-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      #formfiller-widget .ff-btn-start {
        background: #818cf8;
        color: white;
      }
      #formfiller-widget .ff-btn-start:hover:not(:disabled) {
        background: #6366f1;
      }
      #formfiller-widget .ff-btn-stop {
        background: #ef4444;
        color: white;
      }
      #formfiller-widget .ff-btn-stop:hover:not(:disabled) {
        background: #dc2626;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(widget);

    // Make draggable
    makeDraggable(widget);

    // Button events
    document.getElementById('ff-start').addEventListener('click', () => {
      isRunning = true;
      filledCount = 0;
      clearState();
      updateWidgetUI(true);
      runFormFiller();
    });

    document.getElementById('ff-stop').addEventListener('click', () => {
      stop();
    });

    // Load saved position
    chrome.storage.local.get(['widgetPosition'], (data) => {
      if (data.widgetPosition) {
        widget.style.top = data.widgetPosition.top;
        widget.style.left = data.widgetPosition.left;
        widget.style.right = 'auto';
      }
    });
  }

  // Make element draggable
  function makeDraggable(el) {
    let isDragging = false;
    let offsetX, offsetY;

    el.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      offsetX = e.clientX - el.offsetLeft;
      offsetY = e.clientY - el.offsetTop;
      el.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      
      let newX = e.clientX - offsetX;
      let newY = e.clientY - offsetY;
      
      // Keep within viewport
      newX = Math.max(0, Math.min(newX, window.innerWidth - el.offsetWidth));
      newY = Math.max(0, Math.min(newY, window.innerHeight - el.offsetHeight));
      
      el.style.left = newX + 'px';
      el.style.top = newY + 'px';
      el.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        el.style.cursor = 'move';
        // Save position
        chrome.storage.local.set({
          widgetPosition: {
            top: el.style.top,
            left: el.style.left
          }
        });
      }
    });
  }

  // Update widget UI
  function updateWidgetUI(running, status = 'running') {
    const statusEl = document.getElementById('ff-status');
    const countEl = document.getElementById('ff-count');
    const startBtn = document.getElementById('ff-start');
    const stopBtn = document.getElementById('ff-stop');

    if (!statusEl) return;

    countEl.textContent = filledCount;

    if (running) {
      statusEl.classList.add('running');
      statusEl.classList.remove('complete');
      
      if (status === 'complete') {
        statusEl.textContent = 'Completo!';
        statusEl.classList.remove('running');
        statusEl.classList.add('complete');
      } else if (status === 'waiting') {
        statusEl.textContent = 'A aguardar...';
      } else {
        statusEl.textContent = 'A preencher...';
      }
      
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      statusEl.classList.remove('running', 'complete');
      statusEl.textContent = 'Parado';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  // Random data generators
  const generators = {
    firstName: () => {
      const names = ['João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Sofia', 'Miguel', 'Beatriz', 'André', 'Catarina', 'Rui', 'Inês', 'Tiago', 'Marta', 'Bruno'];
      return names[Math.floor(Math.random() * names.length)];
    },
    lastName: () => {
      const surnames = ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Sousa', 'Fernandes', 'Gonçalves', 'Gomes', 'Lopes', 'Marques', 'Alves'];
      return surnames[Math.floor(Math.random() * surnames.length)];
    },
    fullName: () => `${generators.firstName()} ${generators.lastName()}`,
    
    // Email with swordhealth.com domain
    email: () => {
      const firstName = generators.firstName().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const lastName = generators.lastName().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return `${firstName}.${lastName}@swordhealth.com`;
    },
    phone: () => {
      const prefixes = ['91', '92', '93', '96'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      return prefix + Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
    },
    
    address: () => {
      const streets = ['Rua', 'Avenida', 'Travessa', 'Largo', 'Praça'];
      const names = ['da Liberdade', 'dos Combatentes', 'Principal', 'Nova', 'do Comércio', 'das Flores', 'da República'];
      return `${streets[Math.floor(Math.random() * streets.length)]} ${names[Math.floor(Math.random() * names.length)]}, ${Math.floor(Math.random() * 200) + 1}`;
    },
    city: () => {
      const cities = ['Lisboa', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Aveiro', 'Viseu', 'Leiria', 'Setúbal', 'Évora', 'Funchal', 'Guimarães'];
      return cities[Math.floor(Math.random() * cities.length)];
    },
    postalCode: () => `${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 900) + 100}`,
    
    number: (min = 1, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,
    age: () => generators.number(18, 65),
    
    word: () => {
      const words = ['teste', 'exemplo', 'amostra', 'dados', 'formulário', 'resposta', 'texto', 'valor', 'informação', 'conteúdo'];
      return words[Math.floor(Math.random() * words.length)];
    },
    sentence: () => {
      const sentences = [
        'Este é um texto de teste para preenchimento automático.',
        'Resposta gerada automaticamente para fins de teste.',
        'Conteúdo de exemplo para validação do formulário.',
        'Texto aleatório para testar funcionalidades.',
        'Informação de teste sem significado real.'
      ];
      return sentences[Math.floor(Math.random() * sentences.length)];
    },
    paragraph: () => {
      const paragraphs = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        'Este é um parágrafo de teste gerado automaticamente. Contém texto suficiente para preencher campos maiores como textareas.',
        'Texto de exemplo para testes automatizados. Este conteúdo é gerado aleatoriamente e não representa informação real.'
      ];
      return paragraphs[Math.floor(Math.random() * paragraphs.length)];
    },
    
    date: () => {
      const year = generators.number(1970, 2005);
      const month = generators.number(1, 12).toString().padStart(2, '0');
      const day = generators.number(1, 28).toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    
    company: () => {
      const prefixes = ['Tech', 'Digital', 'Global', 'Inova', 'Smart', 'Pro', 'Net', 'Web'];
      const suffixes = ['Solutions', 'Systems', 'Corp', 'Labs', 'Services', 'Group', 'Consulting'];
      return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
    }
  };

  // Detect field type and return appropriate value
  function getValueForField(field) {
    const name = (field.name || '').toLowerCase();
    const id = (field.id || '').toLowerCase();
    const type = (field.type || '').toLowerCase();
    const placeholder = (field.placeholder || '').toLowerCase();
    const label = getFieldLabel(field).toLowerCase();
    
    const combined = `${name} ${id} ${placeholder} ${label}`;

    // Email
    if (type === 'email' || combined.includes('email') || combined.includes('e-mail')) {
      return generators.email();
    }
    
    // Phone
    if (type === 'tel' || combined.includes('phone') || combined.includes('telefone') || combined.includes('telemovel') || combined.includes('telemóvel') || combined.includes('contacto')) {
      return generators.phone();
    }
    
    // Name patterns
    if (combined.includes('firstname') || combined.includes('primeiro') || combined.includes('nome próprio')) {
      return generators.firstName();
    }
    if (combined.includes('lastname') || combined.includes('sobrenome') || combined.includes('apelido') || combined.includes('último')) {
      return generators.lastName();
    }
    if (combined.includes('name') || combined.includes('nome')) {
      return generators.fullName();
    }
    
    // Address
    if (combined.includes('address') || combined.includes('morada') || combined.includes('endereço')) {
      return generators.address();
    }
    if (combined.includes('city') || combined.includes('cidade') || combined.includes('localidade')) {
      return generators.city();
    }
    if (combined.includes('postal') || combined.includes('zip') || combined.includes('código')) {
      return generators.postalCode();
    }
    
    // Company
    if (combined.includes('company') || combined.includes('empresa') || combined.includes('organização')) {
      return generators.company();
    }
    
    // Age
    if (combined.includes('age') || combined.includes('idade')) {
      return generators.age().toString();
    }
    
    // Date
    if (type === 'date' || combined.includes('birth') || combined.includes('nascimento')) {
      return generators.date();
    }
    
    // Number
    if (type === 'number') {
      const min = parseInt(field.min) || 1;
      const max = parseInt(field.max) || 100;
      return generators.number(min, max).toString();
    }
    
    // Textarea
    if (field.tagName.toLowerCase() === 'textarea' || combined.includes('message') || combined.includes('mensagem') || combined.includes('comentário') || combined.includes('descrição')) {
      return generators.paragraph();
    }
    
    // Default text
    return generators.sentence();
  }

  // Get label for a field
  function getFieldLabel(field) {
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) return label.textContent;
    }
    const parentLabel = field.closest('label');
    if (parentLabel) return parentLabel.textContent;
    if (field.getAttribute('aria-label')) return field.getAttribute('aria-label');
    return '';
  }

  // Fill a single field with animation
  async function fillField(field) {
    const value = getValueForField(field) || '';
    
    // Skip if no value to fill
    if (!value || typeof value !== 'string') {
      console.warn('FormFiller: Skipping field with invalid value', field);
      return;
    }
    
    field.focus();
    field.dispatchEvent(new Event('focus', { bubbles: true }));
    
    field.value = '';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    
    for (let i = 0; i < value.length; i++) {
      field.value = value.substring(0, i + 1);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(20);
    }
    
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.blur();
    field.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Handle select elements
  function fillSelect(select) {
    const options = Array.from(select.options).filter(opt => opt.value && !opt.disabled);
    if (options.length > 0) {
      const randomOption = options[Math.floor(Math.random() * options.length)];
      select.value = randomOption.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Handle checkboxes - ALWAYS check them (for required checkboxes like terms)
  function fillCheckbox(checkbox) {
    if (!checkbox.checked) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      checkbox.dispatchEvent(new Event('click', { bubbles: true }));
    }
  }

  // Handle radio buttons
  function fillRadioGroup(radios) {
    if (radios.length > 0) {
      const randomRadio = radios[Math.floor(Math.random() * radios.length)];
      randomRadio.checked = true;
      randomRadio.dispatchEvent(new Event('change', { bubbles: true }));
      randomRadio.dispatchEvent(new Event('click', { bubbles: true }));
    }
  }

  // Sleep helper
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Find continue/next/submit button
  function findContinueButton() {
    const buttonTexts = [
      'continuar', 'próximo', 'próxima', 'seguinte', 'avançar', 
      'continue', 'next', 'submit', 'enviar', 'submeter',
      'confirmar', 'prosseguir', 'seguir'
    ];
    
    // Try buttons and inputs
    const allButtons = document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, a.button, [role="button"]');
    
    for (const btn of allButtons) {
      if (!isVisible(btn) || btn.disabled) continue;
      
      const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').toLowerCase().trim();
      
      for (const searchText of buttonTexts) {
        if (text.includes(searchText)) {
          return btn;
        }
      }
    }
    
    // Try by class/id containing button-like names
    const byClass = document.querySelector('[class*="continue"], [class*="next"], [class*="submit"], [id*="continue"], [id*="next"], [id*="submit"]');
    if (byClass && isVisible(byClass)) return byClass;
    
    return null;
  }

  // Check if element is visible
  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetParent !== null;
  }

  // Check if form is complete (no more pages)
  function isFormComplete() {
    const completeIndicators = [
      'obrigado', 'thank you', 'sucesso', 'success', 'concluído', 
      'completed', 'submitted', 'enviado', 'finalizado'
    ];
    
    const bodyText = document.body.innerText.toLowerCase();
    
    for (const indicator of completeIndicators) {
      if (bodyText.includes(indicator)) {
        // Check if there are still form fields - if so, it's probably not complete
        const hasFormFields = document.querySelectorAll('input:not([type="hidden"]), textarea, select').length > 0;
        if (!hasFormFields) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Get current page state for resuming
  function getPageState() {
    return {
      url: window.location.href,
      filledCount: filledCount,
      timestamp: Date.now()
    };
  }

  // Save state to storage
  function saveState() {
    const state = getPageState();
    chrome.storage.local.set({ formFillerState: state });
    savedState = state;
  }

  // Load state from storage
  async function loadState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['formFillerState'], (result) => {
        savedState = result.formFillerState || null;
        resolve(savedState);
      });
    });
  }

  // Clear saved state
  function clearState() {
    chrome.storage.local.remove(['formFillerState']);
    savedState = null;
  }

  // Send stats to popup
  function sendStats(status = 'running') {
    chrome.runtime.sendMessage({
      type: 'statsUpdate',
      filledCount,
      status,
      currentUrl: window.location.href
    });
  }

  // Main fill function for current page
  async function fillCurrentPage() {
    if (!isRunning) return false;

    console.log('FormFiller: Filling current page...');

    // Find all fillable fields
    const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="date"], input:not([type]), textarea');
    const selects = document.querySelectorAll('select');
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const radioGroups = {};
    
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
      const name = radio.name;
      if (!radioGroups[name]) radioGroups[name] = [];
      radioGroups[name].push(radio);
    });

    let filledAny = false;

    // Fill text inputs and textareas
    for (const field of textInputs) {
      if (!isRunning) return false;
      if (isVisible(field) && !field.disabled && !field.readOnly && !field.value) {
        await fillField(field);
        filledAny = true;
        await sleep(settings.delay || 300);
      }
    }

    // Fill selects
    for (const select of selects) {
      if (!isRunning) return false;
      if (isVisible(select) && !select.disabled && select.selectedIndex <= 0) {
        fillSelect(select);
        filledAny = true;
        await sleep(settings.delay || 300);
      }
    }

    // Fill ALL checkboxes (important for terms/conditions)
    for (const checkbox of checkboxes) {
      if (!isRunning) return false;
      if (isVisible(checkbox) && !checkbox.disabled && !checkbox.checked) {
        fillCheckbox(checkbox);
        filledAny = true;
        await sleep(100);
      }
    }

    // Fill radio groups
    for (const name in radioGroups) {
      if (!isRunning) return false;
      const visibleRadios = radioGroups[name].filter(r => isVisible(r) && !r.disabled);
      const anyChecked = visibleRadios.some(r => r.checked);
      if (visibleRadios.length > 0 && !anyChecked) {
        fillRadioGroup(visibleRadios);
        filledAny = true;
        await sleep(100);
      }
    }

    if (filledAny) {
      filledCount++;
      saveState();
      sendStats();
    }

    return filledAny;
  }

  // Wait for page to load after navigation
  function waitForPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 1000); // Extra wait for dynamic content
      } else {
        window.addEventListener('load', () => {
          setTimeout(resolve, 1000);
        }, { once: true });
      }
    });
  }

  // Main form filling loop
  async function runFormFiller() {
    if (!isRunning) return;

    console.log('FormFiller: Starting form fill process...');
    sendStats('running');

    // Fill the current page
    await fillCurrentPage();

    if (!isRunning) return;

    // Check if form is complete
    if (isFormComplete()) {
      console.log('FormFiller: Form appears complete!');
      sendStats('complete');
      stop();
      return;
    }

    // Try to find and click continue button
    const continueBtn = findContinueButton();
    
    if (continueBtn) {
      console.log('FormFiller: Found continue button, clicking...');
      await sleep(settings.submitDelay || 500);
      
      if (!isRunning) return;

      // Store current URL to detect navigation
      const currentUrl = window.location.href;
      
      // Click the button
      continueBtn.click();
      
      // Wait for potential page change
      await sleep(2000);
      
      if (!isRunning) return;

      // Check if we navigated or if content changed
      const newUrl = window.location.href;
      
      if (newUrl !== currentUrl || document.readyState !== 'complete') {
        // Page changed, wait for it to load
        await waitForPageLoad();
      }
      
      // Continue filling the next page
      if (isRunning) {
        await sleep(500);
        runFormFiller();
      }
    } else {
      // No continue button found - might be last page or stuck
      console.log('FormFiller: No continue button found. Form may be complete or requires manual action.');
      
      // Check again if complete
      await sleep(1000);
      if (isFormComplete()) {
        sendStats('complete');
        stop();
      } else {
        // Stay ready but don't loop infinitely
        sendStats('waiting');
      }
    }
  }

  // Stop automation
  function stop() {
    console.log('FormFiller: Stopped');
    isRunning = false;
    saveState();
    updateWidgetUI(false);
    chrome.runtime.sendMessage({ type: 'stopped' });
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'start') {
      console.log('FormFiller: Received start command from popup');
      isRunning = true;
      settings = message.settings || {};
      
      if (message.resume && savedState) {
        console.log('FormFiller: Resuming from saved state');
        filledCount = savedState.filledCount || 0;
      } else {
        filledCount = 0;
        clearState();
      }
      
      updateWidgetUI(true);
      runFormFiller();
    }
    
    if (message.action === 'stop') {
      stop();
    }

    if (message.action === 'getState') {
      sendResponse({ 
        hasState: !!savedState,
        state: savedState 
      });
    }
  });

  // Initialize widget and load saved state
  loadState().then(() => {
    console.log('FormFiller Auto loaded', savedState ? '(has saved state)' : '');
    createWidget();
  });
})();

