# The Line: put it on the internet, step by step

This guide assumes you've never done this before. Go slowly and do one step at a time. Each step tells you what you should see when it worked. Plan on about **45 minutes**. Everything here is **free**.

---

## First: what are we building?

Think of your app as a restaurant:

| Restaurant | Your app | Who provides it |
|---|---|---|
| The **dining room** customers walk into | The website (`index.html`, `styles.css`, `app.js`) | **Vercel** |
| The **walk-in fridge** where everything is stored | The database (ingredients, recipes, sales) | **Supabase** |
| The **host stand** that checks reservations | Logins, so each restaurant only sees its own data | **Supabase** |
| The **recipe binder** everyone works from | Your code, stored online | **GitHub** |

You'll make three free accounts, connect them, and you're done.

---

## What's in the folder

| File | What it does | Will you edit it? |
|---|---|---|
| `index.html` | The page layout | No |
| `styles.css` | Colors and fonts | No |
| `design.css` | The current look ("Kitchen Almanac"); its colors are in the box at the top | Only if you want new colors |
| `images/kitchen.jpg` | The kitchen photo behind the sign-in screen (upload it with the other files) | Only to swap the photo |
| `api/specials.js` | The server helper that talks to Google Gemini for the Specials page. Your Gemini key lives in Vercel's settings, not here | No |
| `app.js` | All the brains: math, saving, loading | No |
| `seed-data.js` | The sample Kennedy menu, loaded once if you ask for it | No |
| `config.js` | **Your two Supabase "addresses"** | **Yes, once (Step 4)** |
| `supabase/schema.sql` | Instructions that build your database tables | No, you just copy and paste it |
| `README.md` | This guide | No |

---

## Step 0: Get the files ready

1. Download **the-line.zip**.
2. Double-click it to unzip it. You'll get a folder called **the-line**.
3. Put that folder somewhere easy to find, like your Desktop.

✅ **It worked if:** you can open the `the-line` folder and see the files listed above.

---

## Step 1: Make a GitHub account

GitHub is where your code lives online. Vercel will read it from there.

1. Go to **github.com** and click **Sign up**.
2. Use your email, pick a password and a username, and verify your email.

✅ **It worked if:** you're signed in and see your GitHub home page.

> Make GitHub first, because you can then use **"Continue with GitHub"** to sign up for Supabase and Vercel. That means fewer passwords to remember.

---

## Step 2: Make your database (Supabase)

1. Go to **supabase.com** and click **Start your project**.
2. Choose **Continue with GitHub** and approve it.
3. If it asks you to create an **organization**, give it any name (for example, your name) and choose the **Free** plan.
4. Click **New project** and fill in the form:
   - **Name:** `the-line`
   - **Database password:** click **Generate a password**, then **copy it and save it somewhere safe**, like a note on your phone. You probably won't need it, but you can't see it again later.
   - **Region:** choose one in the eastern US (for example, *East US (North Virginia)*). It's closest to Tennessee, so the app will feel faster.
   - If you see options about the **Data API**, leave them as they are.
5. Click **Create new project**.
6. ☕ Wait about 2 minutes while Supabase builds it.

✅ **It worked if:** you land on your project's dashboard and the "setting up" message is gone.

---

## Step 3: Build the tables (copy and paste one file)

Right now your database is an empty fridge with no shelves. This step adds the shelves.

1. On your computer, open `the-line` → `supabase` → **schema.sql**.
   - **Windows:** right-click it → **Open with** → **Notepad**.
   - **Mac:** right-click it → **Open With** → **TextEdit**.
2. Select everything (**Ctrl+A** on Windows, **Cmd+A** on Mac) and copy it (**Ctrl+C** or **Cmd+C**).
3. In Supabase, look at the left sidebar and click **SQL Editor** (the icon looks like a little terminal `>_`).
4. Click **New query** (or the **+** button). A blank box appears.
5. Click inside the box and paste (**Ctrl+V** or **Cmd+V**).
6. Click the green **Run** button at the bottom right.
   - If Supabase warns you that the query includes something "destructive", click **Run this query** anyway. It's only creating tables, not deleting anything.

