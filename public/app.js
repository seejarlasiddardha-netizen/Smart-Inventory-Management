const $ = (id) => document.getElementById(id);
const money = (n) => `₹${Number(n).toLocaleString('en-IN', {maximumFractionDigits: 2})}`;
let products = [];
let toastTimeout;

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function toast(message) {
  const t = $('toast'); t.textContent = message; t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2600);
}

async function loadProducts() {
  products = await api('/api/products');
  renderProducts(); renderChart(); await loadStats();
}
function renderProducts() {
  $('productCountLabel').textContent = `${products.length} product${products.length === 1 ? '' : 's'}`;
  $('productTable').innerHTML = products.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.category)}</td>
      <td>${p.space}</td>
      <td>${money(p.benefit)}</td>
      <td>${(p.benefit / p.space).toFixed(2)}</td>
      <td><button class="delete" onclick="deleteProduct(${p.id})">Delete</button></td>
    </tr>`).join('');
}
function escapeHtml(value) { return String(value).replace(/[&<>']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
async function deleteProduct(id) { try { await api(`/api/products/${id}`, {method:'DELETE'}); toast('Product deleted'); await loadProducts(); } catch(e) { toast(e.message); } }
window.deleteProduct = deleteProduct;

$('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = $('addProductBtn');
  button.disabled = true;
  button.textContent = 'Adding product...';
  try {
    await api('/api/products', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
      name:$('name').value, category:$('category').value || 'General', space:Number($('space').value), benefit:Number($('benefit').value)
    })});
    e.target.reset(); toast('Product added'); await loadProducts();
  } catch(err) { toast(err.message); }
  finally {
    button.disabled = false;
    button.textContent = '+ Add Product';
  }
});

$('optimizeBtn').addEventListener('click', async () => {
  const button = $('optimizeBtn');
  button.disabled = true;
  button.textContent = 'Optimizing...';
  try {
    const result = await api('/api/optimize', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({capacity:Number($('capacity').value)})});
    $('resultSection').classList.remove('hidden');
    $('maxBenefit').textContent = money(result.maxBenefit);
    $('usedSpace').textContent = `${result.usedSpace} / ${result.capacity}`;
    $('remainingSpace').textContent = result.remainingSpace;
    $('selectedCount').textContent = result.selected.length;
    $('selectedProducts').innerHTML = result.selected.map(p => `<span class="pill">${escapeHtml(p.name)} • ${p.space} space • ${money(p.benefit)}</span>`).join('') || '<span class="pill">No products selected</span>';
    $('resultSection').scrollIntoView({behavior:'smooth', block:'start'});
    await loadStats(); toast('Optimization complete');
  } catch(err) { toast(err.message); }
  finally {
    button.disabled = false;
    button.textContent = 'Optimize Inventory →';
  }
});

async function loadStats() {
  try {
    const s = await api('/api/stats');
    $('statProducts').textContent = s.productCount;
    $('statSpace').textContent = s.totalSpace;
    $('statBenefit').textContent = money(s.totalBenefit);
    $('statLast').textContent = s.runs.length ? money(s.runs[0].max_benefit) : '—';
  } catch(e) {
    toast(e.message);
    throw e;
  }
}
function renderChart() {
  const max = Math.max(...products.map(p => p.benefit), 1);
  $('chart').innerHTML = products.map(p => `<div class="bar-row"><span>${escapeHtml(p.name)}</span><div class="bar-bg"><div class="bar" style="width:${(p.benefit/max)*100}%"></div></div><strong>${money(p.benefit)}</strong></div>`).join('') || '<p class="hint">No products yet.</p>';
}
loadProducts().catch(e => toast(e.message));
