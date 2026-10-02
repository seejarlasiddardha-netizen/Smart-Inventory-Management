# SmartStock — Smart Inventory Management using 0/1 Knapsack

Hackathon-ready beginner-friendly full-stack demo.

## Stack
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js + Express
- Database: SQLite3
- Algorithm: Dynamic Programming, 0/1 Knapsack

## Run
1. Install Node.js.
2. Open this folder in VS Code.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## Problem mapping
- Product `space` = weight/capacity consumed.
- Product `benefit` = expected business benefit/profit.
- Warehouse `capacity` = knapsack capacity.
- Each product is selected at most once.

## API
- `GET /api/products` — list products
- `POST /api/products` — add product
- `DELETE /api/products/:id` — delete product
- `POST /api/optimize` — run 0/1 knapsack
- `GET /api/stats` — dashboard statistics

## Demo data
The first run seeds Laptop, Headphones, Keyboard, Mouse, Monitor, Printer and Webcam.

## DAA explanation
For `n` products and integer capacity `C`, the DP recurrence is:

`dp[i][c] = dp[i-1][c]` if product i does not fit.

Otherwise:

`dp[i][c] = max(dp[i-1][c], benefit[i] + dp[i-1][c-space[i]])`

Time complexity: O(nC)
Space complexity: O(nC)
