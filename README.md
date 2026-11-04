# Rusada – QuizBot

Rus tili testlari uchun Telegram Mini App — **Rusada учебный центр**.

| Qism | Papka | Nima qiladi |
|---|---|---|
| Mini App | `apps/miniapp` | O‘quvchi ilovasi: testlar, jonli efir, guruh testi, reyting, profil (UZ / ЎЗ / RU) |
| Admin panel | `apps/admin` | Savollar banki, test konstruktori, Excel import, efir pulti, guruhlar, natijalar, rollar |
| Server (API) | `services/api` | FastAPI + PostgreSQL. Vaqt va to‘g‘ri javoblar faqat serverda |
| Bot | `services/telegram-bot` | @Rusada_QuizBot: `/start`, `/admin`, guruhlarni ro‘yxatga olish |
| O‘rnatish | `docker-compose.yml`, `infrastructure/` | Bitta buyruq bilan serverga, HTTPS avtomatik |

## Muhim qoidalar (kodda shunday ishlaydi)

- **Bitta taymer — butun testga.** To‘g‘ri javob ko‘rsatilayotganda taymer to‘xtaydi (faqat ekranda turgan vaqtga). Vaqt tugasa test yopiladi, javobsiz savollar 0 ball.
- **Jonli efirda** vaqt har bir savolga beriladi (testda bitta qiymat, masalan 20 s) — aks holda hamma bir paytda javobni ko‘ra olmaydi.
- **E'lon qilingan testni tahrirlash yangi versiya yaratmaydi** — test joyida o‘zgaradi. Har bir urinish o‘sha paytdagi savollar nusxasini saqlaydi, shuning uchun eski natijalar va «Разбор ошибок» buzilmaydi.
- **Parollar yo‘q.** Admin panelga kirish: botga `/admin` → 5 daqiqalik bir martalik havola.
- Bot tokeni faqat serverdagi `.env` faylida. Repozitoriyda token yo‘q.

## Serverga o‘rnatish (bir marta)

Kerak: Linux server (2 GB RAM yetadi), Docker, ikkita domen nomi (masalan `quiz.rusada.uz` va `admin.rusada.uz`), ikkalasining DNS A-yozuvi server IP'siga qaragan bo‘lishi kerak.

1. **BotFather'da tokenni yangilang.** Eski token chatda ko‘ringan bo‘lsa: `/revoke` → yangi token oling.
2. **BotFather → Bot Settings → Configure Mini App → Enable Mini App**, manzil: `https://quiz.rusada.uz`. Shunda `t.me/Rusada_QuizBot?startapp=…` havolalari (guruh testlari, efir) ishlaydi.
3. Serverda:
   ```bash
   git clone https://github.com/noissyyy/rusada-quizbot.git && cd rusada-quizbot
   cp .env.example .env
   nano .env        # token, domenlar, parollar (openssl rand -hex 32), o‘z Telegram ID'ingiz
   docker compose up -d --build
   ```
4. Telegram'da botga `/start` yozing → ilova ochiladi. `SUPERADMIN_TELEGRAM_IDS` ga yozilgan odam botga `/admin` yozsa, admin panelga kirish havolasi keladi.
5. Botni guruhga qo‘shing va **administrator** qiling — guruh admin panelning «Группы» bo‘limida paydo bo‘ladi.

Zaxira nusxa: har kuni 03:00 da `./backups/` papkasiga (14 kun saqlanadi).
Yangilash: `git pull && docker compose up -d --build` (baza migratsiyasi avtomatik).

## Dasturchi uchun

```bash
npm install
npm run dev                  # Mini App, http://localhost:5173 (namuna ma'lumot bilan)
npm run dev:admin            # Admin panel, http://localhost:5174
npm test                     # Mini App + admin testlari (vitest)

cd services/api
pip install -r requirements-dev.txt
pytest                       # API testlari haqiqiy PostgreSQL'da (rq_test bazasi)
DATABASE_URL=postgresql+asyncpg://rq:rq@localhost:5432/rq ALLOW_DEV_AUTH=1 TELEGRAM_ENABLED=0 \
  BOT_TOKEN=1:dev uvicorn app.main:app --reload
```

Mini App'ni lokal API bilan ishlatish: `VITE_API_URL=http://localhost:8000 VITE_DEV_TELEGRAM_ID=777 npm run dev`.
Admin: `VITE_API_URL=http://localhost:8000 VITE_DEV_LOGIN=1 npm run dev:admin`.
`ALLOW_DEV_AUTH` ishlab chiqarishda **hech qachon** yoqilmaydi (Telegram imzosi tekshirilmay qoladi).

## Dizayn

- Tokenlar: `apps/miniapp/src/styles/tokens.css` (admin ham shuni ishlatadi).
- Shriftlar: Onest + Helvetica Now Display (litsenziya fayllari kelganda `apps/miniapp/public/fonts/` ga qo‘yiladi, `global.css` dagi `@font-face` ochiladi).
- 3D rasmlar: `apps/miniapp/public/3d/`.
