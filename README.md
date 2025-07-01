# מאמן האותיות העבריות - פריסה עצמאית

## מה זה?
מערכת AI לאימון בינה מלאכותית ליצירת אותיות עבריות מדויקות.

## קבצים נדרשים:
- `server.js` - השרת הראשי
- `index.html` - הממשק
- `style.css` - העיצוב  
- `main.js` - הלוגיקה
- `package.json` - התלויות

## פריסה ב-Vercel (חינם):

### 1. הכנה:
```bash
npm install express
```

### 2. צור `package.json` חדש:
```json
{
  "name": "hebrew-letters-trainer",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

### 3. צור `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

### 4. פריסה:
1. יצור חשבון ב-vercel.com
2. חבר את GitHub
3. העלה את הקבצים
4. פרוס!

## פריסה ב-Railway (חינם):
1. railway.app
2. "Deploy from GitHub"
3. העלה קבצים
4. יעבוד אוטומטית!

## פריסה ב-Render (חינם):
1. render.com
2. "Web Service"
3. חבר GitHub
4. Build Command: `npm install`
5. Start Command: `npm start`

הכל יעבוד בדיוק כמו ב-Replit, רק ללא תלות!