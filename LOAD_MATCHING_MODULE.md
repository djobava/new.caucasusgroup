# Load Matching Module — Planning

## იდეა

გარე load board-იდან (Sylectus/Alliance, `selectus.net`) ტვირთების ამოღება და ავტომატური
დამთხვევა ჩვენს ბაზაში არსებულ მძღოლებთან/მანქანებთან — ზომის, ტიპისა და
გეოგრაფიული სიახლოვის მიხედვით (pickup ლოკაცია vs. მძღოლის მდებარეობა).

## რა ჩანს selectus.net.md-ში

ეს ფაილი Sylectus/Alliance-ის ("N&A EXPRESS LLC" ანგარიშით) **გვერდის გარსია** (sidebar,
header, cookie-consent), არა თავად ტვირთების სია. რეალური ტვირთების ცხრილი იტვირთება
ცალკე iframe-ში (`/II14_managepostedloads.asp?loadboard=True`), რომელიც ამ dump-ში არაა.

მნიშვნელოვანი დაკვირვება: sidebar-ში სამი ცალკე გვერდია —
- **Load Board** (`/Main.aspx?page=II14_managepostedloads.asp?loadboard=True`) — სხვების მიერ პოსტირებული ტვირთები, აქედან უნდა მოვიდეს matching-ის კანდიდატები.
- **Bid Board** (`/LoadBoard/BidBoard.aspx?section=bidboard`)
- **Manage Posted Orders** — ჩვენს მიერ პოსტირებული ტვირთები (ეს დაჭერილია ამ dump-ში, matching-ისთვის არ გვჭირდება).

ესეც: **Sylectus → EDI Requests** მენიუ პუნქტი გვთავაზობს, რომ შესაძლოა არსებობდეს
ოფიციალური EDI/API ინტეგრაცია. ეს ღირს პირველ რიგში შემოწმება — თუ ხელმისაწვდომია,
გაცილებით საიმედო და ToS-თან შესაბამისი გზაა, ვიდრე HTML scraping ASP.NET
webforms გვერდიდან (heavy `__VIEWSTATE`, სესია/ლოგინი საჭირო, ანტი-ბოტ დაცვის რისკი).

## საჭირო მონაცემები დამთხვევისთვის

ჩვენს `drivers` ცხრილში უკვე არსებობს ყველაფერი რაც matching-ს სჭირდება:
`dimensions`, `payload`, `location`, `zip`, `latitude`, `longitude`, `available`, `onload`.

გარე ტვირთისგან დაგვჭირდება მინიმუმ:
- pickup ლოკაცია (ქალაქი/zip ან lat/long)
- delivery ლოკაცია
- საჭირო მანქანის ზომა/ტიპი (dimensions, payload/weight)
- posted დრო, ტვირთის ID/რეფერენსი (დუბლიკატების asszavoid-ისთვის)

## შემოთავაზებული არქიტექტურა

1. **`external_loads` ცხრილი** — scrape/import-ული ტვირთების ქეში (source, external_id,
   pickup_location, pickup_lat/lng, delivery_location, dimensions, payload,
   posted_at, raw_json, matched_driver_id nullable).
2. **Ingest job** (`server/cron/` ან ცალკე service) — პერიოდულად (მაგ. ყოველ 5 წთ)
   ან event-ზე იღებს ახალ ტვირთებს Sylectus-იდან და წერს `external_loads`-ში
   (upsert `external_id`-ზე, დუბლიკატის თავიდან ასაცილებლად).
3. **Matching service** — ყოველი ახალი ჩანაწერისთვის (ან batch-ში):
   - გაფილტრავს drivers-ს `available = 1 AND onload = 0`-ით,
   - შეამოწმებს ზომა/წონა თავსებადობას (`dimensions`/`payload` პარსინგი და შედარება),
   - გამოთვლის მანძილს haversine ფორმულით driver-ის `latitude/longitude`-სა და
     pickup lat/lng-ს შორის, ჩამოსორტავს რადიუსით (მაგ. 50-100 მილი, კონფიგურირებადი).
   - შედეგს უკავშირებს dashboard-ს/socket.io ნოტიფიკაციას (რეალურ დროში HR/dispatch-ისთვის).
4. **UI** — ახალი გვერდი (`admin/LoadMatches.jsx`), სადაც ჩანს დამთხვეული ტვირთი + კანდიდატი
   მძღოლ(ებ)ი დისტანციის მიხედვით დალაგებული, action-ით "assign to driver".

## რისკები / ღია კითხვები

- **ToS/ავტორიზაცია**: scraping დაშვებულია მხოლოდ საკუთარი, ავტორიზებული ანგარიშის
  ფარგლებში (login credentials უკვე გაქვთ — "N&A EXPRESS LLC"). ჯერ გადამოწმდეს
  EDI/API ვარიანტი, სანამ scraper აშენდება.
- **სესია/ლოგინი**: ASP.NET webforms ხშირად საჭიროებს cookie-based სესიის შენარჩუნებას
  (login → session cookie → periodic re-auth). საჭირო იქნება headless browser
  (Playwright/Puppeteer) თუ მარტივი HTTP fetch საკმარისი არაა.
- **Rate limiting**: სცრეიპინგის სიხშირე უნდა იყოს გონივრული, რომ ანგარიში არ დაიბლოკოს.
- **ზომის/ტიპის დამთხვევის წესი**: ზუსტად როგორ განისაზღვროს "თავსებადობა" (მაგ. თუ
  drivers.dimensions თავისუფალი ტექსტია და არა structured — საჭირო იქნება parsing rule ან
  ველების structured ფორმატში გადაყვანა).
- **რადიუსი**: რა მანძილი ჩაითვალოს "ახლოს" — ფიქსირებული თუ user-configurable per group/zone?

## ფაზები

1. გადამოწმება: აქვს თუ არა Sylectus-ს ოფიციალური API/EDI წვდომა ამ ანგარიშისთვის.
2. `external_loads` ცხრილი + მარტივი manual import (JSON/CSV ატვირთვა) — matching ლოგიკის
   გატესტვისთვის, სანამ scraper/API მზადაა.
3. Ingest მექანიზმის აშენება (scraper ან API client).
4. Matching სერვისი + UI გვერდი.
5. რეალურ დროში შეტყობინებები (socket.io) dispatch-ისთვის.
