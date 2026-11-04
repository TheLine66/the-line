// =====================================================================
// The Line — sample menus
// Used ONLY when you pick a sample menu while creating a restaurant. The
// app copies it into your database once; after that, everything is edited
// inside the app. All prices, sales numbers, people and events are made up.
// =====================================================================
window.SEEDS = window.SEEDS || {};

// ---------------------------------------------------------------------
// Sample 1: The Kennedy (the original prototype menu)
// ---------------------------------------------------------------------
window.SEEDS.kennedy = {
  label: "The Kennedy: upscale American dinner menu (16 dishes)",
  ingredients: {
    potatofries:      { name: "Hand-cut fries", unit: "oz", cost: 0.07 },
    truffleoil:       { name: "White truffle oil", unit: "oz", cost: 2.20 },
    granapadano:      { name: "Grana padano", unit: "oz", cost: 0.68 },
    blackgarlicaioli: { name: "Black garlic aioli", unit: "oz", cost: 0.30 },
    beefbone:         { name: "Beef marrow bone", unit: "each", cost: 3.50 },
    baconjam:         { name: "Bacon onion jam", unit: "oz", cost: 0.48 },
    chimichurri:      { name: "Chimichurri", unit: "oz", cost: 0.22 },
    pickledonion:     { name: "Pickled onion", unit: "oz", cost: 0.12 },
    potatochips:      { name: "House-made potato chips", unit: "oz", cost: 0.10 },
    crab:             { name: "Jumbo lump crab", unit: "oz", cost: 1.65 },
    crispyrice:       { name: "Crispy rice", unit: "oz", cost: 0.14 },
    srirachaaioli:    { name: "Garlic-sriracha aioli", unit: "oz", cost: 0.28 },
    avocado:          { name: "Avocado", unit: "each", cost: 0.85 },
    sweetsoy:         { name: "Sweet soy glaze", unit: "oz", cost: 0.15 },
    dates:            { name: "Bacon-wrapped dates", unit: "each", cost: 0.35 },
    bacon:            { name: "Bacon", unit: "oz", cost: 0.38 },
    goatcheese:       { name: "Goat cheese", unit: "oz", cost: 0.55 },
    pumpkinseedpesto: { name: "Pumpkin seed pesto", unit: "oz", cost: 0.42 },
    balsamic:         { name: "Balsamic reduction", unit: "oz", cost: 0.35 },
    calabrianchili:   { name: "Calabrian chili-tomato sauce", unit: "oz", cost: 0.30 },
    onion:            { name: "Onion", unit: "oz", cost: 0.05 },
    beefbroth:        { name: "Beef broth", unit: "oz", cost: 0.07 },
    swisscheese:      { name: "Swiss cheese", unit: "oz", cost: 0.38 },
    sherry:           { name: "Cooking sherry", unit: "oz", cost: 0.45 },
    bread:            { name: "Bread crouton", unit: "oz", cost: 0.08 },
    burrata:          { name: "Burrata cheese", unit: "oz", cost: 0.72 },
    tomato:           { name: "Heirloom tomato", unit: "oz", cost: 0.24 },
    prosciutto:       { name: "Crispy prosciutto", unit: "oz", cost: 0.95 },
    greenolive:       { name: "Green olives", unit: "oz", cost: 0.28 },
    basil:            { name: "Fresh basil", unit: "oz", cost: 0.55 },
    wagyupatty:       { name: "Wagyu beef patty", unit: "oz", cost: 0.95 },
    crispyonions:     { name: "Crispy fried onions", unit: "oz", cost: 0.22 },
    cheddarcheese:    { name: "Cheddar cheese", unit: "oz", cost: 0.36 },
    americancheese:   { name: "American cheese", unit: "oz", cost: 0.30 },
    garlicaioli:      { name: "Garlic aioli", unit: "oz", cost: 0.26 },
    bun:              { name: "Brioche bun", unit: "each", cost: 0.55 },
    chickenbreaded:   { name: "Breaded chicken cutlet", unit: "oz", cost: 0.40 },
    pinkvodkasauce:   { name: "Spicy pink vodka sauce", unit: "oz", cost: 0.24 },
    freshmozz:        { name: "Fresh mozzarella", unit: "oz", cost: 0.42 },
    filet:            { name: "Prime filet mignon", unit: "oz", cost: 2.10 },
    asparagus:        { name: "Grilled asparagus", unit: "oz", cost: 0.33 },
    whippedpotatoes:  { name: "Whipped potatoes", unit: "oz", cost: 0.10 },
    aupoivre:         { name: "Au poivre sauce", unit: "oz", cost: 0.40 },
    rigatoni:         { name: "Rigatoni pasta", unit: "oz", cost: 0.18 },
    ricotta:          { name: "Ricotta cheese", unit: "oz", cost: 0.32 },
    salmonfaroe:      { name: "Faroe Island salmon", unit: "oz", cost: 1.25 },
    misobutter:       { name: "Miso butter", unit: "oz", cost: 0.55 },
    brusselsprouts:   { name: "Brussels sprouts", unit: "oz", cost: 0.24 },
    chilicrisp:       { name: "Chili crisp", unit: "oz", cost: 0.38 },
    halfchicken:      { name: "Half chicken, bone-in", unit: "each", cost: 4.20 },
    herbedjus:        { name: "Herbed jus", unit: "oz", cost: 0.20 },
    pizzadough:       { name: "Sourdough pizza dough (12in)", unit: "each", cost: 1.35 },
    bbqsauce:         { name: "BBQ sauce", unit: "oz", cost: 0.14 },
    mozzarella:       { name: "Shredded mozzarella", unit: "oz", cost: 0.34 },
    roastedchicken:   { name: "Roasted chicken", unit: "oz", cost: 0.34 },
    redonion:         { name: "Red onion", unit: "oz", cost: 0.06 },
    jalapeno:         { name: "Jalapeño", unit: "oz", cost: 0.10 },
    cilantro:         { name: "Cilantro", unit: "oz", cost: 0.18 },
    alabamabbq:       { name: "Alabama white BBQ sauce", unit: "oz", cost: 0.20 },
    tomatosauce:      { name: "Classic tomato sauce", unit: "oz", cost: 0.09 },
    pepperoni:        { name: "Pepperoni", unit: "oz", cost: 0.42 },
    hothoney:         { name: "Calabrian hot honey", unit: "oz", cost: 0.38 },
    cauliflower:      { name: "Cauliflower", unit: "oz", cost: 0.11 },
    sweetpotato:      { name: "Sweet potato", unit: "oz", cost: 0.09 },
    mapleglaze:       { name: "Maple chili glaze", unit: "oz", cost: 0.30 },
    cashew:           { name: "Cashew", unit: "oz", cost: 0.55 },
    lime:             { name: "Lime", unit: "each", cost: 0.35 },
    cheesesauce:      { name: "Cheese sauce", unit: "oz", cost: 0.28 },
    trufflebreadcrumb:{ name: "Truffle breadcrumb", unit: "oz", cost: 0.45 },
    pasta:            { name: "Elbow macaroni", unit: "oz", cost: 0.16 },
  },
  dishes: [
    { name: "Truffle Fries", category: "Bites", price: 14.00, weeklyUnits: 95,
      items: [ ["potatofries", 10], ["truffleoil", 0.4], ["granapadano", 1.5], ["blackgarlicaioli", 1] ] },
    { name: "Bone Marrow", category: "Bites", price: 19.00, weeklyUnits: 22,
      items: [ ["beefbone", 2], ["baconjam", 1.5], ["chimichurri", 1], ["pickledonion", 1], ["potatochips", 2] ] },
    { name: "Blue Crab Crispy Rice", category: "Bites", price: 19.00, weeklyUnits: 40,
      items: [ ["crab", 3], ["crispyrice", 4], ["srirachaaioli", 1], ["avocado", 0.5], ["sweetsoy", 0.5] ] },
    { name: "Devils on Horseback", category: "Bites", price: 15.00, weeklyUnits: 30,
      items: [ ["dates", 5], ["bacon", 3], ["goatcheese", 2], ["pumpkinseedpesto", 1], ["balsamic", 0.5], ["calabrianchili", 1] ] },
    { name: "French Onion Soup", category: "Soup & Salad", price: 12.00, weeklyUnits: 36,
      items: [ ["onion", 8], ["beefbroth", 10], ["swisscheese", 2], ["sherry", 0.5], ["bread", 1] ] },
    { name: "Burrata & Heirloom Tomato", category: "Soup & Salad", price: 17.00, weeklyUnits: 34,
      items: [ ["burrata", 6], ["tomato", 8], ["prosciutto", 2], ["greenolive", 1], ["pumpkinseedpesto", 1], ["balsamic", 0.5], ["basil", 0.3] ] },
    { name: "The Kennedy Wagyu Burger", category: "Handhelds", price: 22.00, weeklyUnits: 78,
      items: [ ["wagyupatty", 8], ["baconjam", 1.5], ["crispyonions", 1], ["cheddarcheese", 1.5], ["americancheese", 1], ["garlicaioli", 1], ["bun", 1] ] },
    { name: "Chicken Parm", category: "Handhelds", price: 21.00, weeklyUnits: 50,
      items: [ ["chickenbreaded", 8], ["pinkvodkasauce", 3], ["freshmozz", 3], ["pumpkinseedpesto", 1], ["granapadano", 1] ] },
    { name: "Filet Mignon", category: "Mains", price: 52.00, weeklyUnits: 26,
      items: [ ["filet", 8], ["asparagus", 4], ["whippedpotatoes", 6], ["aupoivre", 1] ] },
    { name: "Spicy Rigatoni", category: "Mains", price: 26.00, weeklyUnits: 58,
      items: [ ["rigatoni", 8], ["prosciutto", 2], ["pinkvodkasauce", 4], ["ricotta", 2], ["granapadano", 1], ["basil", 0.3] ] },
    { name: "Faroe Island Salmon", category: "Mains", price: 34.00, weeklyUnits: 40,
      items: [ ["salmonfaroe", 7], ["misobutter", 1], ["brusselsprouts", 5], ["whippedpotatoes", 5], ["chilicrisp", 0.5] ] },
    { name: "Crispy Half Chicken", category: "Mains", price: 29.00, weeklyUnits: 45,
      items: [ ["halfchicken", 1], ["brusselsprouts", 5], ["whippedpotatoes", 5], ["herbedjus", 1] ] },
    { name: "BBQ Chicken Pizza", category: "Pizza", price: 19.00, weeklyUnits: 48,
      items: [ ["pizzadough", 1], ["bbqsauce", 2], ["mozzarella", 5], ["roastedchicken", 4], ["bacon", 1.5], ["redonion", 1], ["jalapeno", 0.5], ["cilantro", 0.2], ["alabamabbq", 1] ] },
    { name: "Pepperoni Hot Honey Pizza", category: "Pizza", price: 18.00, weeklyUnits: 62,
      items: [ ["pizzadough", 1], ["tomatosauce", 3], ["mozzarella", 5], ["ricotta", 1.5], ["pepperoni", 2.5], ["hothoney", 0.7] ] },
    { name: "Roasted Cauliflower & Sweet Potato", category: "Sides", price: 11.00, weeklyUnits: 28,
      items: [ ["cauliflower", 5], ["sweetpotato", 5], ["mapleglaze", 1], ["cashew", 0.5], ["lime", 0.3], ["cilantro", 0.2] ] },
    { name: "Mac N Cheese", category: "Sides", price: 13.00, weeklyUnits: 44,
      items: [ ["pasta", 6], ["cheesesauce", 4], ["trufflebreadcrumb", 1], ["granapadano", 0.5] ] },
  ],
  // Week-to-week wiggle for the 4 sample weeks of sales (oldest → newest).
  weekFactors: [0.92, 1.06, 0.97, 1.0],
  // Sample team for the Labor Costs tab. Hourly hours follow weekFactors.
  // rate = $/hour (hourly) or $/week (salary). Servers and bartenders earn
  // Tennessee's tipped minimum wage plus tips.
  staff: [
    { name: "Chris Avery",  role: "Executive chef", department: "Mgmt", pay_type: "salary", rate: 1150, hours: 50 },
    { name: "Dana Whitt",   role: "Line cook",      department: "BOH",  pay_type: "hourly", rate: 18.00, hours: 40 },
    { name: "Luis Mendez",  role: "Line cook",      department: "BOH",  pay_type: "hourly", rate: 17.00, hours: 36 },
    { name: "Priya Shah",   role: "Pizza cook",     department: "BOH",  pay_type: "hourly", rate: 16.00, hours: 24 },
    { name: "Cole Brandt",  role: "Dishwasher",     department: "BOH",  pay_type: "hourly", rate: 13.00, hours: 30 },
    { name: "Hannah Price", role: "Server",         department: "FOH",  pay_type: "hourly", rate: 2.13,  hours: 32 },
    { name: "Marcus Lee",   role: "Server",         department: "FOH",  pay_type: "hourly", rate: 2.13,  hours: 30 },
    { name: "Grace Kim",    role: "Server",         department: "FOH",  pay_type: "hourly", rate: 2.13,  hours: 28 },
    { name: "Tyler Boone",  role: "Bartender",      department: "FOH",  pay_type: "hourly", rate: 5.00,  hours: 38 },
    { name: "Ella Ross",    role: "Host",           department: "FOH",  pay_type: "hourly", rate: 12.00, hours: 26 },
  ],
};

