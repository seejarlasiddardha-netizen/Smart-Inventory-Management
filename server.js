const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const db = new sqlite3.Database(path.join(__dirname, 'data', 'smartstock.db'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err); else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        await run(`CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category TEXT DEFAULT 'General',
          space INTEGER NOT NULL CHECK(space > 0),
          benefit REAL NOT NULL CHECK(benefit >= 0),
          quantity INTEGER DEFAULT 1 CHECK(quantity = 1),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        await run(`CREATE TABLE IF NOT EXISTS optimization_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          capacity INTEGER NOT NULL,
          max_benefit REAL NOT NULL,
          used_space INTEGER NOT NULL,
          selected_count INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        const count = await get('SELECT COUNT(*) AS count FROM products');
        if (count.count === 0) {
          const seed = [
            ['Laptop', 'Electronics', 4, 90],
            ['Headphones', 'Electronics', 3, 50],
            ['Keyboard', 'Accessories', 2, 40],
            ['Mouse', 'Accessories', 1, 20],
            ['Monitor', 'Electronics', 5, 100],
            ['Printer', 'Office', 6, 85],
            ['Webcam', 'Electronics', 2, 45]
          ];
          for (const p of seed) await run('INSERT INTO products (name, category, space, benefit) VALUES (?, ?, ?, ?)', p);
        }
        resolve();
      } catch (e) { reject(e); }
    });
  });
}

// 0/1 Knapsack: each product is either selected once (1) or not selected (0).
function knapsack(products, capacity) {
  const n = products.length;
  const dp = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const product = products[i - 1];
    for (let c = 0; c <= capacity; c++) {
      if (product.space > c) {
        dp[i][c] = dp[i - 1][c];
      } else {
        const skip = dp[i - 1][c];
        const take = product.benefit + dp[i - 1][c - product.space];
        dp[i][c] = Math.max(skip, take);
      }
    }
  }

  const selected = [];
  let c = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][c] !== dp[i - 1][c]) {
      const p = products[i - 1];
      selected.push(p);
      c -= p.space;
    }
  }
  selected.reverse();

  const usedSpace = selected.reduce((sum, p) => sum + p.space, 0);
  return { maxBenefit: dp[n][capacity], selected, usedSpace, remainingSpace: capacity - usedSpace };
}

app.get('/api/products', async (req, res) => {
  try { res.json(await all('SELECT * FROM products ORDER BY id')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, category = 'General', space, benefit } = req.body;
    if (!name || !Number.isInteger(Number(space)) || Number(space) <= 0 || Number(benefit) < 0) {
      return res.status(400).json({ error: 'Name, positive integer space, and non-negative benefit are required.' });
    }
    const result = await run('INSERT INTO products (name, category, space, benefit) VALUES (?, ?, ?, ?)', [name.trim(), category.trim(), Number(space), Number(benefit)]);
    res.status(201).json(await get('SELECT * FROM products WHERE id = ?', [result.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await run('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (!result.changes) return res.status(404).json({ error: 'Product not found.' });
    res.json({ message: 'Product deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/optimize', async (req, res) => {
  try {
    const capacity = Number(req.body.capacity);
    if (!Number.isInteger(capacity) || capacity <= 0) return res.status(400).json({ error: 'Capacity must be a positive integer.' });
    const products = await all('SELECT * FROM products ORDER BY id');
    if (!products.length) return res.status(400).json({ error: 'Add at least one product.' });
    const result = knapsack(products, capacity);
    await run('INSERT INTO optimization_runs (capacity, max_benefit, used_space, selected_count) VALUES (?, ?, ?, ?)', [capacity, result.maxBenefit, result.usedSpace, result.selected.length]);
    res.json({ capacity, totalProducts: products.length, ...result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats', async (req, res) => {
  try {
    const productCount = await get('SELECT COUNT(*) AS value FROM products');
    const totalSpace = await get('SELECT COALESCE(SUM(space), 0) AS value FROM products');
    const totalBenefit = await get('SELECT COALESCE(SUM(benefit), 0) AS value FROM products');
    const runs = await all('SELECT * FROM optimization_runs ORDER BY id DESC LIMIT 8');
    res.json({ productCount: productCount.value, totalSpace: totalSpace.value, totalBenefit: totalBenefit.value, runs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initDb().then(() => {
  app.listen(PORT, () => console.log(`SmartStock running at http://localhost:${PORT}`));
}).catch(err => { console.error(err); process.exit(1); });
