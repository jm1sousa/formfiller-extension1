// FormFiller Auto - Content Script
(function() {
  let isRunning = false;
  let currentLoop = 0;
  let filledCount = 0;
  let settings = {};

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
    email: () => {
      const domains = ['gmail.com', 'hotmail.com', 'outlook.pt', 'yahoo.com', 'sapo.pt'];
      const name = generators.firstName().toLowerCase() + Math.floor(Math.random() * 1000);
      return `${name}@${domains[Math.floor(Math.random() * domains.length)]}`;
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

  function getValueForField(field) {
    const name = (field.name || '').toLowerCase();
    const id = (field.id || '').toLowerCase();
    const type = (field.type || '').toLowerCase();
    const placeholder = (field.placeholder || '').toLowerCase();
    const label = getFieldLabel(field).toLowerCase();
    const combined = `${name} ${id} ${placeholder} ${label}`;

    if (type === 'email' || combined.includes('email')) return generators.email();
    if (type === 'tel' || combined.includes('phone') || combined.includes('telefone') || combined.includes('telemóvel')) return generators.phone();
    if (combined.includes('firstname') || combined.includes('primeiro')) return generators.firstName();
    if (combined.includes('lastname') || combined.includes('apelido')) return generators.lastName();
    if (combined.includes('name') || combined.includes('nome')) return generators.fullName();
    if (combined.includes('address') || combined.includes('morada')) return generators.address();
    if (combined.includes('city') || combined.includes('cidade')) return generators.city();
    if (combined.includes('postal') || combined.includes('zip')) return generators.postalCode();
    if (combined.includes('company') || combined.includes('empresa')) return generators.company();
    if (combined.includes('age') || combined.includes('idade')) return generators.age().toString();
    if (type === 'date' || combined.includes('nascimento')) return generators.date();
    if (type === 'number') {
      const min = parseInt(field.min) || 1;
      const max = parseInt(field.max) || 100;
      return generators.number(min, max).toString();
    }
    if (field.tagName.toLowerCase() === 'textarea' || combined.includes('mensagem')) return generators.paragraph();
    return generators.sentence();
  }

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

  async function fillField(field) {
    const value = getValueForField(field);
    field.focus();
    field.dispatchEvent(new Event('focus', { bubbles: true }));
    field.value = '';
    for (let i = 0; i < value.length; i++) {
      field.value = value.substring(0, i + 1);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(20);
    }
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.blur();
  }

  function fillSelect(select) {
    const options = Array.from(select.options).filter(opt => opt.value && !opt.disabled);
    if (options.length > 0) {
      const randomOption = options[Math.floor(Math.random() * options.length)];
      select.value = randomOption.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function fillCheckbox(checkbox) {
    if (Math.random() > 0.5) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function fillRadioGroup(radios) {
    if (radios.length > 0) {
      const randomRadio = radios[Math.floor(Math.random() * radios.length)];
      randomRadio.checked = true;
      randomRadio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function findSubmitButton() {
    let submit = document.querySelector('input[type="submit"]');
    if (submit && isVisible(submit)) return submit;
    submit = document.querySelector('button[type="submit"]');
    if (submit && isVisible(submit)) return submit;
    const buttons = document.querySelectorAll('button, input[type="button"]');
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      if (text.includes('submit') || text.includes('enviar') || text.includes('submeter') || 
          text.includes('continuar') || text.includes('próximo') || text.includes('seguinte')) {
        if (isVisible(btn)) return btn;
      }
    }
    return null;
  }

  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && element.offsetParent !== null;
  }

  async function fillForm() {
    if (!isRunning) return;
    currentLoop++;
    sendStats();

    const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="date"], input:not([type]), textarea');
    const selects = document.querySelectorAll('select');
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const radioGroups = {};
    
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
      const name = radio.name;
      if (!radioGroups[name]) radioGroups[name] = [];
      radioGroups[name].push(radio);
    });

    for (const field of textInputs) {
      if (!isRunning) return;
      if (isVisible(field) && !field.disabled && !field.readOnly) {
        await fillField(field);
        await sleep(settings.delay || 500);
      }
    }

    for (const select of selects) {
      if (!isRunning) return;
      if (isVisible(select) && !select.disabled) {
        fillSelect(select);
        await sleep(settings.delay || 500);
      }
    }

    for (const checkbox of checkboxes) {
      if (!isRunning) return;
      if (isVisible(checkbox) && !checkbox.disabled) {
        fillCheckbox(checkbox);
        await sleep(100);
      }
    }

    for (const name in radioGroups) {
      if (!isRunning) return;
      const visibleRadios = radioGroups[name].filter(r => isVisible(r) && !r.disabled);
      if (visibleRadios.length > 0) {
        fillRadioGroup(visibleRadios);
        await sleep(100);
      }
    }

    filledCount++;
    sendStats();

    if (settings.autoSubmit) {
      await sleep(settings.submitDelay || 1000);
      if (!isRunning) return;
      const submitBtn = findSubmitButton();
      if (submitBtn) {
        submitBtn.click();
        await sleep(2000);
        if (isRunning && (settings.loopCount === 0 || currentLoop < settings.loopCount)) {
          await sleep(1000);
          fillForm();
        } else {
          stop();
        }
      }
    } else {
      if (isRunning && (settings.loopCount === 0 || currentLoop < settings.loopCount)) {
        await sleep(2000);
        fillForm();
      } else {
        stop();
      }
    }
  }

  function sendStats() {
    chrome.runtime.sendMessage({ type: 'statsUpdate', filledCount, currentLoop });
  }

  function stop() {
    isRunning = false;
    chrome.runtime.sendMessage({ type: 'stopped' });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'start') {
      isRunning = true;
      currentLoop = 0;
      filledCount = 0;
      settings = message.settings || {};
      fillForm();
    }
    if (message.action === 'stop') {
      stop();
    }
  });

  console.log('FormFiller Auto loaded');
})();