// ---------------------------------------------------------------------
// Sample 2: Kelley's (imaginary Irish pub-food truck)
// Sized like an average food truck: 9 items, about $7,000 a week, and a
// crew of four including the owner. Built to tell a story: Fish & Chips
// is the best-seller AND the worst food-cost %, and the fish supplier
// just raised cod prices (see the saved scenario).
// ---------------------------------------------------------------------
window.SEEDS.kelleys = {
  label: "Kelley's: Irish pub-food truck (9 items, 6 weeks of sales, crew of 4, 2 weeks of MOD reports)",
  targets: { low: 28, mid: 31, high: 34 },
  ingredients: {
    // Proteins
    cod:          { name: "Atlantic cod fillet", unit: "oz", cost: 0.85 },
    groundchuck:  { name: "Ground chuck (80/20)", unit: "oz", cost: 0.38 },
    groundlamb:   { name: "Ground lamb", unit: "oz", cost: 0.58 },
    cornedbeef:   { name: "Corned beef brisket", unit: "oz", cost: 0.62 },
    wings:        { name: "Chicken wings", unit: "oz", cost: 0.32 },
    baconrashers: { name: "Irish bacon rashers", unit: "oz", cost: 0.55 },
    // Dairy
    cheddar:      { name: "Aged Irish cheddar", unit: "oz", cost: 0.62 },
    swiss:        { name: "Swiss cheese", unit: "oz", cost: 0.38 },
    whipped:      { name: "Whipped cream", unit: "oz", cost: 0.12 },
    // Produce
    chips:        { name: "Hand-cut chips", unit: "oz", cost: 0.07 },
    colcannon:    { name: "Colcannon mash", unit: "oz", cost: 0.11 },
    rootveg:      { name: "Root vegetable mix", unit: "oz", cost: 0.07 },
    lettuce:      { name: "Butter lettuce", unit: "oz", cost: 0.20 },
    celery:       { name: "Celery sticks", unit: "oz", cost: 0.05 },
    lemon:        { name: "Lemon", unit: "each", cost: 0.30 },
    // House-made sauces & prepped items
    beerbatter:   { name: "Guinness beer batter", unit: "oz", cost: 0.12 },
    tartar:       { name: "Tartar sauce", unit: "oz", cost: 0.20 },
    pubsauce:     { name: "Kelley's pub sauce", unit: "oz", cost: 0.18 },
    bbqsauce:     { name: "Guinness BBQ sauce", unit: "oz", cost: 0.18 },
    bluedip:      { name: "Blue cheese dip", unit: "oz", cost: 0.25 },
    beercheese:   { name: "Beer cheese", unit: "oz", cost: 0.30 },
    mustardcream: { name: "Whole-grain mustard cream", unit: "oz", cost: 0.30 },
    curry:        { name: "Chip-shop curry sauce", unit: "oz", cost: 0.15 },
    caramelonion: { name: "Caramelized onions", unit: "oz", cost: 0.10 },
    sauerkraut:   { name: "Sauerkraut", unit: "oz", cost: 0.08 },
    toffee:       { name: "Toffee sauce", unit: "oz", cost: 0.25 },
    lemonade:     { name: "House lemonade (16 oz)", unit: "each", cost: 0.55 },
    // Bakery, pantry & to-go
    stout:        { name: "Guinness stout (kitchen)", unit: "oz", cost: 0.16 },
    bun:          { name: "Potato bun", unit: "each", cost: 0.45 },
    rye:          { name: "Marbled rye bread (2 slices)", unit: "each", cost: 0.40 },
    pretzel:      { name: "Bavarian soft pretzel", unit: "each", cost: 0.85 },
    toffeecake:   { name: "Sticky toffee sponge", unit: "each", cost: 0.95 },
    togo:         { name: "To-go boat, cup or clamshell + napkins", unit: "each", cost: 0.18 },
  },
  dishes: [
    { name: "Fish & Chips", category: "Mains", price: 15.00, weeklyUnits: 130,
      items: [ ["cod", 6], ["beerbatter", 2.5], ["chips", 8], ["tartar", 1.5], ["lemon", 0.25], ["togo", 1] ] },
    { name: "Kelley's Pub Burger", category: "Mains", price: 13.00, weeklyUnits: 95,
      items: [ ["groundchuck", 6], ["cheddar", 1], ["baconrashers", 1], ["bun", 1], ["caramelonion", 1], ["pubsauce", 1], ["lettuce", 0.5], ["chips", 6], ["togo", 1] ] },
    { name: "Corned Beef Reuben", category: "Mains", price: 13.00, weeklyUnits: 60,
      items: [ ["cornedbeef", 5], ["rye", 1], ["swiss", 1], ["sauerkraut", 2], ["pubsauce", 1], ["togo", 1] ] },
    { name: "Shepherd's Pie Bowl", category: "Mains", price: 13.00, weeklyUnits: 45,
      items: [ ["groundlamb", 5], ["rootveg", 3], ["stout", 1], ["colcannon", 5], ["cheddar", 0.5], ["togo", 1] ] },
    { name: "Guinness BBQ Wings", category: "Snacks", price: 11.00, weeklyUnits: 70,
      items: [ ["wings", 8], ["bbqsauce", 2], ["bluedip", 1.5], ["celery", 1], ["togo", 1] ] },
    { name: "Curry Chips", category: "Snacks", price: 7.00, weeklyUnits: 80,
      items: [ ["chips", 10], ["curry", 3], ["togo", 1] ] },
    { name: "Soft Pretzel & Beer Cheese", category: "Snacks", price: 8.00, weeklyUnits: 50,
      items: [ ["pretzel", 1], ["beercheese", 3], ["mustardcream", 0.5], ["togo", 1] ] },
    { name: "Sticky Toffee Pudding Cup", category: "Sweets & drinks", price: 6.00, weeklyUnits: 40,
      items: [ ["toffeecake", 1], ["toffee", 1.5], ["whipped", 1], ["togo", 1] ] },
    { name: "Fresh Lemonade", category: "Sweets & drinks", price: 4.00, weeklyUnits: 110,
      items: [ ["lemonade", 1], ["togo", 1] ] },
  ],
  // 6 finished weeks of sales, oldest → newest.
  weekFactors: [0.88, 0.95, 1.02, 0.97, 1.05, 1.0],
  // Pre-saved what-if scenarios (keys refer to the ingredient list above).
  scenarios: [
    { name: "Cod +18% (supplier notice)", adjustments: { cod: 18 } },
  ],
  // The crew for the Labor Costs tab. Hourly hours follow weekFactors.
  // rate = $/hour (hourly) or $/week (salary). Marco works a little overtime.
  staff: [
    { name: "Maeve Kelley", role: "Owner / operator", department: "Mgmt", pay_type: "salary", rate: 600,   hours: 50 },
    { name: "Marco Ruiz",   role: "Cook",             department: "BOH",  pay_type: "hourly", rate: 17.00, hours: 41 },
    { name: "Ryan Shea",    role: "Prep & driver",    department: "BOH",  pay_type: "hourly", rate: 13.00, hours: 16 },
    { name: "Ana Lima",     role: "Window & cashier", department: "FOH",  pay_type: "hourly", rate: 13.00, hours: 28 },
  ],
  // Two detailed MOD reports for yesterday; more are added below.
  modReports: [
    { daysAgo: 1, shift: "Dinner", manager: "Maeve Kelley", data: {
      weather: "Rain", temp: "54", weather_notes: "Steady rain 5–7 PM at the brewery. Fewer people outside; most orders came from inside the taproom.",
      sales: "640", hours_from: 17, hours_to: 21,
      hourly: { 17: 6, 18: 12, 19: 15, 20: 9, 21: 4 },
      staffing: { foh_sched: "1", foh_actual: "1", boh_sched: "2", boh_actual: "1" },
      employee: [
        { dept: "BOH", name: "Ryan Shea", type: "No call / no show", notes: "Didn't show for the 4:30 PM setup. Called twice, no answer.", action: "Maeve worked the fryer. Talk to Ryan before his next shift." },
        { dept: "BOH", name: "Marco Ruiz", type: "Injury: cut", notes: "Cut left index finger slicing lemons at 6:40 PM.", action: "First aid kit and a glove; kept cooking. Incident form filed." },
      ],
      guest: [
        { type: "Food: undercooked", table: "Window, 7:10 PM", notes: "Burger ordered medium came out rare.", resolution: "Cooked a new one right away and added a free lemonade." },
        { type: "Slow service / long wait", table: "Taproom pickup", notes: "20-minute wait for Fish & Chips with one cook short.", resolution: "Apologized and comped Curry Chips." },
      ],
      comps: [
        { type: "Recook", item: "Kelley's Pub Burger", amount: "4.88", reason: "Undercooked", approved: "Maeve" },
        { type: "Comp: kitchen mistake", item: "Fresh Lemonade", amount: "4.00", reason: "Sorry for the recook", approved: "Maeve" },
        { type: "Comp: service mistake", item: "Curry Chips", amount: "7.00", reason: "Long wait", approved: "Maeve" },
      ],
      eighty_six: "Fish & Chips 86'd at 8:15 PM: cod order came in 5 lb short, supplier says Thursday.",
      maintenance: "Generator propane under a quarter tank. Fryer is slow to heat back up; check the thermostat.",
      cash_over_short: "-2.25", checks: { temps: true, cleaning: true, deposit: true, alarm: true },
      forecast: { covers: "70", sales: "980", reservations: "Catering pickup: 20 Reubens for the office park at 11:30 AM.",
        events: "Lunch at the Tech Center lot. Clear skies.", staffing: "Need Ryan or a backup for lunch prep.",
        prep: "Extra beer batter. Confirm the cod delivery by 9 AM or keep Fish & Chips 86'd." },
      summary: "Slow, wet night at Hops & Barley Brewery. Peaked at 7 PM. One cook short, so tickets ran long.",
      wins: "Ana kept the line moving and the window friendly the whole night.",
      followups: "Ryan's no-show. Refill propane. Check on Marco's finger before tomorrow.",
    } },
    { daysAgo: 1, shift: "Lunch", manager: "Maeve Kelley", data: {
      weather: "Cloudy", temp: "58", weather_notes: "",
      sales: "760", hours_from: 11, hours_to: 14,
      hourly: { 11: 9, 12: 24, 13: 16, 14: 5 },
      staffing: { foh_sched: "1", foh_actual: "1", boh_sched: "2", boh_actual: "2" },
      employee: [], guest: [],
      comps: [
        { type: "Void: rung in wrong", item: "Corned Beef Reuben", amount: "13.00", reason: "Rung in twice", approved: "Maeve" },
      ],
      eighty_six: "", maintenance: "Awning crank is sticking.",
      cash_over_short: "0", checks: { temps: true, cleaning: true },
      forecast: { covers: "45", sales: "650", reservations: "None.", events: "Brewery night at Hops & Barley, 5–9 PM.", staffing: "Marco and Ryan on the line, Ana at the window.", prep: "Pre-portion cod and batter for dinner." },
      summary: "Steady lunch downtown on Market St. No real problems.", wins: "", followups: "Dinner: cod delivery is short, watch Fish & Chips counts.",
    } },
  ],
};

