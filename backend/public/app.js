(async function () {
  const $ = (sel) => document.querySelector(sel);

  const priceEl = $('#price');
  const walletEl = $('#wallet');
  const chipsEl = $('#chips');
  const costEl = $('#cost');
  const outTokensEl = $('#outTokens');
  const errEl = $('#err');

  const showFeeBtn = $('#showFee');
  const mintBtn = $('#mintBtn');           // may be null (we removed the outer button)
  const mintBtnModal = $('#mintBtnModal'); // the button inside modal

  const overlay = $('#overlay');
  const feeAddrEl = $('#feeAddr');
  const targetAmtEl = $('#targetAmt');
  const explLink = $('#explLink');
  const copyBtn = $('#copyBtn');
  const closeBtn = $('#closeBtn');
  const modalErr = $('#modalErr');

  let mintFeeSats = 0;
  let feeAddress = '';
  let tokenName = 'Lightning Bold';
  let maxPerWallet = 10;
  let count = 1;

  try {
    const r = await fetch('/api/config');
    if (r.ok) {
      const cfg = await r.json();
      mintFeeSats = Number(cfg.feeSats);
      feeAddress = String(cfg.feeAddress);
      tokenName = 'Lightning Bold';
      maxPerWallet = Number(cfg.maxMintsPerWallet || 10);
      const viewerBase = String(cfg.explorerBase || 'https://www.sparkscan.io');
      explLink.href = `${viewerBase}${viewerBase.includes('?') ? '&' : '?'}address=${encodeURIComponent(feeAddress)}`;
    }
  } catch {}

  function renderPrice() {
    if (mintFeeSats > 0) {
      priceEl.textContent = `Mint fee: ${mintFeeSats} sats each • Max ${maxPerWallet}/wallet`;
    } else {
      priceEl.textContent = `Loading price…`;
    }
  }
  renderPrice();

  function renderCost() {
    const total = count * (mintFeeSats || 0);
    costEl.textContent = mintFeeSats ? total : '—';
    outTokensEl.textContent = `You receive: ${count} ${tokenName}`;
  }
  renderCost();

  chipsEl.addEventListener('click', (ev) => {
    const n = ev.target?.dataset?.x;
    if (!n) return;
    const next = Number(n);
    if (![1,2,5,10].includes(next)) return;
    count = next;
    chipsEl.querySelectorAll('.chip').forEach(el => el.classList.remove('active'));
    ev.target.classList.add('active');
    renderCost();
  });

  showFeeBtn.addEventListener('click', () => {
    errEl.textContent = '';
    modalErr.textContent = '';
    if (!feeAddress) {
      modalErr.textContent = 'Fee address not available.';
      overlay.style.display = 'flex';
      return;
    }
    const total = count * (mintFeeSats || 0);
    feeAddrEl.textContent = feeAddress;
    targetAmtEl.textContent = total > 0 ? String(total) : '—';
    overlay.style.display = 'flex';
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(feeAddress);
      copyBtn.textContent = 'Copied';
      setTimeout(()=> { copyBtn.textContent = 'Copy'; }, 1000);
    } catch {}
  });

  closeBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  async function submitPaid() {
    modalErr.textContent = '';
    errEl.textContent = '';
    const wallet = walletEl.value.trim();
    if (!wallet) { modalErr.textContent = 'Destination wallet required.'; return; }

    const payload = { wallet, qty: count, amount_sats: count * (mintFeeSats || 0) };
    try {
      if (mintBtn) { mintBtn.disabled = true; mintBtn.textContent = 'Processing…'; }
      if (mintBtnModal) { mintBtnModal.disabled = true; mintBtnModal.textContent = 'Processing…'; }

      const r = await fetch('/api/paid', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (j.ok) {
        modalErr.style.color = '#9ee39e';
        modalErr.textContent = 'Saved. We recorded your payment intent.';
        errEl.style.color = '#9ee39e';
        errEl.textContent = 'Saved to notepad.';
      } else {
        modalErr.style.color = '#ff8a8a';
        modalErr.textContent = j.error || 'Server error.';
      }
    } catch {
      modalErr.style.color = '#ff8a8a';
      modalErr.textContent = 'Network/Server error.';
    } finally {
      if (mintBtn) { mintBtn.disabled = false; mintBtn.textContent = 'I have paid'; }
      if (mintBtnModal) { mintBtnModal.disabled = false; mintBtnModal.textContent = 'I have paid'; }
    }
  }

  // register listeners only if elements exist
  if (mintBtn) mintBtn.addEventListener('click', submitPaid);
  if (mintBtnModal) mintBtnModal.addEventListener('click', submitPaid);
})();