✅ **It worked if:** you see **"Success. No rows returned"**.
Click **Table Editor** in the left sidebar. You should see nine tables: `restaurants`, `ingredients`, `dishes`, `dish_items`, `weekly_sales`, `scenarios`, `staff`, `labor_hours`, `mod_reports`.

❌ **"already exists" error?** You already ran it once. That's fine, so move on.

---

## Step 4: Turn off email confirmation (recommended for a class demo)

By default, Supabase emails every new user a "click to confirm" link before they can sign in. Supabase's free email sender is very slow and limited. For a class demo, it's easier to turn this off.

1. In the left sidebar, click **Authentication**.
2. Click **Sign In / Providers** (on some screens it's just called **Providers**).
3. Click **Email** to open its settings.
4. Find **Confirm email** and switch it **OFF**.
5. Click **Save**.

✅ **It worked if:** the **Confirm email** switch shows off.

> 💡 If a real restaurant ever uses this app, turn this back on.

---

## Step 5: Copy your two "addresses" into `config.js`

Your website needs to know where your database lives. You'll copy two things from Supabase:

- **Project URL**: the street address (looks like `https://abcdefgh.supabase.co`)
- **Publishable key**: the key that opens the front lobby (starts with `sb_publishable_`)

**Where to find them:**
1. Click **Project Settings** (the ⚙️ gear icon at the bottom of the left sidebar).
2. Click **API Keys**. Copy the **Publishable key** (there's a copy button).
3. Find your **Project URL** in **Project Settings** → **Data API** (or **API**).
   - Shortcut: many Supabase screens have a **Connect** button at the top that shows both values together.
   - Your project might show an older key called **"anon public"** instead of a Publishable key. That one works too.

> ⚠️ **Never** use the key labeled **secret** or **service_role**. That's the master key to the whole building. The Publishable key is *meant* to be inside a website, so it's safe.

**Paste them in:**
1. Open `the-line` → **config.js** in Notepad or TextEdit.
2. Replace `PASTE_YOUR_PROJECT_URL_HERE` with your Project URL.
3. Replace `PASTE_YOUR_PUBLISHABLE_KEY_HERE` with your Publishable key.
4. **Keep the quote marks.** It should look like this (with your own values):
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: "https://abcdefgh.supabase.co",
     SUPABASE_KEY: "sb_publishable_Ab12Cd34...",
   };
   ```
5. Save the file.
   - **Mac TextEdit users:** if the menu says **Format → Make Plain Text**, click that before saving. Keep the name `config.js` exactly.

✅ **Optional quick test:** double-click `index.html` to open it in your browser. If you see a **Sign in** box, the connection works. (If you see "Almost there!", the values in `config.js` aren't right yet.)

---

## Step 6: Upload your code to GitHub

1. Go to **github.com**, click the **+** in the top-right corner, and choose **New repository**.
2. **Repository name:** `the-line`
3. Choose **Public** or **Private**. Either works. Nothing secret is in these files.
4. Click **Create repository**.
5. On the next page, find the small link that says **"uploading an existing file"** and click it.
6. Open your `the-line` folder on your computer, select these **5 files**, and drag them into the browser window:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js` ← the one you just edited
   - `seed-data.js`

   (You can drag `README.md` too if you like. You **don't** need to upload the `supabase` folder, because you already used it in Step 3.)
7. Scroll down and click the green **Commit changes** button.

✅ **It worked if:** your repository page lists those 5 files.

---

## Step 7: Put it on the internet (Vercel)

1. Go to **vercel.com** and click **Sign Up**.
2. Choose **Hobby** (the free plan), enter your name, and click **Continue with GitHub**.
3. Once you're in, click **Add New…** → **Project**.
4. You'll see your GitHub repositories. Next to **the-line**, click **Import**.
   - Don't see it? Click **Adjust GitHub App Permissions** (or "Configure GitHub App") and allow Vercel to see `the-line`.
5. On the setup screen:
   - **Framework Preset:** choose **Other**.
   - Leave everything else blank or as it is.
6. Click **Deploy**.
7. 🎉 About 30 seconds later you'll see confetti and a preview of your app.
8. Click **Continue to Dashboard**. Under **Domains** you'll see your web address, something like **`the-line-yourname.vercel.app`**.

✅ **It worked if:** opening that address shows the **The Line** sign-in screen.

---

## Step 8: Tell Supabase your new web address

This makes sure any email links (for example, password resets) send people to your site.

1. Copy your Vercel address (for example, `https://the-line-yourname.vercel.app`).
2. In Supabase, go to **Authentication** → **URL Configuration**.
3. Paste it into **Site URL**, then click **Save**.

---

## Step 9: Use it!

1. Open your Vercel address.
2. Click **"New here? Create an account"**, enter an email and a password (at least 6 characters), and click **Create account**.
3. Type a restaurant name, keep **"Start with the sample dinner menu"** checked, and click **Create restaurant**.
4. You'll see the full Kennedy menu, just like your prototype, but now **everything saves**.

**What each tab does:**

| Tab | What you can do |
|---|---|
| **Cost Tracker** | See every dish's food cost %, and click a dish for the breakdown |
| **Performance** | Stars, plowhorses, puzzles, and dogs for the week chosen in the "Sales week" box |
| **Weekly Sales** | Type plates sold per dish for any week, then click **Save this week** |
| **Ingredients** | Change a real price (it saves when you click away), add new ingredients, or delete unused ones |
| **Recipes** | Add a dish, change its price, or add and remove ingredients, then click **Save dish** |
| **Labor Costs** | Add your team and their pay, enter hours each week, and see labor cost as a % of sales (like food cost %, with a target range, prime cost, overtime and a suggested action) |
| **MOD Report** | The manager on duty fills one in every shift: weather, covers by hour (peak times are highlighted), staffing, employee and guest issues, comps and voids, 86'd items, maintenance, cash and closing checks, tomorrow's forecast, and notes. **Print / save as PDF** makes a clean copy to share. |

**The what-if bar** (on Cost Tracker and Performance) works like it did in your prototype. You can now also click **Save** to keep a scenario like "Beef +15%", and reload it later from the **Saved scenarios** menu.

**Multiple restaurants:** use the dropdown at the top right and choose **+ Add another restaurant**. Each person who signs up gets their **own separate restaurants**. Nobody can see anyone else's.

**Settings:** change the restaurant name or your target food-cost range (28 / 32 / 35% by default).

**Labor Costs and MOD Report need three more tables.** If you set up your database before these tabs existed, run `supabase/labor-and-mod.sql` once in the SQL Editor (same steps as Step 3). Until you do, the rest of the app works normally and those two tabs show a reminder. Labor targets (25 / 28 / 32% of sales by default) and the payroll taxes and benefits add-on (10%) are in **Settings**.

**Delete my account:** at the bottom of **Settings** (or on the "Add a restaurant" screen). Type your email, then confirm "Are you sure?". It deletes your login and all your restaurants, so you can sign up again with the same email. (If you set up your database before this button existed, run `supabase/delete-account.sql` in the SQL Editor once first.)

---

## Specials (Google Gemini)

The **Specials** page writes a weekly specials menu, or a party menu for a group, from your own ingredients. It uses up what's about to spoil first and keeps food cost near your goal. Google's Gemini AI writes the menu. The Line then checks every dish's cost with your real ingredient prices.

**How it works, in one picture:** your web page → a small helper on Vercel's server (`api/specials.js`) → Google Gemini → back to your page. The helper holds your Gemini key, so the key is never inside the web page where someone could copy it. It also checks that the person asking is signed in to The Line.

### Step A: Track what's on hand and when it spoils (Supabase, once)
1. In Supabase, open **SQL Editor** → **New query**.
2. Paste in everything from `supabase/spoilage.sql` and click **Run**. You should see "Success. No rows returned."
3. On the **Ingredients** tab, each ingredient now has **On hand** and **Use by**. Fill them in. A sample Kelley's comes with them filled in.

### Step B: Give Vercel your Gemini key (once)
Your key is like a password. **Never** put it in a file, in GitHub, or in a chat. It only goes in Vercel's settings:
1. Go to **vercel.com** → open the **the-line** project → **Settings** → **Environment Variables**.
2. Add these three, one at a time (Name, then Value, then **Save**):

   | Name | Value |
   |---|---|
   | `GEMINI_API_KEY` | your Gemini API key from Google AI Studio |
   | `SUPABASE_URL` | the same Project URL that's in `config.js` (like `https://abcdefgh.supabase.co`) |
   | `SUPABASE_KEY` | the same Publishable key that's in `config.js` (starts with `sb_publishable_`) |

3. Go to **Deployments**, click the **⋯** next to the newest one, and choose **Redeploy**. Vercel only picks up new settings on a fresh deploy.

### Step C: Use it
Open **Specials**, pick **Weekly specials** or **Party or group menu**, fill in the boxes, and click **Make the menu**. It takes a few seconds. Don't like it? Click **Try another version**. **Print / save as PDF** gives you a clean copy.

- **Which model:** it uses Gemini 3.1 Flash-Lite. If Google names it differently for your key, the helper finds your Flash-Lite model by itself. To pick a specific model, add a fourth variable, `GEMINI_MODEL`, with the model's name.
- **If it says "isn't connected yet":** one of the three variables is missing, or you haven't redeployed since adding them.
- **Cost:** each menu is one small request to Gemini. Check your usage and limits in Google AI Studio.
- **Always look it over:** the AI can suggest odd pairings, or ingredients you don't stock (the page flags those).

## The Line POS (paid add-on)

The register is a **separate app** (its own GitHub repo, `the-line-pos`, and its own Vercel project) that shares this Supabase database. Restaurants with the add-on switched on get a **Pull today's numbers from the POS** button on the MOD Report and **Pull this week from the POS** on Weekly Sales. Everyone else sees a short note about the add-on. Setup steps are in the POS repo's README.

## Making changes later

1. Go to your repository on GitHub and click the file you want to change.
2. Click the ✏️ pencil icon, make your edit, and click **Commit changes**.
3. Vercel notices on its own and updates your live site in about a minute. You don't need to do anything else.

---

## If something goes wrong

| What you see | What it means | Fix |
|---|---|---|
| **"Almost there!"** page | `config.js` still has the placeholder text, or it wasn't uploaded | Redo Step 5. On GitHub, click `config.js` and check that it shows your real values. |
| "The database tables are missing" | Step 3 didn't run | Redo Step 3 and look for "Success". |
| "Check your email for a confirmation link" | Email confirmation is still on | Do Step 4, then create the account again with a different email (or confirm the email you got). |
| "Wrong email or password" | It's a typo, or that account doesn't exist yet | Click "Create an account" instead. |
| "Can't reach the database" | Your internet is down, the project URL is wrong, **or the Supabase project is paused** | See the note below. |
| A Vercel **404** page | The files went into a sub-folder on GitHub | On GitHub, `index.html` must be on the main page of the repository, not inside a folder. |
| Something else | — | Press **F12** (Mac: **Cmd+Option+I**), click **Console**, and copy the red text. Paste it to me (Claude) and I'll help. |

> 💤 **Free Supabase projects go to sleep** if nobody uses them for about a week. If your app suddenly can't reach the database, log in to supabase.com, open your project, and click **Restore** (or **Resume**). Wake it up a day before your class presentation, just in case.

---

## How it stays safe (for your write-up)

- **Logins** are handled by Supabase Auth. Passwords never touch your code.
- **Row Level Security (RLS)** is turned on for every table. The database itself checks that each request comes from a restaurant's owner before showing or changing anything. Even someone who digs the Publishable key out of your website can't read another account's data.
- These rules were tested before delivery: a second account was blocked from reading, editing, or adding to the first account's restaurant, and logged-out visitors were refused completely.
