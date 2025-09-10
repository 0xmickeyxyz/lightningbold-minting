(async function () {
  const $ = (sel) => document.querySelector(sel);

  const priceEl = $('#price');
  const walletEl = $('#wallet');
  const chipsEl = $('#chips');
  const costEl = $('#cost');
  const outTokensEl = $('#outTokens');
  const errEl = $('#err');

  const showFeeBtn = $('#showFee');

  const overlay = $('#overlay');
  const feeAddrEl = $('#feeAddr');
  const targetAmtEl = $('#targetAmt');
  const explLink = $('#explLink');
  const copyBtn = $('#copyBtn');
  const closeBtn = $('#closeBtn');
  const modalErr = $('#modalErr');
  const modalPaidBtn = $('#modalPaidBtn');

  let mintFeeSats = 0;
  let feeAddress = '';
  let tokenName = 'Lightning Bold';
  let tokenSymbol = 'BOLD';
  let tokensPerMint = 1000;
  let tokenDecimals = 8;
  let maxPerWallet = 10;
  let viewerBase = 'https://www.sparkscan.io';
  let count = 1;

  try {
    const r = await fetch('/api/config', { headers: { accept: 'application/json' } });
    if (r.ok) {
      const cfg = await r.json();
      mintFeeSats   = Number(cfg.feeSats ?? 0);
      feeAddress    = String(cfg.feeAddress ?? '');
      tokenName     = String(cfg.tokenName ?? 'Lightning Bold');
      tokenSymbol   = String(cfg.tokenSymbol ?? 'BOLD');
      tokensPerMint = Number(cfg.tokensPerMint ?? 1000);
      tokenDecimals = Number(cfg.tokenDecimals ?? 8);
      maxPerWallet  = Number(cfg.maxMintsPerWallet ?? 10);
      viewerBase    = String(cfg.explorerBase ?? 'https://www.sparkscan.io');

      const link = viewerBase.includes('/address/')
        ? `${viewerBase}`
        : `${viewerBase.replace(/\/$/, '')}/address/${encodeURIComponent(feeAddress)}`;
      explLink.href = link;
    }
  } catch (e) {
    console.warn('Config fetch failed', e);
  }

  function renderPrice() {
    if (mintFeeSats > 0) {
      priceEl.textContent = `Mint fee: ${mintFeeSats} sats each • Max ${maxPerWallet}/wallet`;
    } else {
      priceEl.textContent = `Loading price…`;
    }
  }
  function renderCost() {
    const totalSats = count * (mintFeeSats || 0);
    costEl.textContent = mintFeeSats ? String(totalSats) : '—';
    const totalTokens = count * tokensPerMint;
    outTokensEl.textContent = `You receive: ${totalTokens.toLocaleString()} ${tokenName} ($${tokenSymbol})`;
  }
  renderPrice(); renderCost();

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
    errEl.style.color = '';
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

  modalPaidBtn?.addEventListener('click', async () => {
    modalErr.textContent = '';
    errEl.textContent = '';
    errEl.style.color = '';

    const wallet = walletEl.value.trim();
    if (!wallet) { modalErr.textContent = 'Destination wallet is required.'; return; }
    if (![1,2,5,10].includes(count)) { modalErr.textContent = 'Select amount first.'; return; }

    try {
      modalPaidBtn.disabled = true;
      modalPaidBtn.textContent = 'Processing...';
      const r = await fetch('/api/i-paid', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ wallet, qty: count, amount_sats: count * (mintFeeSats || 0) })
      });
      const j = await r.json();
      if (j?.ok && j.status === 'RECORDED') {
        errEl.style.color = '#9ee39e';
        errEl.textContent = 'Saved. We recorded your payment intent.';
        overlay.style.display = 'none';
      } else {
        modalErr.textContent = j?.message || 'Server error.';
      }
    } catch {
      modalErr.textContent = 'Network/Server error.';
    } finally {
      modalPaidBtn.disabled = false;
      modalPaidBtn.textContent = 'I have paid';
    }
  });
})();
