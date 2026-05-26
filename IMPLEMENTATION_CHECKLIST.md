# Pokédex Implementation Checklist

## 1. Core Pokédex Information
**Status: ~40% Complete**

### Pokémon Pages
- ✅ National Dex number, name, species and generation (shown on detail page)
- ✅ Types and type effectiveness (types shown, defender multipliers calculated)
- ✅ Base stats and stat total (StatBar component exists)
- ✅ Abilities and hidden abilities (shown on detail page)
- ✅ Gender ratio, egg groups, hatch steps (utility functions exist)
- ✅ Height, weight, growth rate and catch rate (formatted helpers)
- ✅ Evolution chain with exact evolution requirements (evolution tab exists)
- ⚠️ Forms, regional forms, Mega Evolutions (forms data available but not fully UI'd)
- ✅ Normal sprite/model and shiny appearance (Sprite component, shiny toggle)
- ✅ Pokédex entries by game (species data loaded)
- ❌ Available marks, ribbons or titles where relevant

### Moves and Abilities
- ✅ Move database with type, category, power, accuracy, PP and priority (api.move exists)
- ⚠️ Move effects and secondary-effect chances (loaded but minimal UI)
- ✅ Show which Pokémon learn each move (data available via api)
- ❌ Show how a Pokémon learns a move: level-up, TM, tutor, egg move or transfer
- ✅ Ability database with descriptions (api.ability exists)
- ❌ Show all Pokémon with a selected ability
- ❌ Filter moves and abilities by game or generation

### Items and Mechanics
- ✅ Held items database (competitive items only via api.itemIndex)
- ❌ Evolution items and where they are used
- ❌ Poké Ball tracking and catch-related information
- ❌ Nature effects
- ⚠️ IV, EV and stat calculation tools (basic calcs in utils, but no UI tool)
- ❌ Terastal, Mega Evolution, Dynamax/Gigantamax and other game-specific mechanic support

---

## 2. Game-by-Game Catch Tracker
**Status: 0% Complete**

### Game Pokédex Tracking
- ❌ Select which games you own (Settings has ownedVersions but no catch tracker UI)
- ❌ Separate Pokédex tracker for each game
- ❌ National Dex tracker
- ❌ Regional Dex trackers
- ❌ DLC Dex trackers
- ❌ Mark Pokémon as caught, seen, evolved, traded or transferred
- ❌ Track whether a Pokémon was caught in the correct origin game
- ❌ Track forms separately
- ❌ Track gender differences separately
- ❌ Track version exclusives
- ❌ Track legendary, mythical and event Pokémon
- ❌ Track Pokémon still missing from each game

### Catch Planning
- ❌ "Where can I catch this Pokémon?" page
- ❌ Locations by game, route/area and encounter method
- ❌ Encounter conditions: weather, time of day, outbreaks, fishing, raids, etc.
- ❌ Evolution-only or breeding-only warnings
- ❌ Version-exclusive warnings
- ❌ Transfer-only warnings
- ❌ Recommended game to catch each missing Pokémon
- ❌ Generate a "catch next" checklist for a chosen game
- ❌ Filter missing Pokémon by area
- ❌ **Catch Route Planner** (group by area/biome/route, show shortest path, separate tasks)

---

## 3. Personal Collection / Pokémon HOME Tracker
**Status: 5% Complete**

### Individual Pokémon Records
- ❌ Nickname (exists in TeamSlot but not personal collection)
- ❌ Species and form
- ❌ Shiny status
- ❌ Gender
- ❌ Nature
- ❌ Ability
- ❌ Moveset
- ❌ IVs and EVs
- ❌ Level
- ❌ Poké Ball
- ❌ Original trainer
- ❌ Origin game
- ❌ Current game or HOME box
- ❌ Marks and ribbons
- ❌ Notes (competitive-ready, first shiny, etc.)

### Collection Projects
- ❌ Living Dex tracker
- ❌ Form Dex tracker
- ❌ Shiny Dex tracker
- ❌ Shiny Living Dex tracker
- ❌ Origin-game Living Dex tracker
- ❌ Regional form collection
- ❌ Alpha Pokémon collection
- ❌ Marked Pokémon collection
- ❌ Ribbon Master tracker
- ❌ Apricorn Ball / special Poké Ball collection

### Box Organizer
- ❌ Plan Pokémon HOME box layouts
- ❌ Drag-and-drop box organization
- ❌ Show missing slots in a Living Dex box plan
- ❌ Auto-sort by Dex number, form, game or shiny status
- ❌ Export box checklist

---

## 4. Shiny Hunting Tools
**Status: 0% Complete**

### Hunt Setup
- ❌ Choose target Pokémon and form
- ❌ Choose game
- ❌ Choose hunting method (encounters, eggs, resets, outbreaks, raids, sandwiches, chains)
- ❌ Record whether you have Shiny Charm
- ❌ Record boosts or special conditions
- ❌ Auto-calculate shiny odds for the setup

### Hunt Tracking
- ❌ Encounter counter with large "+1" button
- ❌ Egg counter
- ❌ Reset counter
- ❌ Timer for hunt duration
- ❌ Pause and resume hunts
- ❌ Multiple active hunts simultaneously
- ❌ Phase tracking (for hunts where you find the wrong shiny first)
- ❌ Record successful capture details
- ❌ Attach screenshot or photo of the shiny
- ❌ Record ball used, nature, mark, location, encounter count

### Shiny Statistics
- ❌ Total shinies found
- ❌ Average encounters per shiny
- ❌ Luckiest and unluckiest hunts
- ❌ Shinies by game
- ❌ Shinies by hunting method
- ❌ Completed shiny families
- ❌ Shiny targets still missing

### Fun Additions
- ❌ Random shiny target generator
- ❌ Shiny bingo board
- ❌ "Hunt of the day" picker
- ❌ Milestones (e.g., 100 hunts completed, full shiny starter trio)

---

## 5. Team Builder
**Status: ~60% Complete**

### Basic Team Building
- ✅ Create unlimited teams
- ✅ Choose game or format for each team
- ✅ Add up to six Pokémon
- ⚠️ Select forms, abilities, natures, items and moves (basic UI, forms/natures need work)
- ✅ Set EVs, IVs, level and Tera type where relevant
- ❌ Add notes for each Pokémon's role
- ✅ Save multiple versions of the same team
- ❌ Mark a team as planned, in progress or fully built

### Team Analysis
- ❌ Type weakness and resistance overview
- ❌ Coverage checker
- ❌ Duplicate weakness warnings
- ❌ Missing role warnings (speed control, switch-in, setup, removal, support)
- ❌ Physical versus special damage balance
- ❌ Speed tier comparison
- ❌ Ability and item conflict warnings
- ❌ Suggest Pokémon that patch major weaknesses

### Pokémon Champions-Focused Tools
- ❌ Champions-compatible Pokémon filter
- ❌ Current available roster tracker
- ❌ Regulation/ruleset selector
- ❌ Singles and doubles team support
- ❌ Mega Evolution support
- ❌ Import Pokémon from personal collection into planned team
- ❌ Track which competitive Pokémon still need prep
- ❌ Battle notes (common leads, matchups, strategies)

---

## 6. Competitive Training and Battle Tools
**Status: 0% Complete**

- ❌ Damage calculator
- ❌ Speed calculator
- ❌ EV spread calculator
- ❌ Nature recommendation helper
- ❌ Move coverage calculator
- ❌ Type matchup reference
- ❌ Common threat checklist
- ❌ Team matchup notes
- ❌ Battle log (opponent team, your team, result, lessons learned)
- ❌ Win/loss statistics by team
- ❌ Notes for leads, switches and difficult matchups
- ❌ Practice goals (e.g., "learn doubles positioning" or "test Trick Room team")

---

## 7. Breeding and Training Planner
**Status: 0% Complete**

### Breeding Project
- ❌ Breeding project tracker
- ❌ Parent Pokémon records
- ❌ Desired nature, ability, IVs, ball and egg moves
- ❌ Egg count tracker
- ❌ Masuda Method shiny hunt support
- ❌ Breeding chain planner for egg moves

### Training Checklist
- ❌ Training checklist (level, evolve, nature, ability, EV train, moves, item)
- ❌ EV training locations or methods by game
- ❌ Competitive Pokémon completion progress

### Example Task Flow
- ❌ Catch parent Pokémon
- ❌ Get correct ability
- ❌ Get desired nature
- ❌ Breed desired IVs
- ❌ Hatch shiny if hunting
- ❌ EV train
- ❌ Teach moves
- ❌ Give held item
- ❌ Move into finished team box

---

## 8. Challenge and Goal Trackers
**Status: 0% Complete**

### Challenge Types
- ❌ Nuzlocke tracker
- ❌ Professor Oak Challenge tracker
- ❌ Monotype run tracker
- ❌ Starter-only run tracker
- ❌ Shiny-only playthrough tracker
- ❌ Ribbon Master tracker
- ❌ Living Dex completion challenge
- ❌ All-forms challenge
- ❌ All-games catch challenge
- ❌ Champion/ranked battle milestones
- ❌ Personal achievement badges

### Per-Challenge Features
- ❌ Rules page
- ❌ Allowed games
- ❌ Progress checklist
- ❌ Notes and screenshots
- ❌ Completion date
- ❌ Hall of fame team record

---

## 9. Search, Filters and Quality-of-Life Features
**Status: ~40% Complete**

### Search and Filters
- ✅ Global search for Pokémon (by name on Pokedex page)
- ⚠️ Search by partial name or nickname (implemented but nicknames not in global search)
- ✅ Filter by type (implemented on Pokedex)
- ✅ Filter by generation (implemented on Pokedex)
- ⚠️ Filter by game availability (partial via ownedVersions)
- ❌ Filter by shiny caught/not caught
- ❌ Filter by competitive viability or team role
- ❌ Filter by evolution method
- ❌ Filter by location

### Quality-of-Life
- ✅ Favorites list
- ✅ Recently viewed Pokémon
- ❌ Personal notes on any Pokémon, move, team or hunt
- ✅ Offline support (PWA + caching)
- ❌ Dark mode
- ❌ Mobile-friendly encounter counter
- ✅ Autosave (localStorage sync)
- ✅ Backup and restore your private data
- ⚠️ Export lists as text, image or spreadsheet (only JSON export exists)

---

## 10. Dashboard / Home Screen
**Status: 0% Complete**

- ❌ Current active shiny hunt with encounter counter
- ❌ Current game completion percentage
- ❌ National Dex completion percentage
- ❌ Living Dex completion percentage
- ❌ Shiny Dex completion percentage
- ❌ Recently caught Pokémon
- ❌ Pokémon needed for your active team
- ❌ Upcoming personal goals
- ❌ Random suggested catch target
- ❌ Quick buttons (Add Catch, Start Hunt, Create Team, Search Pokémon)

---

## 11. Data and App Foundation Features
**Status: ~50% Complete**

### Database & Architecture
- ✅ Pokémon, move, ability, item, form and game-version database (PokeAPI)
- ⚠️ Support data that changes between games (versions tracked but not utilized)
- ⚠️ Keep learnsets separate by game (data available but not UI'd)
- ⚠️ Keep encounter locations separate by game (data available but not UI'd)
- ⚠️ Keep evolution methods separate by game when necessary (partial)
- ❌ Allow new games, forms and Champions rulesets without rebuilding
- ✅ Store private progress separately from public reference data
- ✅ Local save file
- ✅ Backup/export/import support
- ⚠️ Manual corrections for missing or newly released data (partial structure)

---

## Summary

| Section | Status | Priority |
|---------|--------|----------|
| 1. Core Pokédex | 40% | High |
| 2. Game-by-Game Catch Tracker | 0% | **Critical** |
| 3. Personal Collection | 5% | **Critical** |
| 4. Shiny Hunting Tools | 0% | High |
| 5. Team Builder | 60% | Medium |
| 6. Battle Tools | 0% | Medium |
| 7. Breeding Planner | 0% | Medium |
| 8. Challenge Trackers | 0% | Low |
| 9. Search & QoL | 40% | High |
| 10. Dashboard | 0% | High |
| 11. Data Foundation | 50% | Medium |

### Quick Priority Wins
1. **Catch Tracker** (Section 2) — The spec calls this "most important" for the goal of catching across multiple games
2. **Personal Collection** (Section 3) — Foundation for shiny hunting, collection projects, and HOME tracking
3. **Dashboard** (Section 10) — Shows off active goals and motivates continued use
4. **Shiny Hunting** (Section 4) — Makes the app personal and fun vs. a generic Pokédex
5. **Team Builder completion** (Section 5) — Nearly done, finishing touches for full coverage
