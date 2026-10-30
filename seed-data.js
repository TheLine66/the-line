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
// Sample 2: Kelley's (imaginary Irish-American gastropub)
// Built to tell a story on the Performance tab: Fish & Chips is the
// best-seller AND the worst food-cost %, and the fish supplier just
// raised cod prices (see the saved scenario at the bottom).
// ---------------------------------------------------------------------
window.SEEDS.kelleys = {
  label: "Kelley's: Irish-American gastropub (17 dishes, 6 weeks of sales)",
  targets: { low: 28, mid: 31, high: 34 },
  ingredients: {
    // Proteins
    cod:          { name: "Atlantic cod fillet", unit: "oz", cost: 0.85 },
    groundchuck:  { name: "Ground chuck (80/20)", unit: "oz", cost: 0.38 },
    cornedbeef:   { name: "Corned beef brisket", unit: "oz", cost: 0.62 },
    beefchuck:    { name: "Beef chuck, diced", unit: "oz", cost: 0.42 },
    lambshank:    { name: "Lamb shank", unit: "each", cost: 7.80 },
    wings:        { name: "Chicken wings", unit: "oz", cost: 0.32 },
    bangers:      { name: "Pork bangers", unit: "oz", cost: 0.36 },
    baconrashers: { name: "Irish bacon rashers", unit: "oz", cost: 0.55 },
    blackpudding: { name: "Black pudding", unit: "oz", cost: 0.48 },
    smokedsalmon: { name: "Smoked salmon", unit: "oz", cost: 1.40 },
    scallops:     { name: "Sea scallops (U10)", unit: "each", cost: 2.10 },
    egg:          { name: "Egg", unit: "each", cost: 0.28 },
    // Dairy
    cheddar:      { name: "Aged Irish cheddar", unit: "oz", cost: 0.62 },
    swiss:        { name: "Swiss cheese", unit: "oz", cost: 0.38 },
    bluecheese:   { name: "Irish blue cheese", unit: "oz", cost: 0.70 },
    butter:       { name: "Irish butter", unit: "oz", cost: 0.32 },
    cream:        { name: "Heavy cream", unit: "oz", cost: 0.16 },
    cremefraiche: { name: "Crème fraîche", unit: "oz", cost: 0.35 },
    icecream:     { name: "Vanilla ice cream", unit: "oz", cost: 0.20 },
    // Produce
    chips:        { name: "Hand-cut chips", unit: "oz", cost: 0.07 },
    potato:       { name: "Yukon gold potatoes", unit: "oz", cost: 0.06 },
    colcannon:    { name: "Colcannon mash", unit: "oz", cost: 0.11 },
    cabbage:      { name: "Green cabbage", unit: "oz", cost: 0.04 },
    carrots:      { name: "Carrots", unit: "oz", cost: 0.05 },
    rootveg:      { name: "Root vegetable mix", unit: "oz", cost: 0.07 },
    leeks:        { name: "Leeks", unit: "oz", cost: 0.12 },
    mushrooms:    { name: "Cremini mushrooms", unit: "oz", cost: 0.22 },
    greens:       { name: "Mixed greens", unit: "oz", cost: 0.28 },
    lettuce:      { name: "Butter lettuce", unit: "oz", cost: 0.20 },
    tomato:       { name: "Tomato", unit: "oz", cost: 0.12 },
    apple:        { name: "Granny Smith apple", unit: "oz", cost: 0.10 },
    celery:       { name: "Celery sticks", unit: "oz", cost: 0.05 },
    chives:       { name: "Chives", unit: "oz", cost: 0.60 },
    lemon:        { name: "Lemon", unit: "each", cost: 0.30 },
    // House-made sauces & prepped items
    beerbatter:   { name: "Guinness beer batter", unit: "oz", cost: 0.12 },
    tartar:       { name: "Tartar sauce", unit: "oz", cost: 0.20 },
    mushypeas:    { name: "Mushy peas", unit: "oz", cost: 0.10 },
    peapuree:     { name: "Pea purée", unit: "oz", cost: 0.14 },
    mustardcream: { name: "Whole-grain mustard cream", unit: "oz", cost: 0.30 },
    pubsauce:     { name: "Kelley's pub sauce", unit: "oz", cost: 0.18 },
    bbqsauce:     { name: "Guinness BBQ sauce", unit: "oz", cost: 0.18 },
    bluedip:      { name: "Blue cheese dip", unit: "oz", cost: 0.25 },
    beercheese:   { name: "Beer cheese", unit: "oz", cost: 0.30 },
    curry:        { name: "Chip-shop curry sauce", unit: "oz", cost: 0.15 },
    oniongravy:   { name: "Onion gravy", unit: "oz", cost: 0.12 },
    caramelonion: { name: "Caramelized onions", unit: "oz", cost: 0.10 },
    sauerkraut:   { name: "Sauerkraut", unit: "oz", cost: 0.08 },
    vinaigrette:  { name: "Cider vinaigrette", unit: "oz", cost: 0.15 },
    walnuts:      { name: "Candied walnuts", unit: "oz", cost: 0.55 },
    capers:       { name: "Capers", unit: "oz", cost: 0.45 },
    toffee:       { name: "Toffee sauce", unit: "oz", cost: 0.25 },
    mousse:       { name: "Chocolate mousse base", unit: "oz", cost: 0.30 },
    whipped:      { name: "Whipped cream", unit: "oz", cost: 0.12 },
    // Pantry, bakery & bar
    stout:        { name: "Guinness stout (kitchen)", unit: "oz", cost: 0.16 },
    baileys:      { name: "Baileys Irish cream", unit: "oz", cost: 0.95 },
    chickenstock: { name: "Chicken stock", unit: "oz", cost: 0.05 },
    panko:        { name: "Panko breadcrumbs", unit: "oz", cost: 0.10 },
    bun:          { name: "Potato bun", unit: "each", cost: 0.45 },
    rye:          { name: "Marbled rye bread (2 slices)", unit: "each", cost: 0.40 },
    sodabread:    { name: "Brown soda bread", unit: "oz", cost: 0.09 },
    pretzel:      { name: "Bavarian soft pretzel", unit: "each", cost: 0.85 },
    puffpastry:   { name: "Puff pastry lid", unit: "each", cost: 0.65 },
    toffeecake:   { name: "Sticky toffee sponge", unit: "each", cost: 0.95 },
  },
  dishes: [
    { name: "Scotch Eggs", category: "Starters", price: 12.00, weeklyUnits: 40,
      items: [ ["egg", 2], ["bangers", 4], ["panko", 1], ["mustardcream", 1.5] ] },
    { name: "Guinness BBQ Wings", category: "Starters", price: 15.00, weeklyUnits: 70,
      items: [ ["wings", 12], ["bbqsauce", 2], ["celery", 2], ["bluedip", 2] ] },
    { name: "Soft Pretzel & Beer Cheese", category: "Starters", price: 11.00, weeklyUnits: 55,
      items: [ ["pretzel", 1], ["beercheese", 4], ["mustardcream", 1] ] },
    { name: "Smoked Salmon & Soda Bread", category: "Starters", price: 16.00, weeklyUnits: 18,
      items: [ ["smokedsalmon", 3], ["sodabread", 3], ["butter", 0.5], ["capers", 0.3], ["cremefraiche", 1], ["lemon", 0.25] ] },
    { name: "Potato Leek Soup", category: "Soups & Salads", price: 9.00, weeklyUnits: 45,
      items: [ ["potato", 6], ["leeks", 3], ["cream", 3], ["chickenstock", 8], ["chives", 0.1], ["sodabread", 2] ] },
    { name: "Orchard Salad", category: "Soups & Salads", price: 13.00, weeklyUnits: 25,
      items: [ ["greens", 4], ["apple", 2], ["walnuts", 1], ["bluecheese", 1.5], ["vinaigrette", 1.5] ] },
    { name: "Kelley's Pub Burger", category: "Handhelds", price: 17.00, weeklyUnits: 110,
      items: [ ["groundchuck", 8], ["cheddar", 1.5], ["baconrashers", 1], ["bun", 1], ["caramelonion", 1], ["pubsauce", 1], ["lettuce", 0.5], ["tomato", 1], ["chips", 8] ] },
    { name: "Corned Beef Reuben", category: "Handhelds", price: 16.00, weeklyUnits: 60,
      items: [ ["cornedbeef", 6], ["rye", 1], ["swiss", 1.5], ["sauerkraut", 2], ["pubsauce", 1], ["chips", 8] ] },
    { name: "Fish & Chips", category: "Mains", price: 21.00, weeklyUnits: 140,
      items: [ ["cod", 8], ["beerbatter", 3], ["chips", 10], ["tartar", 2], ["mushypeas", 4], ["lemon", 0.5] ] },
    { name: "Guinness Beef Pie", category: "Mains", price: 22.00, weeklyUnits: 65,
      items: [ ["beefchuck", 8], ["stout", 3], ["mushrooms", 2], ["rootveg", 3], ["puffpastry", 1], ["colcannon", 5] ] },
    { name: "Braised Lamb Shank", category: "Mains", price: 32.00, weeklyUnits: 22,
      items: [ ["lambshank", 1], ["stout", 3], ["rootveg", 4], ["colcannon", 6] ] },
    { name: "Corned Beef & Cabbage", category: "Mains", price: 20.00, weeklyUnits: 35,
      items: [ ["cornedbeef", 8], ["cabbage", 6], ["potato", 6], ["carrots", 3], ["mustardcream", 2] ] },
    { name: "Seared Scallops & Black Pudding", category: "Mains", price: 34.00, weeklyUnits: 14,
      items: [ ["scallops", 5], ["peapuree", 3], ["blackpudding", 2], ["butter", 1] ] },
    { name: "Bangers & Mash", category: "Mains", price: 17.00, weeklyUnits: 20,
      items: [ ["bangers", 8], ["colcannon", 8], ["oniongravy", 4] ] },
    { name: "Curry Chips", category: "Sides", price: 7.00, weeklyUnits: 50,
      items: [ ["chips", 10], ["curry", 3] ] },
    { name: "Sticky Toffee Pudding", category: "Desserts", price: 10.00, weeklyUnits: 48,
      items: [ ["toffeecake", 1], ["toffee", 2], ["icecream", 2] ] },
    { name: "Baileys Chocolate Mousse", category: "Desserts", price: 9.00, weeklyUnits: 30,
      items: [ ["mousse", 5], ["whipped", 1], ["baileys", 0.5] ] },
  ],
  // 6 finished weeks of sales, oldest → newest.
  weekFactors: [0.88, 0.95, 1.02, 0.97, 1.05, 1.0],
  // Pre-saved what-if scenarios (keys refer to the ingredient list above).
  scenarios: [
    { name: "Cod +18% (supplier notice)", adjustments: { cod: 18 } },
  ],
  // Sample team for the Labor Costs tab. Hourly hours follow weekFactors.
  // rate = $/hour (hourly) or $/week (salary). Servers and bartenders earn
  // Tennessee's tipped minimum wage plus tips. Marco works overtime.
  staff: [
    { name: "Declan Byrne", role: "Kitchen manager", department: "Mgmt", pay_type: "salary", rate: 950, hours: 50 },
    { name: "Marco Ruiz",   role: "Line cook",       department: "BOH",  pay_type: "hourly", rate: 17.00, hours: 42 },
    { name: "Tasha Green",  role: "Line cook",       department: "BOH",  pay_type: "hourly", rate: 16.00, hours: 34 },
    { name: "Eli Novak",    role: "Prep cook",       department: "BOH",  pay_type: "hourly", rate: 14.00, hours: 30 },
    { name: "Sam Ortiz",    role: "Dishwasher",      department: "BOH",  pay_type: "hourly", rate: 12.50, hours: 28 },
    { name: "Jess Monroe",  role: "Server",          department: "FOH",  pay_type: "hourly", rate: 2.13,  hours: 30 },
    { name: "Kevin Doyle",  role: "Server",          department: "FOH",  pay_type: "hourly", rate: 2.13,  hours: 28 },
    { name: "Ana Lima",     role: "Server",          department: "FOH",  pay_type: "hourly", rate: 2.13,  hours: 26 },
    { name: "Ryan Shea",    role: "Bartender",       department: "FOH",  pay_type: "hourly", rate: 5.00,  hours: 36 },
    { name: "Olivia Park",  role: "Host",            department: "FOH",  pay_type: "hourly", rate: 11.00, hours: 24 },
    { name: "Ben Carter",   role: "Busser",          department: "FOH",  pay_type: "hourly", rate: 10.00, hours: 25 },
  ],
  // Sample MOD reports, dated relative to the day the restaurant is created.
  modReports: [
    { daysAgo: 1, shift: "Dinner", manager: "Maeve Kelley", data: {
      weather: "Rain", temp: "54", weather_notes: "Steady rain 5–8 PM. Patio closed; two walk-in parties left at a 30-minute wait.",
      sales: "3480", hours_from: 16, hours_to: 22,
      hourly: { 16: 8, 17: 22, 18: 41, 19: 48, 20: 37, 21: 19, 22: 7 },
      staffing: { foh_sched: "6", foh_actual: "5", boh_sched: "4", boh_actual: "4" },
      employee: [
        { dept: "FOH", name: "Kevin Doyle", type: "No call / no show", notes: "Didn't show for his 4 PM shift. Called twice, no answer.", action: "Ana picked up his section. Write-up ready for Monday." },
        { dept: "BOH", name: "Marco Ruiz", type: "Injury: cut", notes: "Cut left index finger on the mandoline at 6:40 PM.", action: "First aid and a glove; finished on grill. Incident form filed." },
      ],
      guest: [
        { type: "Food: undercooked", table: "Table 12", notes: "Burger ordered medium came out rare.", resolution: "Recooked right away and comped dessert. Guest left happy." },
        { type: "Slow service / long wait", table: "Bar, 2 guests", notes: "Waited 25 minutes for Fish & Chips in the 7 PM rush.", resolution: "Apologized and comped a pint." },
      ],
      comps: [
        { type: "Recook", item: "Kelley's Pub Burger", amount: "6.20", reason: "Undercooked (Table 12)", approved: "Maeve" },
        { type: "Comp: kitchen mistake", item: "Sticky Toffee Pudding", amount: "10.00", reason: "Sorry for the recook (Table 12)", approved: "Maeve" },
        { type: "Comp: service mistake", item: "Pint of Guinness", amount: "7.50", reason: "Long ticket time at the bar", approved: "Maeve" },
        { type: "Comp: VIP / regular", item: "Scotch Eggs", amount: "12.00", reason: "The Murphys' 10th anniversary", approved: "Maeve" },
      ],
      eighty_six: "Fish & Chips 86'd at 9:15 PM: cod order came in 10 lb short, supplier says Thursday. Down to the last keg of Guinness.",
      maintenance: "Walk-in door gasket is torn (temps still OK at 37°F). Fryer 2 is slow to heat back up; call for service.",
      cash_over_short: "-4.25", checks: { temps: true, cleaning: true, deposit: true, alarm: true },
      forecast: { covers: "210", sales: "4000", reservations: "Party of 14 at 7 PM (birthday). Push tables 20–22 together.",
        events: "Home game ends around 6:30 PM; expect a post-game rush. Clear skies, so open the patio.",
        staffing: "Call in a 4th server 6–10 PM. Kevin's status to be decided.", prep: "Double batch of beer batter and tartar. Confirm the cod delivery by noon or keep Fish & Chips 86'd." },
      summary: "Busy, wet night that peaked at 7 PM. The kitchen kept tickets under 18 minutes except during the 7 PM bar rush.",
      wins: "Ana covered an extra section all night with zero complaints. Tasha ran expo through the rush.",
      followups: "Monday: Kevin's no-show write-up. Order a walk-in gasket. Check on Marco's finger before his next shift.",
    } },
    { daysAgo: 1, shift: "Lunch", manager: "Declan Byrne", data: {
      weather: "Cloudy", temp: "58", weather_notes: "",
      sales: "1210", hours_from: 11, hours_to: 15,
      hourly: { 11: 9, 12: 28, 13: 22, 14: 10, 15: 4 },
      staffing: { foh_sched: "3", foh_actual: "3", boh_sched: "3", boh_actual: "3" },
      employee: [
        { dept: "BOH", name: "Sam Ortiz", type: "Late arrival", notes: "30 minutes late because of a bus delay.", action: "Talked it through; no write-up." },
      ],
      guest: [],
      comps: [
        { type: "Void: rung in wrong", item: "Corned Beef Reuben", amount: "16.00", reason: "Server rang it in twice", approved: "Declan" },
      ],
      eighty_six: "", maintenance: "Ice machine is making a grinding noise. Keep an eye on it.",
      cash_over_short: "0", checks: { temps: true, cleaning: true },
      forecast: { covers: "80", sales: "1300", reservations: "None on the books.", events: "", staffing: "Normal lunch crew.", prep: "Two batches of potato leek soup." },
      summary: "Steady lunch with no real problems.", wins: "", followups: "Dinner team: cod delivery is short tonight, watch Fish & Chips counts.",
    } },
  ],
};

