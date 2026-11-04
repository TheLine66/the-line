// =====================================================================
// The Line: sample menus
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
// Sample 2: Kelley's (imaginary family-owned Irish gastropub, 40 seats)
// Run by Maeve Kelley (front of house) and her brother Declan (chef).
// A short menu, about $10,000 a week in food, and a team of eight.
// Built to tell a story: Fish & Chips is the best-seller AND the worst
// food-cost %, and the fish supplier just raised cod prices (see the
// saved scenario).
// ---------------------------------------------------------------------
window.SEEDS.kelleys = {
  label: "Kelley's: family-owned Irish gastropub, 40 seats (12 dishes, 6 weeks of sales, team of 8, 2 weeks of MOD reports)",
  targets: { low: 28, mid: 31, high: 34 },
  ingredients: {
    // Proteins
    cod:          { name: "Atlantic cod fillet", unit: "oz", cost: 0.85 },
    groundchuck:  { name: "Ground chuck (80/20)", unit: "oz", cost: 0.38 },
    groundlamb:   { name: "Ground lamb", unit: "oz", cost: 0.58 },
    cornedbeef:   { name: "Corned beef brisket", unit: "oz", cost: 0.62 },
    lambshank:    { name: "Lamb shank", unit: "each", cost: 7.80 },
    bangers:      { name: "Pork bangers", unit: "oz", cost: 0.36 },
    wings:        { name: "Chicken wings", unit: "oz", cost: 0.32 },
    baconrashers: { name: "Irish bacon rashers", unit: "oz", cost: 0.55 },
    egg:          { name: "Egg", unit: "each", cost: 0.28 },
    // Dairy
    cheddar:      { name: "Aged Irish cheddar", unit: "oz", cost: 0.62 },
    swiss:        { name: "Swiss cheese", unit: "oz", cost: 0.38 },
    cream:        { name: "Heavy cream", unit: "oz", cost: 0.16 },
    icecream:     { name: "Vanilla ice cream", unit: "oz", cost: 0.20 },
    // Produce
    chips:        { name: "Hand-cut chips", unit: "oz", cost: 0.07 },
    potato:       { name: "Yukon gold potatoes", unit: "oz", cost: 0.06 },
    colcannon:    { name: "Colcannon mash", unit: "oz", cost: 0.11 },
    rootveg:      { name: "Root vegetable mix", unit: "oz", cost: 0.07 },
    leeks:        { name: "Leeks", unit: "oz", cost: 0.12 },
    lettuce:      { name: "Butter lettuce", unit: "oz", cost: 0.20 },
    tomato:       { name: "Tomato", unit: "oz", cost: 0.12 },
    celery:       { name: "Celery sticks", unit: "oz", cost: 0.05 },
    chives:       { name: "Chives", unit: "oz", cost: 0.60 },
    lemon:        { name: "Lemon", unit: "each", cost: 0.30 },
    // House-made sauces & prepped items
    beerbatter:   { name: "Guinness beer batter", unit: "oz", cost: 0.12 },
    tartar:       { name: "Tartar sauce", unit: "oz", cost: 0.20 },
    mushypeas:    { name: "Mushy peas", unit: "oz", cost: 0.10 },
    pubsauce:     { name: "Kelley's pub sauce", unit: "oz", cost: 0.18 },
    bbqsauce:     { name: "Guinness BBQ sauce", unit: "oz", cost: 0.18 },
    bluedip:      { name: "Blue cheese dip", unit: "oz", cost: 0.25 },
    beercheese:   { name: "Beer cheese", unit: "oz", cost: 0.30 },
    mustardcream: { name: "Whole-grain mustard cream", unit: "oz", cost: 0.30 },
    curry:        { name: "Chip-shop curry sauce", unit: "oz", cost: 0.15 },
    oniongravy:   { name: "Onion gravy", unit: "oz", cost: 0.12 },
    caramelonion: { name: "Caramelized onions", unit: "oz", cost: 0.10 },
    sauerkraut:   { name: "Sauerkraut", unit: "oz", cost: 0.08 },
    toffee:       { name: "Toffee sauce", unit: "oz", cost: 0.25 },
    // Pantry & bakery
    stout:        { name: "Guinness stout (kitchen)", unit: "oz", cost: 0.16 },
    chickenstock: { name: "Chicken stock", unit: "oz", cost: 0.05 },
    panko:        { name: "Panko breadcrumbs", unit: "oz", cost: 0.10 },
    bun:          { name: "Potato bun", unit: "each", cost: 0.45 },
    rye:          { name: "Marbled rye bread (2 slices)", unit: "each", cost: 0.40 },
    sodabread:    { name: "Brown soda bread", unit: "oz", cost: 0.09 },
    pretzel:      { name: "Bavarian soft pretzel", unit: "each", cost: 0.85 },
    toffeecake:   { name: "Sticky toffee sponge", unit: "each", cost: 0.95 },
  },
  dishes: [
    { name: "Scotch Egg", category: "Starters", price: 9.00, weeklyUnits: 45,
      items: [ ["egg", 1], ["bangers", 3], ["panko", 1], ["mustardcream", 1] ] },
    { name: "Soft Pretzel & Beer Cheese", category: "Starters", price: 9.00, weeklyUnits: 50,
      items: [ ["pretzel", 1], ["beercheese", 4], ["mustardcream", 1] ] },
    { name: "Guinness BBQ Wings", category: "Starters", price: 13.00, weeklyUnits: 70,
      items: [ ["wings", 10], ["bbqsauce", 2], ["celery", 2], ["bluedip", 2] ] },
    { name: "Potato Leek Soup", category: "Starters", price: 7.00, weeklyUnits: 38,
      items: [ ["potato", 6], ["leeks", 3], ["cream", 3], ["chickenstock", 8], ["chives", 0.1], ["sodabread", 2] ] },
    { name: "Fish & Chips", category: "Mains", price: 19.00, weeklyUnits: 135,
      items: [ ["cod", 7], ["beerbatter", 3], ["chips", 10], ["tartar", 2], ["mushypeas", 4], ["lemon", 0.5] ] },
    { name: "Kelley's Pub Burger", category: "Mains", price: 16.00, weeklyUnits: 105,
      items: [ ["groundchuck", 7], ["cheddar", 1.5], ["baconrashers", 1], ["bun", 1], ["caramelonion", 1], ["pubsauce", 1], ["lettuce", 0.5], ["tomato", 1], ["chips", 8] ] },
    { name: "Corned Beef Reuben", category: "Mains", price: 15.00, weeklyUnits: 55,
      items: [ ["cornedbeef", 5], ["rye", 1], ["swiss", 1.5], ["sauerkraut", 2], ["pubsauce", 1], ["chips", 8] ] },
    { name: "Shepherd's Pie", category: "Mains", price: 18.00, weeklyUnits: 60,
      items: [ ["groundlamb", 7], ["rootveg", 3], ["stout", 2], ["colcannon", 6], ["cheddar", 0.5] ] },
    { name: "Bangers & Mash", category: "Mains", price: 17.00, weeklyUnits: 38,
      items: [ ["bangers", 8], ["colcannon", 8], ["oniongravy", 4] ] },
    { name: "Braised Lamb Shank", category: "Mains", price: 28.00, weeklyUnits: 22,
      items: [ ["lambshank", 1], ["stout", 3], ["rootveg", 4], ["colcannon", 6] ] },
    { name: "Curry Chips", category: "Sides", price: 6.00, weeklyUnits: 50,
      items: [ ["chips", 10], ["curry", 3] ] },
    { name: "Sticky Toffee Pudding", category: "Desserts", price: 9.00, weeklyUnits: 45,
      items: [ ["toffeecake", 1], ["toffee", 2], ["icecream", 2] ] },
  ],
  // 6 finished weeks of sales, oldest → newest.
  weekFactors: [0.88, 0.95, 1.02, 0.97, 1.05, 1.0],
  // Pre-saved what-if scenarios (keys refer to the ingredient list above).
  scenarios: [
    { name: "Cod +18% (supplier notice)", adjustments: { cod: 18 } },
  ],
  // What's in the walk-in for the Specials page: [amount on hand, days
  // until it must be used]. Dates count from the day the restaurant is
  // created, so a few things are always about to spoil.
  stock: {
    cod: [60, 2], groundchuck: [80, 3], groundlamb: [35, 3], cornedbeef: [70, 9], lambshank: [8, 6],
    bangers: [50, 7], wings: [90, 4], baconrashers: [24, 10], egg: [36, 18],
    cheddar: [40, 25], swiss: [20, 21], cream: [64, 2], icecream: [96, 60],
    chips: [150, 3], potato: [200, 14], colcannon: [60, 2], rootveg: [80, 5], leeks: [30, 4], lettuce: [16, 1],
    tomato: [24, 2], celery: [30, 6], chives: [4, 3], lemon: [20, 9],
    beerbatter: [40, 1], tartar: [30, 5], mushypeas: [40, 3], pubsauce: [32, 10], bbqsauce: [40, 21], bluedip: [24, 4],
    beercheese: [30, 5], mustardcream: [20, 6], curry: [36, 7], oniongravy: [30, 4], caramelonion: [20, 5],
    sauerkraut: [48, 30], toffee: [30, 14],
    stout: [128, 60], chickenstock: [160, 5], panko: [64, 120], bun: [36, 4], rye: [20, 5], sodabread: [40, 2],
    pretzel: [24, 3], toffeecake: [18, 4],
  },
  // The team for the Labor Costs tab. Hourly hours follow weekFactors.
  // rate = $/hour (hourly) or $/week (salary). Servers and the bartender
  // earn Tennessee's tipped minimum wage plus tips. The owners pay
  // themselves a modest salary. Marco works a little overtime.
  staff: [
    { name: "Maeve Kelley",  role: "Owner / general manager", department: "Mgmt", pay_type: "salary", rate: 650,  hours: 55 },
    { name: "Declan Kelley", role: "Chef / co-owner",         department: "Mgmt", pay_type: "salary", rate: 700,  hours: 55 },
    { name: "Marco Ruiz",    role: "Line cook",               department: "BOH",  pay_type: "hourly", rate: 17.00, hours: 41 },
    { name: "Sam Ortiz",     role: "Prep cook & dishwasher",  department: "BOH",  pay_type: "hourly", rate: 12.50, hours: 26 },
    { name: "Jess Monroe",   role: "Server",                  department: "FOH",  pay_type: "hourly", rate: 2.13,  hours: 28 },
    { name: "Ana Lima",      role: "Server",                  department: "FOH",  pay_type: "hourly", rate: 2.13,  hours: 24 },
    { name: "Ryan Shea",     role: "Bartender",               department: "FOH",  pay_type: "hourly", rate: 5.00,  hours: 32 },
    { name: "Olivia Park",   role: "Host & busser",           department: "FOH",  pay_type: "hourly", rate: 10.00, hours: 18 },
  ],
  // Two detailed MOD reports for yesterday; two more weeks are added below.
  // Net sales on MOD reports include the bar, so they run higher than the
  // food-only sales on the Weekly Sales tab.
  modReports: [
    { daysAgo: 1, shift: "Dinner", manager: "Maeve Kelley", data: {
      weather: "Rain", temp: "54", weather_notes: "Steady rain 5 to 8 PM. Two walk-in parties left when we quoted a 20-minute wait.",
      sales: "1520", hours_from: 17, hours_to: 21,
      hourly: { 17: 6, 18: 13, 19: 17, 20: 12, 21: 4 },
      staffing: { foh_sched: "4", foh_actual: "3", boh_sched: "3", boh_actual: "3" },
      employee: [
        { dept: "FOH", name: "Jess Monroe", type: "No call / no show", notes: "Didn't show for her 4:30 PM shift. Called twice, no answer.", action: "Ana took the whole floor and Olivia ran food. Talk to Jess before her next shift." },
        { dept: "BOH", name: "Marco Ruiz", type: "Injury: cut", notes: "Cut his left index finger on the mandoline at 6:40 PM.", action: "First aid and a glove; finished the night on the grill. Incident form filed." },
      ],
      guest: [
        { type: "Food: undercooked", table: "Table 6", notes: "Burger ordered medium came out rare.", resolution: "Recooked right away and comped dessert. Guest left happy." },
        { type: "Slow service / long wait", table: "Bar, 2 guests", notes: "Waited 25 minutes for Fish & Chips during the 7 PM rush.", resolution: "Apologized and comped a pint." },
      ],
      comps: [
        { type: "Recook", item: "Kelley's Pub Burger", amount: "5.65", reason: "Undercooked (Table 6)", approved: "Maeve" },
        { type: "Comp: kitchen mistake", item: "Sticky Toffee Pudding", amount: "9.00", reason: "Sorry for the recook (Table 6)", approved: "Maeve" },
        { type: "Comp: service mistake", item: "Pint of Guinness", amount: "7.00", reason: "Long ticket time at the bar", approved: "Maeve" },
        { type: "Comp: VIP / regular", item: "Scotch Egg", amount: "9.00", reason: "The Murphys' 10th anniversary", approved: "Maeve" },
      ],
      eighty_six: "Fish & Chips 86'd at 8:45 PM. The cod order came in 10 lb short; supplier says Thursday. Down to the last keg of Guinness.",
      maintenance: "Walk-in door gasket is torn (temps still OK at 37°F). Fryer 2 is slow to heat back up; Declan is calling for service.",
      cash_over_short: "-4.25", checks: { temps: true, cleaning: true, deposit: true, alarm: true },
      forecast: { covers: "70", sales: "1950", reservations: "Party of 12 at 7 PM (birthday). Push tables 8 and 9 together.",
        events: "Home game ends around 6:30 PM, so expect a post-game rush. Clear skies.",
        staffing: "Need Jess or a backup server 5 to 9 PM.", prep: "Double batch of beer batter and tartar. Confirm the cod delivery by noon or keep Fish & Chips 86'd." },
      summary: "Busy, wet night that peaked at 7 PM. One server short, so tables waited longer than usual.",
      wins: "Ana covered the whole floor without a single complaint. Olivia jumped in running food.",
      followups: "Jess's no-show. Order a walk-in gasket. Check on Marco's finger before his next shift.",
    } },
    { daysAgo: 1, shift: "Lunch", manager: "Declan Kelley", data: {
      weather: "Cloudy", temp: "58", weather_notes: "",
      sales: "690", hours_from: 11, hours_to: 14,
      hourly: { 11: 5, 12: 12, 13: 8, 14: 3 },
      staffing: { foh_sched: "2", foh_actual: "2", boh_sched: "2", boh_actual: "2" },
      employee: [
        { dept: "BOH", name: "Sam Ortiz", type: "Late arrival", notes: "30 minutes late because of a bus delay.", action: "Talked it through; no write-up." },
      ],
      guest: [],
      comps: [
        { type: "Void: rung in wrong", item: "Corned Beef Reuben", amount: "15.00", reason: "Rung in twice", approved: "Declan" },
      ],
      eighty_six: "", maintenance: "Ice machine is making a grinding noise. Keep an eye on it.",
      cash_over_short: "0", checks: { temps: true, cleaning: true },
      forecast: { covers: "30", sales: "720", reservations: "None on the books.", events: "", staffing: "Normal lunch crew.", prep: "Two batches of potato leek soup." },
      summary: "Quiet, steady lunch.", wins: "", followups: "Dinner team: the cod delivery is short, so watch Fish & Chips counts.",
    } },
  ],
};

