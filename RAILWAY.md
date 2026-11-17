# Railway deploy: 3 სერვისი (db, back, front), Docker-ის გარეშე

Railway თვითონ ამოიცნობს Node პროექტს (Railpack) და ააწყობს. Dockerfile არ გჭირდება.
როგორც კი Root Directory-ს დააყენებ, root-ში არსებული `dockerfile` იგნორირდება.

## 0. GitHub
პროექტი ატვირთე GitHub-ზე (`.env*` უკვე .gitignore-შია). Railway ყველა სერვისს ერთი repo-დან აიღებს.

## 1. DB (MySQL)
New → Database → **Add MySQL**. სახელი დატოვე `MySQL` (ქვემოთ ცვლადები ამ სახელს იყენებს).

## 2. Back
New → GitHub Repo → იგივე repo. Settings:
- **Root Directory**: `/server`
- Build/Start ავტომატურია (`npm ci` → `npm start`). ცვლადებში დაამატე `NODE_VERSION=20`
- **Healthcheck Path**: `/api/health`
- Networking → **Generate Domain** (ან custom domain)

Variables (იხ. `server/.env.example`):
```
NODE_ENV=production
JWT_SECRET=<გრძელი random>
REFRESH_SECRET=<სხვა გრძელი random>
CORS_ORIGIN=https://<FRONT-DOMAIN>        # უნდა ემთხვეოდეს ზუსტად, slash-ის გარეშე
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASS=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
```
random secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## 3. Front
New → GitHub Repo → იგივე repo. Settings:
- **Root Directory**: `/client`
- Build Command: `npm run build`
- Start Command: `npx serve -s dist -l $PORT` (`-s` = SPA fallback, რომ refresh-ზე 404 არ იყოს)
- ცვლადებში `NODE_VERSION=20`
- Networking → **Generate Domain**

Variables (build-time, `client/.env.example`):
```
VITE_API_URL=https://<BACK-DOMAIN>/api
VITE_SOCKET_URL=https://<BACK-DOMAIN>
```
ცვლადის შეცვლის შემდეგ front-ს **Redeploy** სჭირდება (Vite ცვლადებს build-ში ჩაწერს).

მერე დაბრუნდი Back-ზე და `CORS_ORIGIN`-ში ჩაწერე Front-ის რეალური დომენი.

## 4. ბაზის შევსება (schema + data)
ლოკალურად, repo-ს root-იდან:
```
npm i -g @railway/cli
railway login && railway link        # აირჩიე პროექტი
cd server && npm ci
railway run --service MySQL node seed/seed.cjs --dry-run
railway run --service MySQL node seed/seed.cjs
```
`seed.cjs` თავად ქმნის 12 ცხრილს (თუ ბაზა ცარიელია) და ავსებს მონაცემებს; არაფერს შლის.
შენიშვნა: `railway run` ლოკალურად გადის, ამიტომ `MYSQL_PUBLIC_URL`-ს (TCP proxy) იყენებს; ეს ცვლადი MySQL სერვისზე არსებობს.

## 5. შემოწმება
- `https://<BACK-DOMAIN>/api/health` → `{"status":"healthy"...}`
- `https://<FRONT-DOMAIN>` → login
- DevTools → Network → WS: socket.io კავშირი უნდა იყოს 101

## ⚠️ cookie-ები (მნიშვნელოვანი)
Front და Back სხვადასხვა დომენზეა (`*.up.railway.app` public suffix-ია), ამიტომ auth cookie
(`SameSite=None; Secure`) cross-site cookie-ა. **Safari და ზოგი ბრაუზერი ამას ბლოკავს** და login არ იმუშავებს.
გამოსავალი: custom დომენები საერთო მშობლით, მაგ. `app.caucasusgroup.com` (front) და `api.caucasusgroup.com` (back).
Railway-ში: Settings → Networking → Custom Domain ორივეზე, DNS-ში CNAME-ები.
