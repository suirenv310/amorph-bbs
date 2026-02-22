# Amorph BBS

Forum + chatroom với anonymous posting system.

## Tech Stack
- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + Realtime)
- **Discord Bot** (Python, discord.py)

---

## Setup

### 1. Supabase
1. Tạo project tại [supabase.com](https://supabase.com)
2. Vào **SQL Editor** → chạy toàn bộ `supabase/schema.sql`
3. Vào **Database → Replication** → bật Realtime cho: `messages`, `direct_messages`, `threads`, `replies`
4. Copy **Project URL** và **API Keys**

### 2. Next.js App
```bash
cp .env.example .env.local
# Điền SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

npm install
npm run dev
```

### 3. Discord Bot
```bash
cd discord-bot
pip install -r requirements.txt
cp .env.example .env
# Điền DISCORD_TOKEN, DISCORD_GUILD_ID, ADMIN_ROLE_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY

python main.py
```

**Cấp quyền bot:** `applications.commands` + `bot` với permissions:
- Send Messages, Read Message History
- Use Slash Commands
- Send Messages in DMs

---

## Permission Levels

| Level | Có thể làm |
|-------|-----------|
| Chưa login | Xem threads, xem chat |
| Login (chưa verify) | + Chat, DM, xem profile |
| Login + verified | + Đăng bài, comment (ẩn danh) |
| Admin | + Thấy identity sau Anon, quản lý toàn bộ |

---

## Verify Flow
1. User vào Discord server, dùng `/getcode`
2. Bot gửi code qua DM
3. User vào BBS → Settings → Verify → nhập code
4. Account được gắn với Discord ID, mở full quyền

---

## Anonymous System
- **Chatroom**: Hiển thị username thật
- **Forum post/comment**: Hiển thị `Anon` với mọi người
- **Admin view**: `Anon (username · discord_tag · code)`
- **DM**: Hiển thị username thật (1-1 chat)

---

## Multi-Profile
- Mỗi account có tối đa **5 profiles**
- Mỗi profile có tên + avatar symbol + màu riêng
- Switch profile trong Settings
- Post/comment dùng active profile (nhưng vẫn hiện là `Anon`)

---

## Discord Bot Commands

| Command | Ai dùng | Tác dụng |
|---------|---------|---------|
| `/getcode` | Mọi member | Nhận invite code qua DM |
| `/resetkey @user` | Admin | Revoke code cũ + tạo code mới |
| `/revoke @user` | Admin | Revoke code — mất quyền post |
| `/bbsban @user` | Admin | Ban khỏi BBS |
| `/bbsunban @user` | Admin | Unban |
| `/whois <code>` | Admin | Lookup Discord account từ code |
| `/bbsstatus` | Admin | Xem stats |

---

## Deploy (Vercel)
```bash
npm i -g vercel
vercel
# Thêm env vars trong Vercel Dashboard → Settings → Environment Variables
```

Bot chạy trên server riêng (VPS, Railway, hoặc máy local).