// ---------------------------------------------------------------------
// Kelley's: two more weeks of MOD reports (lunch + dinner, 2–15 days ago),
// so the MOD Report tab has history to look at. Made up but realistic:
// weekends are busier, a few shifts have issues, most are quiet.
// Uses a fixed random seed, so every new Kelley's gets the same reports.
// ---------------------------------------------------------------------
(function () {
  let seed = 20261030;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const between = (lo, hi) => Math.round(lo + rnd() * (hi - lo));
  const chance = (p) => rnd() < p;

  const FOH = ["Jess Monroe", "Kevin Doyle", "Ana Lima", "Ryan Shea", "Olivia Park", "Ben Carter"];
  const BOH = ["Marco Ruiz", "Tasha Green", "Eli Novak", "Sam Ortiz"];
  const weatherByTemp = [["Sunny", 66, 74], ["Partly cloudy", 60, 70], ["Cloudy", 55, 63], ["Rain", 50, 58], ["Windy", 52, 60]];
  const EMP = [
    ["FOH", FOH, "Called out sick", "Texted at 2 PM with a fever.", "Covered by moving sections; doctor's note requested."],
    ["BOH", BOH, "Called out sick", "Called in sick before the shift.", "Declan worked the line; prep pushed to tomorrow."],
    ["FOH", FOH, "Late arrival", "Showed up 20 minutes late.", "Verbal reminder about the schedule."],
    ["BOH", BOH, "Injury: burn", "Minor burn on the forearm from the fryer basket.", "Cooled with water, burn cream; kept working. Incident form filed."],
    ["FOH", FOH, "Coworker dispute", "Argument with another server over table rotation.", "Talked to both after close; host will seat in strict rotation."],
    ["BOH", BOH, "Left early / sent home", "Felt dizzy during the rush.", "Sent home at 8 PM; check in tomorrow."],
    ["FOH", FOH, "No call / no show", "Didn't show and didn't answer the phone.", "Shift covered; write-up for the owner."],
  ];
  const GUEST = [
    ["Food: undercooked", "Burger ordered medium-well came out pink.", "Recooked and comped dessert. Guest happy."],
    ["Food: overcooked / wrong temp", "Lamb shank sent back as dry.", "Replaced with Guinness Beef Pie; comped the shank."],
    ["Slow service / long wait", "45-minute wait for food in the rush.", "Apologized, comped a round of drinks."],
    ["Wrong order", "Got Bangers & Mash instead of the Beef Pie.", "Fixed right away, comped a side of Curry Chips."],
    ["Allergy concern", "Guest with a nut allergy asked about the Orchard Salad.", "Made it without walnuts on a clean board; chef confirmed."],
    ["Food: quality or taste", "Said the chips were soggy.", "Fresh basket from fryer 1; no comp needed."],
    ["Guest injury / accident", "Guest slipped on a wet spot near the bar; no visible injury.", "Checked on guest, offered ice, took contact info, wrote incident report. Wet-floor sign added."],
    ["Billing / payment issue", "Card charged twice for one check.", "Voided the duplicate; showed the guest the receipt."],
  ];
  const COMP = [
    ["Comp: VIP / regular", "Round of Guinness", 22, "Regulars celebrating a promotion"],
    ["Comp: kitchen mistake", "Sticky Toffee Pudding", 10, "Long ticket time"],
    ["Comp: service mistake", "Soft Pretzel & Beer Cheese", 11, "Forgot to fire the appetizer"],
    ["Recook", "Fish & Chips", 8.8, "Batter came out pale"],
    ["Void: rung in wrong", "Guinness BBQ Wings", 15, "Rung in on the wrong table"],
    ["Refund", "Corned Beef Reuben", 16, "Guest left before it arrived"],
    ["Employee / manager meal", "Staff meal", 18, "Double-shift meal for the closer"],
  ];
  const EVENTS = ["Trivia night at 7 PM", "Home game in the afternoon", "Live music Friday 8–11 PM", "Rehearsal dinner (18 guests) at 6 PM", "Quiet weeknight, nothing booked"];
  const LUNCH = [9, 26, 22, 10, 4];          // 11 AM – 3 PM
  const DINNER = [10, 24, 38, 44, 33, 18, 7]; // 4 PM – 10 PM

  const today = new Date();
  const reports = [];
  for (let daysAgo = 2; daysAgo <= 15; daysAgo++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo).getDay();
    const busy = day === 5 || day === 6 ? 1.3 : day === 0 ? 1.1 : day === 1 ? 0.8 : 1;
    const [weather, lo, hi] = pick(weatherByTemp);
    const wet = weather === "Rain";

    for (const shift of ["Lunch", "Dinner"]) {
      const dinner = shift === "Dinner";
      const curve = dinner ? DINNER : LUNCH;
      const from = dinner ? 16 : 11;
      const factor = busy * (wet && dinner ? 0.85 : 1) * (0.9 + rnd() * 0.2);
      const hourly = {};
      curve.forEach((c, i) => { hourly[from + i] = Math.max(0, Math.round(c * factor + between(-2, 2))); });
      const covers = Object.values(hourly).reduce((s, c) => s + c, 0);
      const sales = Math.round(covers * (dinner ? between(18, 21) : between(15, 17)));
      const fohSched = dinner ? (busy > 1 ? 7 : 6) : 3, bohSched = dinner ? 4 : 3;

      const employee = [], guest = [], comps = [];
      if (chance(dinner ? 0.35 : 0.15)) {
        const [dept, people, type, notes, action] = pick(EMP);
        employee.push({ dept, name: pick(people), type, notes, action });
      }
      if (chance(dinner ? 0.45 : 0.2)) {
        const [type, notes, resolution] = pick(GUEST);
        guest.push({ type, table: chance(0.3) ? "Bar" : `Table ${between(1, 24)}`, notes, resolution });
      }
      const nComps = dinner ? between(0, 3) : between(0, 1);
      for (let i = 0; i < nComps; i++) {
        const [type, item, amount, reason] = pick(COMP);
        comps.push({ type, item, amount: amount.toFixed(2), reason, approved: dinner ? "Maeve" : "Declan" });
      }
      const noShow = employee.some((e) => /sick|no show/i.test(e.type));
      const fohMiss = noShow && employee[0].dept === "FOH" ? 1 : 0, bohMiss = noShow && employee[0].dept === "BOH" ? 1 : 0;
      const peakHour = from + curve.indexOf(Math.max(...curve));

      reports.push({ daysAgo, shift, manager: dinner ? "Maeve Kelley" : "Declan Byrne", data: {
        weather, temp: String(between(lo, hi) - (dinner ? 4 : 0)),
        weather_notes: wet ? (dinner ? "Patio closed; walk-ins were slower." : "Lighter lunch traffic in the rain.") : weather === "Sunny" ? "Patio full." : "",
        sales: String(sales), hours_from: from, hours_to: from + curve.length - 1, hourly,
        staffing: { foh_sched: String(fohSched), foh_actual: String(fohSched - fohMiss), boh_sched: String(bohSched), boh_actual: String(bohSched - bohMiss) },
        employee, guest, comps,
        eighty_six: chance(0.2) ? pick(["Lamb shank 86'd at 8:30 PM.", "Out of sticky toffee sponge by 9 PM.", "Low on Irish cheddar; order placed.", "Smoked salmon 86'd; delivery tomorrow."]) : "",
        maintenance: chance(0.2) ? pick(["Bathroom faucet dripping.", "One patio heater won't light.", "Dish machine needed a reset mid-shift.", "Light out over table 9."]) : "",
        cash_over_short: chance(0.75) ? "0" : (between(-800, 300) / 100).toFixed(2),
        checks: { temps: true, cleaning: true, deposit: dinner, alarm: dinner },
        forecast: {
          covers: String(Math.round(covers * (0.9 + rnd() * 0.25))), sales: String(Math.round(sales * (0.9 + rnd() * 0.25))),
          reservations: dinner && chance(0.4) ? `Party of ${between(8, 16)} at ${between(6, 8)} PM.` : "Nothing large on the books.",
          events: dinner ? pick(EVENTS) : "", staffing: noShow ? "Confirm everyone is coming in tomorrow." : "Normal crew.",
          prep: pick(["Two batches of beer batter.", "Braise lamb shanks in the morning.", "Extra colcannon for the weekend.", "Potato leek soup x2."]),
        },
        summary: `${covers > (dinner ? 190 : 85) ? "Busy" : covers < (dinner ? 140 : 60) ? "Slow" : "Steady"} ${shift.toLowerCase()} that peaked around ${peakHour > 12 ? peakHour - 12 : peakHour} ${peakHour >= 12 ? "PM" : "AM"}.` +
          (employee.length || guest.length ? " Issues noted below." : " No problems."),
        wins: chance(0.4) ? pick(["Olivia kept the wait list moving perfectly.", "Tasha hit every ticket time in the rush.", "Ryan upsold 12 Irish coffees.", "Ana got a guest shout-out by name."]) : "",
        followups: employee.length ? `Follow up with ${employee[0].name}.` : "",
      } });
    }
  }
  window.SEEDS.kelleys.modReports.push(...reports);
  window.SEEDS.kelleys.label = "Kelley's: Irish-American gastropub (17 dishes, 6 weeks of sales, team, 2 weeks of MOD reports)";
})();
