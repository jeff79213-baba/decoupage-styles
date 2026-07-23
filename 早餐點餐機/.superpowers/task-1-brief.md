### Task 1: Firebase Project Setup

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `public/index.html` (placeholder)
- Create: `public/admin.html` (placeholder)

**Interfaces:**
- Consumes: None (first task)
- Produces: Firebase hosting config, deployable placeholder pages

- [ ] **Step 1: Create firebase.json**

```json
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

- [ ] **Step 2: Create .firebaserc**

```json
{
  "projects": {
    "default": "breakfast-kiosk-shared"
  }
}
```

- [ ] **Step 3: Create placeholder public/index.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><title>早餐點餐機</title></head>
<body><h1>載入中...</h1></body>
</html>
```

- [ ] **Step 4: Create placeholder public/admin.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><title>後台管理</title></head>
<body><h1>後台管理</h1></body>
</html>
```

- [ ] **Step 5: Commit**

```bash
git add firebase.json .firebaserc public/
git commit -m "chore: initialize firebase hosting with placeholder pages"
```
