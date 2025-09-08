import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

const app = express();
app.use(cors());              
app.use(express.json());

// ===== Mongo =====
const uri = process.env.MONGODB_URI; // добавим на Vercel
const client = new MongoClient(uri, {});

let db, menuCol, ordersCol, usersCol;
async function ensureDb() {
  if (!db) {
    await client.connect();
    db = client.db("ontaste"); // имя базы
    menuCol = db.collection("menu_items");
    ordersCol = db.collection("orders");
    usersCol = db.collection("users");
  }
}


app.use(async (req, res, next) => {
  try { await ensureDb(); next(); } 
  catch (e) { console.error(e); res.status(500).json({ error: "DB connect error" }); }
});


app.get("/api/health", (req, res) => res.json({ ok: true }));

// ===== Меню =====
app.get("/api/menu", async (req, res) => {
  const items = await menuCol.find().toArray();
  res.json(items);
});


app.get("/api/seed", async (req, res) => {
  const count = await menuCol.countDocuments();
  if (count > 0) return res.json({ seeded: false, message: "already seeded" });

  await menuCol.insertMany([
    { name: "Капучино", description: "Кофе с пеной", price: 200, image: "images/cappuccino.jpg", categories: ["all","coffee"] },
    { name: "Латте", description: "Мягкий кофе", price: 220, image: "images/latte.jpg", categories: ["all","coffee"] },
    { name: "Сэндвич", description: "Ветчина и сыр", price: 180, image: "images/sandwich.jpg", categories: ["all","food"] },
    { name: "Салат", description: "Овощной", price: 160, image: "images/salad.jpg", categories: ["all","food"] },
    { name: "Чизкейк", description: "Классический", price: 200, image: "images/cheesecake.jpg", categories: ["all","desserts"] },
    { name: "Брауни", description: "Шоколадный", price: 180, image: "images/brownie.jpg", categories: ["all","desserts"] }
  ]);
  res.json({ seeded: true });
});


app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body; // без шифрования — учебно
  if (!name || !email || !password) return res.status(400).json({ error: "fields required" });
  const exists = await usersCol.findOne({ email });
  if (exists) return res.status(409).json({ error: "user exists" });

  await usersCol.insertOne({ name, email, password, createdAt: new Date() });
  res.json({ ok: true });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await usersCol.findOne({ email, password });
  if (!user) return res.status(401).json({ error: "invalid creds" });
  res.json({ ok: true, user: { name: user.name, email: user.email } });
});

// ===== Заказы =====
app.post("/api/order", async (req, res) => {
  
  const order = req.body;
  order.createdAt = new Date();
  order.status = "В обработке";
  const result = await ordersCol.insertOne(order);
  res.json({ ok: true, id: result.insertedId });
});

app.get("/api/orders/:email", async (req, res) => {
  const email = req.params.email;
  const list = await ordersCol.find({ userEmail: email }).sort({ createdAt: -1 }).toArray();
  res.json(list);
});

// В Vercel НЕ вызываем app.listen — экспортируем app
export default app;
