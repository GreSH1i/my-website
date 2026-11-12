(() => {
  'use strict';
  const forms = new Map();
  const labels = {
    ua: {
      idle: 'Записатись', sending: 'Надсилаємо…', retry: 'Спробувати ще раз',
      success: 'Заявку надіслано. Адміністратор зв’яжеться з вами, щоб узгодити візит.',
      error: 'Не вдалося надіслати заявку. Спробуйте ще раз або зателефонуйте: 0 800 33 03 64.',
      uncertain: 'Не вдалося підтвердити доставку заявки. Зателефонуйте, будь ласка: 0 800 33 03 64.',
      limited: 'Забагато спроб. Спробуйте пізніше або зателефонуйте: 0 800 33 03 64.',
      name: 'Введіть ваше ім’я.', phone: 'Введіть український номер: +380 та 9 цифр.'
    },
    en: {
      idle: 'Book', sending: 'Sending…', retry: 'Try again',
      success: 'Your request has been sent. The receptionist will contact you to arrange your visit.',
      error: 'Your request could not be sent. Try again or call 0 800 33 03 64.',
      uncertain: 'We could not confirm delivery of your request. Please call 0 800 33 03 64.',
      limited: 'Too many attempts. Try later or call 0 800 33 03 64.',
      name: 'Enter your name.', phone: 'Enter a Ukrainian phone number: +380 and 9 digits.'
    }
  };
  function words() { return labels[document.documentElement.lang === 'en' ? 'en' : 'ua']; }
  function digits(value) {
    let result = value.replace(/\D/g, '');
    if (result.startsWith('380')) result = result.slice(3);
    else if (result.startsWith('0')) result = result.slice(1);
    return result;
  }
  function render(item) {
    const copy = words();
    item.status.hidden = item.phase === 'idle';
    item.status.textContent = item.phase === 'idle' ? '' : copy[item.phase];
    item.status.dataset.state = item.phase;
    item.status.style.color = ['error', 'uncertain', 'limited'].includes(item.phase) ? '#dc2626' : '';
    item.form.setAttribute('aria-busy', String(item.pending));
    item.button.disabled = item.pending || item.phase === 'uncertain';
    item.button.style.opacity = item.button.disabled ? '0.65' : '';
    item.button.querySelector('span').textContent = item.pending ? copy.sending : ['error', 'limited'].includes(item.phase) ? copy.retry : copy.idle;
  }
  function initialize() {
    if (forms.size) return;
    for (const [kind, ids] of Object.entries({
      hero: ['heroBookingForm', 'heroPatientName', 'heroPatientPhone', 'heroServiceSelect', 'heroPhoneError', 'heroFormStatus'],
      main: ['bookingForm', 'patientName', 'patientPhone', 'serviceSelect', 'phoneError', 'formStatus']
    })) {
      const [form, name, phone, service, error, status] = ids.map(id => document.getElementById(id));
      if (!form || !name || !phone || !service || !status) continue;
      const item = { form, name, phone, service, error, status, button: form.querySelector('button[type="submit"]'), phase: 'idle', pending: false, signature: '', requestId: '' };
      const changed = () => {
        if (item.pending) return;
        name.setCustomValidity(''); phone.setCustomValidity('');
        phone.setAttribute('aria-invalid', 'false'); error.classList.remove('show');
        item.phase = 'idle'; render(item);
      };
      form.addEventListener('input', changed); form.addEventListener('change', changed);
      forms.set(kind, item); render(item);
    }
  }
  async function submit(event, kind) {
    event.preventDefault(); initialize();
    const item = forms.get(kind);
    if (!item || item.pending || item.phase === 'uncertain') return;
    const copy = words(); const phone = digits(item.phone.value);
    item.name.setCustomValidity(item.name.value.trim().length < 2 ? copy.name : '');
    item.phone.setCustomValidity(/^\d{9}$/.test(phone) ? '' : copy.phone);
    item.error.classList.toggle('show', !/^\d{9}$/.test(phone));
    item.phone.setAttribute('aria-invalid', String(!/^\d{9}$/.test(phone)));
    if (!item.form.reportValidity()) return;
    const data = { name: item.name.value.trim(), phone: '+380' + phone, service: item.service.value, website: item.form.querySelector('[data-esu-website]').value };
    const signature = JSON.stringify(data);
    if (signature !== item.signature) {
      item.signature = signature; item.requestId = crypto.randomUUID();
    }
    data.requestId = item.requestId;
    item.pending = true; item.phase = 'sending';
    const controls = Array.from(item.form.querySelectorAll('input, select, button')).map(element => [element, element.disabled]);
    controls.forEach(([element]) => { element.disabled = true; }); render(item);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch('/api/esutomograf/booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify(data), signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        item.phase = result.error === 'delivery_uncertain' ? 'uncertain' : response.status === 429 ? 'limited' : 'error';
      } else {
        item.phase = 'success'; item.form.reset();
        item.name.setCustomValidity(''); item.phone.setCustomValidity('');
        if (typeof syncServicePickerButtons === 'function') syncServicePickerButtons();
      }
    } catch { item.phase = 'error'; }
    finally {
      clearTimeout(timer); item.pending = false;
      controls.forEach(([element, disabled]) => { element.disabled = disabled; }); render(item);
    }
  }
  function refresh() { initialize(); forms.forEach(render); }
  window.EsutomografBooking = { submit, refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh);
  else refresh();
})();