// ---------------------------------------------------------------------
// Kelley's: two more weeks of MOD reports (lunch + dinner, 2–15 days ago;
// closed Mondays), so the MOD Report tab has history to look at. Made up
// but realistic for a food truck: weekends are busier, rain hurts, a few
// shifts have issues. Uses a fixed random seed, so every new Kelley's gets
// the same reports.
// ---------------------------------------------------------------------
(function () {
  let seed = 20261104;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const between = (lo, hi) => Math.round(lo + rnd() * (hi - lo));
  const chance = (p) => rnd() < p;

  const weatherByTemp = [["Sunny", 66, 74], ["Partly cloudy", 60, 70], ["Cloudy", 55, 63], ["Rain", 50, 58], ["Windy", 52, 60]];
  const LUNCH_SPOTS = ["Downtown on Market St", "Tech Center office park", "University Ave near campus", "Hospital lot on 19th St"];
  const DINNER_SPOTS = ["Hops & Barley Brewery", "Riverside apartments", "Old City night market", "Northshore taproom"];
  const EMP = [
    ["FOH", "Ana Lima", "Called out sick", "Texted at 9 AM with a fever.", "Maeve ran the window; doctor's note requested."],
    ["BOH", "Ryan Shea", "Called out sick", "Called in sick before setup.", "Maeve did prep and worked the fryer."],
    ["BOH", "Ryan Shea", "Late arrival", "Showed up 20 minutes late for setup.", "Verbal reminder; truck still opened on time."],
    ["BOH", "Marco Ruiz", "Injury: burn", "Minor burn on the forearm from the fryer basket.", "Cooled with water, burn cream; kept working. Incident form filed."],
    ["FOH", "Ana Lima", "Guest complaint about employee", "Guest said the window was rushed and short with them.", "Talked with Ana; busy rush, no pattern."],
    ["BOH", "Marco Ruiz", "Left early / sent home", "Felt dizzy in the heat of the truck.", "Sent home at 7:30 PM; added a second fan."],
  ];
  const GUEST = [
    ["Food: undercooked", "Burger ordered medium-well came out pink.", "Cooked a new one; free lemonade."],
    ["Slow service / long wait", "25-minute wait during the rush.", "Apologized and comped Curry Chips."],
    ["Wrong order", "Got the Reuben instead of the Shepherd's Pie Bowl.", "Fixed right away, comped a pudding cup."],
    ["Allergy concern", "Guest with a dairy allergy asked about the chips.", "Confirmed the fryer oil and chips are dairy-free; skipped the cheese."],
    ["Food: quality or taste", "Said the chips were soggy.", "Fresh basket; no comp needed."],
    ["Billing / payment issue", "Card reader charged a guest twice.", "Refunded the duplicate on the spot."],
  ];
  const COMP = [
    ["Comp: VIP / regular", "Fresh Lemonade", 4, "Regular from the office park"],
    ["Comp: kitchen mistake", "Sticky Toffee Pudding Cup", 6, "Long wait"],
    ["Comp: service mistake", "Curry Chips", 7, "Forgot it in the bag"],
    ["Recook", "Fish & Chips", 6.52, "Batter came out pale"],
    ["Void: rung in wrong", "Guinness BBQ Wings", 11, "Rung in twice"],
    ["Refund", "Corned Beef Reuben", 13, "Guest left before it was ready"],
    ["Employee / manager meal", "Crew meal", 12, "Double-shift meal"],
  ];
  const LUNCH = [8, 22, 17, 5];       // 11 AM – 2 PM
  const DINNER = [5, 11, 13, 7, 3];   // 5 PM – 9 PM

  const today = new Date();
  const reports = [];
  for (let daysAgo = 2; daysAgo <= 15; daysAgo++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo).getDay();
    if (day === 1) continue;   // closed Mondays
    const busy = day === 5 || day === 6 ? 1.35 : day === 0 ? 1.1 : 1;
    const [weather, lo, hi] = pick(weatherByTemp);
    const wet = weather === "Rain";

    for (const shift of ["Lunch", "Dinner"]) {
      const dinner = shift === "Dinner";
      const curve = dinner ? DINNER : LUNCH;
      const from = dinner ? 17 : 11;
      const spot = pick(dinner ? DINNER_SPOTS : LUNCH_SPOTS);
      const factor = busy * (wet ? 0.75 : 1) * (0.9 + rnd() * 0.2);
      const hourly = {};
      curve.forEach((c, i) => { hourly[from + i] = Math.max(0, Math.round(c * factor + between(-1, 1))); });
      const covers = Object.values(hourly).reduce((s, c) => s + c, 0);
      const sales = Math.round(covers * between(13, 16));

      const employee = [], guest = [], comps = [];
      if (chance(0.15)) {
        const [dept, name, type, notes, action] = pick(EMP);
        employee.push({ dept, name, type, notes, action });
      }
      if (chance(0.25)) {
        const [type, notes, resolution] = pick(GUEST);
        guest.push({ type, table: dinner ? "Window, dinner rush" : "Window, lunch rush", notes, resolution });
      }
      for (let i = 0, n = between(0, dinner ? 2 : 1); i < n; i++) {
        const [type, item, amount, reason] = pick(COMP);
        comps.push({ type, item, amount: amount.toFixed(2), reason, approved: "Maeve" });
      }
      const short = employee.some((e) => /sick|no show|sent home/i.test(e.type));
      const peakHour = from + curve.indexOf(Math.max(...curve));

      reports.push({ daysAgo, shift, manager: "Maeve Kelley", data: {
        weather, temp: String(between(lo, hi) - (dinner ? 4 : 0)),
        weather_notes: wet ? "Rain kept the line short; most orders were to-go." : weather === "Sunny" ? "Nice out; line stayed long all shift." : "",
        sales: String(sales), hours_from: from, hours_to: from + curve.length - 1, hourly,
        staffing: {
          foh_sched: "1", foh_actual: String(short && employee[0].dept === "FOH" ? 0 : 1),
          boh_sched: "2", boh_actual: String(short && employee[0].dept === "BOH" ? 1 : 2),
        },
        employee, guest, comps,
        eighty_six: chance(0.2) ? pick(["Out of cod by 1:15 PM.", "Ran out of potato buns at 7 PM.", "Lemonade sold out.", "Low on lamb; order placed."]) : "",
        maintenance: chance(0.2) ? pick(["Generator needs an oil change.", "Awning crank is sticking.", "Card reader dropped signal twice.", "Fryer oil changed; old oil to the recycling bin."]) : "",
        cash_over_short: chance(0.8) ? "0" : (between(-500, 200) / 100).toFixed(2),
        checks: { temps: true, cleaning: true, deposit: dinner, alarm: dinner },
        forecast: {
          covers: String(Math.round(covers * (0.9 + rnd() * 0.25))), sales: String(Math.round(sales * (0.9 + rnd() * 0.25))),
          reservations: chance(0.25) ? `Catering pickup: ${between(10, 25)} meals at ${between(11, 12)}:30.` : "Nothing booked.",
          events: `Next stop: ${pick(dinner ? LUNCH_SPOTS : DINNER_SPOTS)}.`,
          staffing: short ? "Confirm the full crew is coming in." : "Normal crew.",
          prep: pick(["Two batches of beer batter.", "Pre-portion cod.", "Make a double batch of curry sauce.", "Restock to-go boats and napkins."]),
        },
        summary: `${covers > (dinner ? 45 : 60) ? "Busy" : covers < (dinner ? 30 : 40) ? "Slow" : "Steady"} ${shift.toLowerCase()} at ${spot}. Peaked around ${peakHour > 12 ? peakHour - 12 : peakHour} ${peakHour >= 12 ? "PM" : "AM"}.` +
          (employee.length || guest.length ? " Issues noted below." : " No problems."),
        wins: chance(0.35) ? pick(["Ana knew half the line by name.", "Marco kept every ticket under 10 minutes.", "Sold out of lemonade by 1 PM.", "Ryan had the truck set up 15 minutes early."]) : "",
        followups: employee.length ? `Follow up with ${employee[0].name}.` : "",
      } });
    }
  }
  window.SEEDS.kelleys.modReports.push(...reports);
})();