// ---------------------------------------------------------------------
// Kelley's: two more weeks of MOD reports (lunch and dinner, 2 to 15 days
// ago; closed Mondays), so the MOD Report tab has history. Weekends are
// busier, rain slows things down, and a few shifts have issues. Uses a
// fixed random seed, so every new Kelley's gets the same reports.
// ---------------------------------------------------------------------
(function () {
  let seed = 20261104;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const between = (lo, hi) => Math.round(lo + rnd() * (hi - lo));
  const chance = (p) => rnd() < p;

  const weatherByTemp = [["Sunny", 66, 74], ["Partly cloudy", 60, 70], ["Cloudy", 55, 63], ["Rain", 50, 58], ["Windy", 52, 60]];
  const EMP = [
    ["FOH", "Ana Lima", "Called out sick", "Texted at 2 PM with a fever.", "Jess took both sections; doctor's note requested."],
    ["BOH", "Sam Ortiz", "Called out sick", "Called in sick before his shift.", "Declan and Marco split dishes and prep."],
    ["FOH", "Olivia Park", "Late arrival", "Showed up 20 minutes late.", "Verbal reminder about the schedule."],
    ["BOH", "Marco Ruiz", "Injury: burn", "Minor burn on his forearm from the fryer basket.", "Cooled it with water, burn cream; kept working. Incident form filed."],
    ["FOH", "Ryan Shea", "Coworker dispute", "Disagreement with a server over who covers the patio.", "Talked to both after close; the host now assigns the patio."],
    ["BOH", "Sam Ortiz", "Left early / sent home", "Felt dizzy during the rush.", "Sent home at 8 PM; check in tomorrow."],
  ];
  const GUEST = [
    ["Food: undercooked", "Burger ordered medium-well came out pink.", "Recooked and comped dessert. Guest happy."],
    ["Food: overcooked / wrong temp", "Lamb shank sent back as dry.", "Swapped for Shepherd's Pie; comped the shank."],
    ["Slow service / long wait", "35-minute wait for food during the rush.", "Apologized and comped a round of drinks."],
    ["Wrong order", "Got Bangers & Mash instead of Shepherd's Pie.", "Fixed right away and comped Curry Chips."],
    ["Allergy concern", "Guest with a dairy allergy asked about the soup.", "Steered them to the Reuben without cheese; Declan confirmed."],
    ["Food: quality or taste", "Said the chips were soggy.", "Fresh basket from fryer 1; no comp needed."],
    ["Billing / payment issue", "Card charged twice for one check.", "Voided the duplicate and showed the guest the receipt."],
  ];
  const COMP = [
    ["Comp: VIP / regular", "Round of Guinness", 21, "Regulars celebrating a promotion"],
    ["Comp: kitchen mistake", "Sticky Toffee Pudding", 9, "Long ticket time"],
    ["Comp: service mistake", "Soft Pretzel & Beer Cheese", 9, "Forgot to fire the appetizer"],
    ["Recook", "Fish & Chips", 7.96, "Batter came out pale"],
    ["Void: rung in wrong", "Guinness BBQ Wings", 13, "Rung in on the wrong table"],
    ["Refund", "Corned Beef Reuben", 15, "Guest left before it arrived"],
    ["Employee / manager meal", "Staff meal", 16, "Double-shift meal for the closer"],
  ];
  const EVENTS = ["Trivia night at 7 PM.", "Home game in the afternoon.", "Live music Friday, 8 to 11 PM.", "Rehearsal dinner for 12 at 6 PM.", "Quiet weeknight, nothing booked."];
  const LUNCH = [6, 13, 9, 3];        // 11 AM – 2 PM
  const DINNER = [7, 15, 19, 14, 6];  // 5 PM – 9 PM

  const today = new Date();
  const reports = [];
  for (let daysAgo = 2; daysAgo <= 15; daysAgo++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo).getDay();
    if (day === 1) continue;   // closed Mondays
    const busy = day === 5 || day === 6 ? 1.3 : day === 0 ? 1.1 : 1;
    const [weather, lo, hi] = pick(weatherByTemp);
    const wet = weather === "Rain";

    for (const shift of ["Lunch", "Dinner"]) {
      const dinner = shift === "Dinner";
      const curve = dinner ? DINNER : LUNCH;
      const from = dinner ? 17 : 11;
      const factor = busy * (wet ? 0.85 : 1) * (0.9 + rnd() * 0.2);
      const hourly = {};
      curve.forEach((c, i) => { hourly[from + i] = Math.max(0, Math.round(c * factor + between(-1, 1))); });
      const covers = Object.values(hourly).reduce((s, c) => s + c, 0);
      const sales = Math.round(covers * (dinner ? between(27, 31) : between(21, 24)));

      const employee = [], guest = [], comps = [];
      if (chance(dinner ? 0.25 : 0.1)) {
        const [dept, name, type, notes, action] = pick(EMP);
        employee.push({ dept, name, type, notes, action });
      }
      if (chance(dinner ? 0.35 : 0.15)) {
        const [type, notes, resolution] = pick(GUEST);
        guest.push({ type, table: chance(0.3) ? "Bar" : `Table ${between(1, 12)}`, notes, resolution });
      }
      for (let i = 0, n = between(0, dinner ? 2 : 1); i < n; i++) {
        const [type, item, amount, reason] = pick(COMP);
        comps.push({ type, item, amount: amount.toFixed(2), reason, approved: dinner ? "Maeve" : "Declan" });
      }
      const short = employee.some((e) => /sick|no show|sent home/i.test(e.type));
      const fohSched = dinner ? 4 : 2, bohSched = dinner ? 3 : 2;
      const peakHour = from + curve.indexOf(Math.max(...curve));

      reports.push({ daysAgo, shift, manager: dinner ? "Maeve Kelley" : "Declan Kelley", data: {
        weather, temp: String(between(lo, hi) - (dinner ? 4 : 0)),
        weather_notes: wet ? (dinner ? "Patio closed; walk-ins were slower." : "Lighter lunch traffic in the rain.") : weather === "Sunny" ? "Patio full." : "",
        sales: String(sales), hours_from: from, hours_to: from + curve.length - 1, hourly,
        staffing: {
          foh_sched: String(fohSched), foh_actual: String(fohSched - (short && employee[0].dept === "FOH" ? 1 : 0)),
          boh_sched: String(bohSched), boh_actual: String(bohSched - (short && employee[0].dept === "BOH" ? 1 : 0)),
        },
        employee, guest, comps,
        eighty_six: chance(0.2) ? pick(["Lamb shank 86'd at 8:30 PM.", "Out of sticky toffee sponge by 9 PM.", "Low on Irish cheddar; order placed.", "Out of soda bread by 1 PM."]) : "",
        maintenance: chance(0.2) ? pick(["Bathroom faucet is dripping.", "One patio heater won't light.", "Dish machine needed a reset mid-shift.", "Light out over table 9."]) : "",
        cash_over_short: chance(0.75) ? "0" : (between(-800, 300) / 100).toFixed(2),
        checks: { temps: true, cleaning: true, deposit: dinner, alarm: dinner },
        forecast: {
          covers: String(Math.round(covers * (0.9 + rnd() * 0.25))), sales: String(Math.round(sales * (0.9 + rnd() * 0.25))),
          reservations: dinner && chance(0.4) ? `Party of ${between(6, 12)} at ${between(6, 8)} PM.` : "Nothing large on the books.",
          events: dinner ? pick(EVENTS) : "", staffing: short ? "Confirm everyone is coming in tomorrow." : "Normal crew.",
          prep: pick(["Two batches of beer batter.", "Braise lamb shanks in the morning.", "Extra colcannon for the weekend.", "Two batches of potato leek soup."]),
        },
        summary: `${covers > (dinner ? 65 : 34) ? "Busy" : covers < (dinner ? 50 : 26) ? "Slow" : "Steady"} ${shift.toLowerCase()} that peaked around ${peakHour > 12 ? peakHour - 12 : peakHour} ${peakHour >= 12 ? "PM" : "AM"}.` +
          (employee.length || guest.length ? " Issues noted below." : " No problems."),
        wins: chance(0.35) ? pick(["Olivia kept the wait list moving.", "Marco hit every ticket time in the rush.", "Ryan sold a dozen Irish coffees.", "Ana got a guest shout-out by name."]) : "",
        followups: employee.length ? `Follow up with ${employee[0].name}.` : "",
      } });
    }
  }
  window.SEEDS.kelleys.modReports.push(...reports);
})();
